# CSDP Eligibility Scoring Algorithm

A deterministic, evidence-weighted credit scoring algorithm for the Airtel CSDP Profile
endpoint. Designed to ship without labels, produce honest scores across all borrower segments,
and emit clean training data for a supervised model in 60–90 days.

---

## 1. Context

The Airtel CSDP Profile endpoint is called every time a subscriber attempts an
airtime/data/talktime micro-loan. Airtel sends:

| Field       | Type       | Meaning                                                          |
| ----------- | ---------- | ---------------------------------------------------------------- |
| `msisdn`    | string(13) | Subscriber phone number, `234XXXXXXXXXX` format                  |
| `da`        | int (kobo) | Subscriber's current total loan balance across all CSDP partners |
| `trans_ref` | string     | Correlation ID — the primary join key for all downstream events  |
| `type`      | enum       | `AIRTIME` / `DATA` / `TALKTIME`                                  |

We must respond within ~1.5 s with:

```json
{ "message": "<integer Naira as string>" }
```

`"0"` means denied. Any positive integer is the approved limit in whole Naira.

---

## 2. Locked-in assumptions

| #   | Assumption                                                                                                              | Revisit trigger                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | `da` = total cross-partner CSDP balance in kobo. Used for residual-capacity accounting only — not a score input.        | Airtel clarifies `da` meaning differently           |
| 2   | Deny = `{"message": "0"}`. Approval = `{"message": "<floor_naira_int>"}`.                                               | Spec change                                         |
| 3   | 1.5 s latency budget. All subscriber features precomputed; hot path = one PK row read + one Redis GET + request fields. | SLA change                                          |
| 4   | No labels yet → no ML. All weights, anchors, and caps live in `SYSTEM_CONFIG` and are hot-tunable without a deploy.     | ~90 days of fulfillment + recovery data accumulated |

---

## 3. Mental model: two distinct borrower populations

The algorithm handles two structurally different cases. Understanding which path a subscriber
takes explains every design decision below.

**Population A — Subscribers with loan history (`taken_180d > 0`).**
These are scored by the evidence formula. The adaptive threshold in Stage 3 is lower for
thin files so that the first few repayments unlock something real. Entry into positive limits
requires approximately 5 repayments.

**Population B — Subscribers with no loan history (`taken_180d = 0`).**
Evidence is zero by definition. These take the cold-start path in §5.3, which grants a
small starter score based purely on network engagement. Cold-start produces a score that
clears the Stage 3 threshold for any subscriber who meets the minimum engagement gate —
the threshold at `taken_180d = 0` is 80, and even the minimum qualifying cold-start score
of 150 exceeds it. This is intentional: a well-tenured, actively-recharging first-time
borrower deserves one small loan to start building a track record.

These two paths are mutually exclusive. A subscriber is in Population B only if
`taken_180d = 0`; as soon as one loan is taken they are in Population A, and the evidence
formula takes over.

---

## 4. Stage 1 — Hard gates

Return `"0"` immediately and skip all scoring. Each gate is a hard policy decision, not a
heuristic.

```
if subscriber.blacklisted                              → 0   // explicit ban
if subscriber.our_outstanding_kobo > 0                 → 0   // no stacking on our own book
if request.da_kobo ≥ partner_cap_kobo                  → 0   // already at cross-partner ceiling
if uncured_default_exists                              → 0   // any open bad debt, any age
if eligibility_checks_1h ≥ 10                          → 0   // extreme abuse only
if NOT loan_type_enabled[request.type]                 → 0   // product kill switch
```

**Uncured default definition.** A loan is uncured if its current status is `DEFAULTED` AND
`recovered_kobo < repayable_kobo`. This is a current-state gate with no lookback window: any
open bad debt blocks lending regardless of age. Once the debt is repaid in full the loan
transitions to `RECOVERED`, the flag clears, and the subscriber is eligible again.

A cured default (was `DEFAULTED`, now `RECOVERED`) does **not** gate here. It leaves a
historical scar handled by the penalty in §5.4.

**Velocity gate is intentionally extreme.** Subscribers who retry after a transient failure
or switch loan types are not blocked here. The soft velocity penalty in §5.4 handles the
3–9 check range. The gate fires only on unambiguous abuse.

**`da ≥ partner_cap` short-circuit.** A perfect Stage 2 score would still yield a zero
limit after Stage 4 clamp 1. The gate saves the compute and avoids a misleading
approved-then-clamped log record.

---

## 5. Stage 2 — Score (0–1000)

Score = evidence × stability − penalties.

Stability modulates evidence; it does not add baseline points on its own. A subscriber with
long tenure and no loan history scores 0 from the evidence formula. They are handled by the
cold-start path (§5.3), not by tenure giving free points.

### 5.1 Bayesian-smoothed repayment evidence

The dominant signal. Naive ratios (`recovered / taken`) misrepresent thin files: 1/1 = 100%
looks identical to 20/20 = 100% but carries far weaker statistical evidence.

A Beta(2, 2) prior corrects this. It encodes "we assume roughly 50% repayment until data
says otherwise" with the weight of 4 pseudo-observations.

```
α = 2, β = 2                                          // Beta(2,2) prior

posterior_rate = (recovered_180d + α) / (taken_180d + α + β)
confidence     = taken_180d / (taken_180d + 4)         // ∈ [0, 1)
evidence_score = 800 · posterior_rate · confidence
```

**Calibration table** (perfect repayment history, for reference):

| History | Posterior | Confidence | Evidence score |
| ------- | --------- | ---------- | -------------- |
| 0 / 0   | 0.500     | 0.000      | 0              |
| 1 / 1   | 0.600     | 0.200      | 96             |
| 3 / 3   | 0.714     | 0.429      | 245            |
| 5 / 5   | 0.778     | 0.556      | 346            |
| 10 / 10 | 0.857     | 0.714      | 490            |
| 20 / 20 | 0.917     | 0.833      | 611            |
| 50 / 50 | 0.961     | 0.926      | 712            |

The `evidence_score` asymptotically approaches 800 and never reaches it. This is intentional
— uncertainty is never fully resolved, and the limit curve is calibrated against this ceiling.

### 5.2 Stability multiplier

Tenure and recharge engagement modulate the evidence score. Neither contributes baseline
points independently.

```
tenure_mult     = 0.85 + 0.15 · tanh(days_on_network / 365)    // ∈ [0.85, 1.00]
engagement_mult = 0.70 + 0.30 · tanh(recharge_count_30d / 20)  // ∈ [0.70, 1.00]

stability = min(tenure_mult, engagement_mult)                   // weakest signal dominates
base      = evidence_score · stability
```

`min` is deliberate: a long-tenured subscriber who has stopped recharging is a churn risk.
The weaker signal wins.

`engagement_mult` reaches 0.75 at approximately 4 recharges per month (roughly weekly), and
1.00 asymptotically at daily recharging. `tenure_mult` reaches 0.99 at approximately
2 years on network.

### 5.3 Cold-start path (Population B only)

Applies when `taken_180d = 0`. `evidence_score = 0` for this population by construction, so
`base = 0` from the formula above. The cold-start path substitutes a small network-anchored
score instead.

**Eligibility (all must hold):**

```
taken_180d = 0
days_on_network   ≥ COLD_START_MIN_DAYS      // 60 days: not a brand-new SIM
engagement_mult   ≥ COLD_START_MIN_ENG       // 0.75 ≈ 4 recharges/month
uncured_default_exists = false               // gated in Stage 1; confirmed here for clarity
```

**Score substitution:**

```
base = COLD_START_BASE · engagement_mult     // 200 · engagement_mult
```

At minimum qualifying engagement (0.75): `base = 150`.
At daily-recharger engagement (1.00): `base = 200`.

The effective Stage 3 threshold at `taken_180d = 0` is 80 (see §6.1). Every qualifying
cold-start score (150–200) clears it. This is the design intent: a first-time borrower who
actively uses the network gets one small loan to start building a track record.

The resulting limit is about **₦212–307** for AIRTIME at these engagement levels — deliberately
small. At minimum qualifying engagement (`base = 150`), `progress = (70/920)^{0.85}` and
`limit = 50 + 1450 · progress ≈ ₦212`; at maximum engagement (`base = 200`),
`progress = (120/920)^{0.85}` and `limit = 50 + 1450 · progress ≈ ₦307`. The blast radius from
a first-time borrower defaulting is limited to this range.

If `eligibility_checks_1h ≥ 3` and the velocity soft-penalty fires, `base` is reduced via
the §5.4 penalty before Stage 3 evaluation. **Cold-start subscribers have no loan history,**
so the cured-default terms in §5.4 are always zero; **only the velocity term** (`eligibility_checks_1h`)
can reduce `base` on this path.

### 5.4 Penalties

Subtract from `base`. Applied after the cold-start substitution if applicable.

```
penalty  = 100 · historical_cured_defaults_180d
penalty += min(150, 30 · historical_cured_defaults_lifetime)
penalty +=   5 · max(0, eligibility_checks_1h − 3)

score = clamp(base − penalty, 0, 1000)
```

**`historical_cured_defaults`** counts loans that were once in `DEFAULTED` status but
subsequently reached `RECOVERED` (i.e., repaid in full despite defaulting). These are
explicitly not the same as uncured defaults:

- Uncured defaults → Stage 1 gate. The subscriber is rejected before §5.4 is reached.
- Cured defaults → Stage 2 penalty. The subscriber passed Stage 1 (debt is cleared) but
  carries a historical scar that reduces their score.

These two populations are disjoint. The penalty in §5.4 fires only on subscribers who
have already passed Stage 1. There is no dead code.

The lifetime cap of 150 prevents permanent lockout after a long clean stretch. An old
serial defaulter who has since repaid everything and maintained a clean record for 2+ years
will eventually have `historical_cured_defaults_180d = 0`, and their lifetime penalty
shrinks toward the cap.

**`da_kobo` does not appear in the score.** It gates in Stage 1 and clamps in Stage 4.
Adding it as a score penalty would double-count the same signal.

---

## 6. Stage 3 — Score → base limit

### 6.1 Adaptive threshold (quadratic decay)

The threshold scales down for thin-file subscribers so that the first few repayments unlock
positive limits. The decay is quadratic so the bonus stays high for very thin files and
disappears quickly as history accumulates.

```
frac               = max(0, 1 − taken_180d / 6)
thin_file_bonus    = 220 · frac²
effective_threshold = 300 − thin_file_bonus
```

Threshold table:

| `taken_180d` | Bonus | Effective threshold |
| ------------ | ----- | ------------------- |
| 0            | 220.0 | 80.0                |
| 1            | 152.8 | 147.2               |
| 2            | 97.8  | 202.2               |
| 3            | 55.0  | 245.0               |
| 4            | 24.4  | 275.6               |
| 5            | 6.1   | 293.9               |
| 6+           | 0.0   | 300.0               |

The threshold for Population B (cold-start) is 80, which every qualifying cold-start score
clears. The threshold for Population A converges to 300 by the 6th loan, at which point the
full evidence formula determines access.

### 6.2 Continuous limit curve

No step functions. No cliffs to game.

```
if score < effective_threshold:
    base_limit = 0
else:
    progress   = ((score − effective_threshold) / (1000 − effective_threshold)) ^ 0.85
    base_limit = small_min[type] + (max_limit[type] − small_min[type]) · progress
```

Limit anchors per loan type:

| `loan_type` | `small_min` (₦) | `max_limit` (₦) |
| ----------- | --------------- | --------------- |
| AIRTIME     | 50              | 1500            |
| DATA        | 100             | 3000            |
| TALKTIME    | 50              | 1000            |

The `^0.85` exponent gives a concave curve: early score gains produce fast limit growth,
very high scores do not accelerate indefinitely.

A 1-point score change produces a 2–4 Naira limit change throughout the range. There is
no exploitable discontinuity.

---

## 7. Stage 4 — Real-time clamps

Three clamps applied in order. Each reflects an accounting or portfolio reality, not a
behavioral signal.

```
limit = base_limit

// 1. Don't push the user past Airtel's cross-partner cap
limit = min(limit, partner_cap_naira − to_naira(da_kobo))

// 2. Per-user rolling 24h cap on our own book
limit = min(limit, daily_user_cap[type] − our_disbursed_24h_naira)

// 3. Rolling 24h system exposure throttle
exposure_pct = book_outstanding_24h_kobo / exposure_budget_kobo
if exposure_pct ≥ 0.95:
    limit = 0
elif exposure_pct ≥ 0.85:
    taper = 1 − (exposure_pct − 0.85) / (0.95 − 0.85)
    limit = limit · taper                              // linear taper 100% → 0%

limit = floor(max(0, limit))
```

**All three clamps use rolling 24-hour windows, not calendar-day resets.** A calendar reset
halts lending at 23:58 and floods the book at midnight. The rolling window has no such cliff.

The linear taper between 85% and 95% exposure replaces a binary step cut. As portfolio
exposure rises, limits reduce proportionally. No subscriber sees a sudden large cut at one
threshold and an immediate cliff to zero at the next.

---

## 8. Stage 5 — Format & log

```python
return { "message": str(limit) }    # "0" or whole-Naira integer
```

Every request — regardless of outcome — writes one row to `csdp_eligibility_log`.

| Column                       | Notes                                                                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `trans_ref`                  | Primary join key → fulfillment → recovery                                                                                                                                                        |
| `msisdn`                     |                                                                                                                                                                                                  |
| `loan_type`                  |                                                                                                                                                                                                  |
| `da_kobo`                    | As received from Airtel                                                                                                                                                                          |
| `gate_failed`                | Nullable enum: `BLACKLIST` / `OUTSTANDING` / `DA_CAP` / `UNCURED_DEFAULT` / `VELOCITY` / `TYPE_DISABLED`                                                                                         |
| `score`                      | Final 0–1000 value                                                                                                                                                                               |
| `score_components`           | JSONB: `posterior_rate`, `confidence`, `evidence_score`, `tenure_mult`, `engagement_mult`, `stability`, `base`, `thin_file_bonus`, `effective_threshold`, `penalty_breakdown`, `cold_start_used` |
| `base_limit_naira`           | Output of Stage 3                                                                                                                                                                                |
| `partner_residual_naira`     | Stage 4 clamp 1 headroom                                                                                                                                                                         |
| `daily_user_remaining_naira` | Stage 4 clamp 2 headroom                                                                                                                                                                         |
| `system_exposure_pct`        | Stage 4 clamp 3 input                                                                                                                                                                            |
| `final_limit_naira`          | Returned value                                                                                                                                                                                   |
| `decision_mode`              | Rollout flag: `SHADOW` / `LIVE_5` / `LIVE`                                                                                                                                                       |
| `model_version`              | `"heuristic_v3"`                                                                                                                                                                                 |
| `snapshot_mismatch`          | Boolean — true if loan_features_snapshot fell back to re-materialization                                                                                                                         |

This log schema is also the training schema. After 60–90 days of fulfillment + recovery data,
every approved row joins via `trans_ref → loan_id → recovery` to produce labeled
`(features_at_decision, limit_given, taken?, recovered?, days_to_recover)` tuples.

---

## 9. Precomputed feature row

Materialized per `msisdn`, refreshed every 15 minutes. The hot path does one PK lookup here,
one Redis GET for `system_exposure_pct`, and nothing else.

```
msisdn                            PK
days_on_network
recharge_count_30d                ← required for engagement_mult and cold-start gate
loans_taken_180d
loans_recovered_180d
historical_cured_defaults_180d    ← loans that were DEFAULTED and later reached RECOVERED
historical_cured_defaults_lifetime
uncured_default_exists            ← boolean: any loan currently DEFAULTED + unpaid, any age
our_outstanding_kobo
our_disbursed_24h_naira           ← rolling 24h window, not calendar-day
eligibility_checks_1h
updated_at
```

**`recharge_count_30d` must be in this row.** It drives `engagement_mult` and the cold-start
eligibility gate. It must not be computed on the hot path.

**Refresh lag.** The snapshot is refreshed every 15 minutes, so fields such as
`our_disbursed_24h_naira` (Stage 4 clamp 2) can be up to ~15 minutes behind the true rolling
24h total. A subscriber who takes two loans within one refresh window may have the second
decision see the pre-first-loan disbursement aggregate. In practice this is usually negligible
(Airtel’s own velocity controls limit how often this can happen), but it is a known staleness
window, not a live read of disbursements at request time.

**Loan status state machine** (maintained by the hourly aging job):

```
ISSUED     ← written on fulfillment webhook
PARTIAL    ← recovered_kobo > 0 AND recovered_kobo < repayable_kobo
RECOVERED  ← recovered_kobo ≥ repayable_kobo
DEFAULTED  ← aging job: status ∈ {ISSUED, PARTIAL} AND now − issued_at > 30d
```

"Uncured" = status `DEFAULTED` + `recovered_kobo < repayable_kobo`. A loan that reaches
`DEFAULTED` and is later repaid in full transitions to `RECOVERED`. At that point:

- It exits `uncured_default_exists` (gate clears).
- It enters `historical_cured_defaults_180d` / `lifetime` (penalty fires going forward).
- It is counted in `loans_recovered_180d` (improves the repayment rate).

These three effects are additive and consistent. There is no double-counting.

---

## 10. Webhook handling

Without bulletproof inbound handling, training labels arrive corrupted and any future model
is fit on noise.

### Idempotency

- **Fulfillment webhook** (`type = fulfillment`): unique on `loan_id`. Repeated deliveries
  are no-ops.
- **Recovery webhook** (`type = repayment`): unique on `(recovery_id, loan_id)` per line
  item in the `loans[]` array. Each line item is independently idempotent.

### Partial recoveries

`csdp_loan` carries `recovered_kobo` as a cumulative running total, not a binary flag. Each
recovery webhook adds to it. The aging job re-evaluates status hourly.

### Two-point feature snapshotting

Airtel may send a fulfillment webhook with a different `trans_ref` than the Profile call.
To guarantee every issued loan has the feature vector active at decision time:

1. **At Profile time**: write `eligibility_features_snapshot` keyed by `trans_ref`.
2. **At fulfillment**: write `loan_features_snapshot` keyed by `loan_id`, copying from the
   matching `eligibility_features_snapshot` by `trans_ref` if found.
3. **Fallback**: if no matching snapshot is found, re-materialize from the precomputed
   feature row (which may have refreshed since the decision), set `snapshot_mismatch = true`,
   and increment the `csdp.snapshot_mismatch_count` metric.

`snapshot_mismatch` rows are not excluded from training — they degrade label precision for
that row, but exclusion would introduce selection bias. They are down-weighted at model
training time. A sustained mismatch rate above 1% is a webhook mapping bug, not a training
data quirk, and should trigger an incident.

---

## 11. SYSTEM_CONFIG reference

All keys are hot-tunable. No deploy required to adjust risk posture.

```
# Score — Bayesian prior
csdp.score.prior_alpha                   = 2
csdp.score.prior_beta                    = 2
csdp.score.confidence_pseudo_n           = 4
csdp.score.evidence_max                  = 800

# Score — stability multipliers
csdp.score.tenure_mult_min               = 0.85
csdp.score.tenure_sat_days               = 365
csdp.score.engagement_mult_min           = 0.70
csdp.score.engagement_sat                = 20

# Score — cold-start
csdp.score.cold_start_base               = 200
csdp.score.cold_start_min_tenure_days    = 60
csdp.score.cold_start_min_engagement     = 0.75      // ≈ 4 recharges/month

# Score — penalties
csdp.score.penalty_cured_recent          = 100
csdp.score.penalty_cured_lifetime        = 30
csdp.score.penalty_cured_lifetime_cap    = 150
csdp.score.penalty_velocity              = 5
csdp.score.velocity_threshold            = 3

# Stage 3 — limit curve
csdp.tier.base_threshold                 = 300
csdp.tier.thin_file_max_bonus            = 220
csdp.tier.thin_file_saturation           = 6
csdp.tier.curve_exponent                 = 0.85
csdp.tier.anchors = {
    AIRTIME:  { small_min: 50,  max_limit: 1500 },
    DATA:     { small_min: 100, max_limit: 3000 },
    TALKTIME: { small_min: 50,  max_limit: 1000 }
}

# Stage 4 — clamps
csdp.partner_cap_naira                   = 5000
csdp.daily_user_cap_naira = {
    AIRTIME: 1500, DATA: 3000, TALKTIME: 1000
}
csdp.exposure.taper_start_pct            = 0.85
csdp.exposure.halt_pct                   = 0.95
csdp.exposure.budget_kobo                = <ops-managed>

# Gates
csdp.gate.velocity_extreme               = 10
csdp.loan_type_enabled = {
    AIRTIME: true, DATA: true, TALKTIME: true
}
```

---

## 12. End-to-end worked examples

All numbers below are verified against the reference Python implementation.

### Example A — Thin-file subscriber (4/4 repayment history)

Subscriber: `days_on_network = 730`, `recharge_count_30d = 12`, `taken_180d = 4`,
`recovered_180d = 4`, `historical_cured_defaults = 0`, `uncured_default_exists = false`,
`our_outstanding_kobo = 0`, `eligibility_checks_1h = 1`.
Request: `da_kobo = 80000` (₦800), `loan_type = DATA`. System: `exposure_pct = 0.40`.

**Stage 1**: all gates pass.

**Stage 2**:

```
posterior_rate = (4 + 2) / (4 + 4) = 0.750
confidence     = 4 / 8              = 0.500
evidence_score = 800 · 0.750 · 0.500 = 300.0

tenure_mult     = 0.85 + 0.15 · tanh(730/365) = 0.995
engagement_mult = 0.70 + 0.30 · tanh(12/20)   = 0.861
stability       = min(0.995, 0.861) = 0.861

base    = 300.0 · 0.861 = 258.3
penalty = 0
score   = 258
```

**Stage 3**:

```
frac            = max(0, 1 − 4/6) = 0.333
thin_file_bonus = 220 · 0.333²    = 24.4
threshold       = 300 − 24.4      = 275.6

score (258) < threshold (275.6) → base_limit = ₦0 → DENIED
```

This subscriber is correctly denied. Four perfect repayments is good behaviour but not yet
sufficient evidence for a DATA loan. Their 5th repayment will push `score` to 298 against a
threshold of 293.9, unlocking ₦134. This is the intended progression — evidence accumulates,
limits grow.

### Example B — Cold-start subscriber

Subscriber: `days_on_network = 180`, `recharge_count_30d = 8`, `taken_180d = 0`,
`uncured_default_exists = false`, `our_outstanding_kobo = 0`.
Request: `da_kobo = 0`, `loan_type = AIRTIME`. System: `exposure_pct = 0.30`.

**Stage 1**: all gates pass.

**Stage 2**:

```
engagement_mult = 0.70 + 0.30 · tanh(8/20) = 0.814

Cold-start check:
  taken_180d = 0                        ✓
  days_on_network (180) ≥ 60            ✓
  engagement_mult (0.814) ≥ 0.75        ✓

base  = 200 · 0.814 = 162.8
score = 163 (no penalty)
```

**Stage 3**:

```
thin_file_bonus = 220 · (1 − 0/6)² = 220.0
threshold       = 300 − 220         = 80.0

score (163) ≥ threshold (80) → proceed

progress   = ((163 − 80) / (1000 − 80)) ^ 0.85 = (83/920)^0.85 = 0.128
base_limit = 50 + (1500 − 50) · 0.128 = ₦237
```

**Stage 4**: no clamps active. `final_limit = 237`.

**Response**: `{"message": "237"}`

A first-time borrower with weekly recharging and 6 months on network gets ₦237 for airtime.
Small enough to cap blast radius; real enough to create a training data point.

### Example C — Established subscriber

Subscriber: `days_on_network = 730`, `recharge_count_30d = 12`, `taken_180d = 12`,
`recovered_180d = 12`, `historical_cured_defaults = 0`, `uncured_default_exists = false`,
`our_outstanding_kobo = 0`, `eligibility_checks_1h = 1`.
Request: `da_kobo = 80000` (₦800), `loan_type = DATA`. System: `exposure_pct = 0.40`.

**Stage 1**: all gates pass.

**Stage 2**:

```
posterior_rate = (12 + 2) / (12 + 4) = 0.875
confidence     = 12 / 16              = 0.750
evidence_score = 800 · 0.875 · 0.750 = 525.0

stability = 0.861 (same subscriber profile as Example A)

base    = 525.0 · 0.861 = 452.1
penalty = 0
score   = 452
```

**Stage 3**:

```
thin_file_bonus = 220 · max(0, 1 − 12/6)² = 0   (saturated: 12 > 6)
threshold       = 300

progress   = ((452 − 300) / (1000 − 300)) ^ 0.85 = (152/700)^0.85 ≈ 0.2730
base_limit = 100 + (3000 − 100) · 0.2730 ≈ 891.8   // Stage 4–5 floor → ₦891 payout
```

**Stage 4**:

```
partner_residual = 5000 − 800 = ₦4200  → no clamp
daily_remaining  = 3000 − 0   = ₦3000  → no clamp
exposure_pct 0.40 < 0.85               → no clamp

final_limit = 891
```

**Response**: `{"message": "891"}`

---

## 13. Dead zone summary

The transition from cold-start to evidence-based scoring is the most operationally sensitive
part of the algorithm. This table shows the complete picture:

| Population          | `taken_180d` | Threshold | Score at perfect repayment\* | Outcome                      |
| ------------------- | ------------ | --------- | ---------------------------- | ---------------------------- |
| Cold-start eligible | 0            | 80        | 150–200 (cold-start `base`)  | ~₦212–307 AIRTIME            |
| First loan repaid   | 1            | 147       | ~96 → **base ~83**†          | DENIED — score < threshold   |
| Two loans repaid    | 2            | 202       | ~178 → **base ~153**†        | DENIED — score < threshold   |
| Three loans repaid  | 3            | 245       | ~245 → **base ~211**†        | DENIED — score < threshold   |
| Four loans repaid   | 4            | 276       | ~300 → **base ~258**†        | DENIED — score < threshold   |
| Five loans repaid   | 5            | 294       | ~346 → **base ~298**†        | ✓ APPROVED ~₦134 DATA        |
| Six+ loans repaid   | 6+           | 300       | grows with history           | ✓ Full curve                 |

\*For Population A rows, “perfect repayment” means all loans in the window recovered; figures
are evidence × stability at the calibration subscriber profile used elsewhere in this doc (see
§5.1 table and Examples A/C). The **threshold** column is the minimum score needed to pass
Stage 3; whenever the representative **base** is below that threshold, denial follows by
inspection.

†After stability (`tenure_mult`, `engagement_mult`); rounded **base** matches Examples A/C.

**Post–cold-start cliff (product, not a scoring bug).** Consider Example B: a first-time
borrower is approved for about ₦237 on cold-start, repays on time, and returns the next month.
Now `taken_180d = 1` and `recovered_180d = 1`. Cold-start no longer applies (`taken_180d > 0`).
The evidence path yields posterior ≈ 0.6, confidence = 0.2, evidence ≈ 96, and with typical
stability **base ≈ 83** against threshold **147** → denied. The same subscriber can be denied
again at 2/2, 3/3, and 4/4 — **four consecutive denials after a successful first loan**. From
their perspective: “I borrowed, I repaid on time, and you stopped lending to me.” That UX can
be worse than never having been approved at all, and it pushes churn to competitors for loans
2–5. The static “DENIED” rows for `taken_180d` 1–4 above are not four disjoint cohorts; in
production, **the same subscribers cycle through those states month over month** until they
reach five perfect repayments (for DATA at this calibration) or leave.

Addressing the cliff is a **product decision**, not something the formulas alone resolve. Two
directions (each has cost):

- **Continuity bonus:** a one-time additive lift for subscribers whose only history is a
  successful cold-start loan, decaying as `taken_180d` grows. Easy to implement but needs a
  clear policy rationale for why “one successful repayment” earns credit the bare Beta path
  does not statistically justify.
- **No cold-start approval:** funnel first-time borrowers elsewhere (e.g. an INTRO promo)
  and only score subscribers once they have history. Cleaner statistics for the core path,
  weaker acquisition at the top of the funnel.

Subscribers in the `taken_180d = 1–4` range are in a genuine thin-file zone — there is not
yet enough statistical evidence in the Beta formulation alone to approve them safely, and no
amount of threshold adjustment can manufacture evidence that doesn't exist. The adaptive
threshold reduces the wait from 6 loans to 5 loans. Further reduction requires either
accepting higher early-stage defaults, applying an explicit product-layer bridge (above),
or acquiring data through a separate promotional product.

---

## 14. Upgrade path to supervised model

The heuristic is designed so that Stage 2 is replaceable without touching Stages 1, 3, or 4.

After 60–90 days:

1. Join `csdp_eligibility_log` → `csdp_loan` → `csdp_recovery` on `trans_ref → loan_id`.
2. Label each approved row: `recovered_binary`, `days_to_recovery`, `recovery_fraction`.
3. Down-weight `snapshot_mismatch = true` rows at training time. Do not exclude — exclusion
   introduces selection bias toward clean-webhook subscribers.
4. Fit a calibrated GBM on the `score_components` JSONB columns and request fields → labels.
5. Validate: AUC, calibration curve, PSI vs. heuristic score distribution, limit fairness
   across engagement deciles.
6. Deploy as `model_version = "gbm_v1"` under `decision_mode = SHADOW` first.
7. Promote to `LIVE_5`, then `LIVE` after A/B validation passes.
