# CSDP migration — 4 phases, ordered

**Companion to:** [CSDP_HUB_MIGRATION_PLAN.md](./CSDP_HUB_MIGRATION_PLAN.md) (the *what* and *why*) and [CSDP_SCORING_ALGORITHM.md](./CSDP_SCORING_ALGORITHM.md) (`heuristic_v3` spec).

This doc is the *how* and *in what order*. Each phase has:
1. **Goal** — one sentence.
2. **What ships** — the concrete deliverables.
3. **Order within the phase** — implement steps in this order; later steps assume earlier ones.
4. **Exit criteria** — must all be true before starting the next phase.
5. **What does not move yet** — explicit out-of-scope so phases don't slip into each other.

Phases are sized to be **independently reviewable**. A phase boundary is a natural point to pause, get sign-off, and adjust.

---

## Phase 1 — Foundation (no production traffic)

**Goal:** put schema, contracts, and tests in place so Phase 2 can implement the algorithm without rework.

### What ships

- `csdp_subscriber_feature_row` table (one row per MSISDN, columns per scoring §9).
- `csdp_credit_profile` table (Option B — persisted state: blacklisted, admin overrides, persisted limit).
- `csdp_credit_score_history` table (append-only audit, MSISDN-keyed).
- `csdp_eligibility_features_snapshot` table (per-`trans_ref`).
- `csdp_loan_features_snapshot` table (per-`loan_id`).
- `csdp_loan.status` enum extended: `ISSUED` / `PARTIAL` / `RECOVERED` / `DEFAULTED`.
- `csdp_eligibility_log.score_components` JSONB column + the rest of the columns from scoring §8.
- MSISDN normalizer in `csdp-core` (`normalizeMsisdn(input) → "234XXXXXXXXXX"`), with a CHECK constraint on every MSISDN-bearing column.
- `SYSTEM_CONFIG` seeded with all `csdp.*` keys from scoring §11 at the spec defaults.
- Golden-test suite from scoring §5.1 calibration table, §6.1 threshold table, §12 worked examples (Adaeze, Tunde, Funmi, Bola, Chinedu, Emeka), and Stage 4 clamp vectors. Tests run on every PR.
- Runbook stubs: `SYSTEM_CONFIG` cache TTL exceeded, `EligibilityLinkingProcessor` failure, aging-job stall, snapshot-mismatch > 1 %.
- NDPR retention windows agreed (per table, in writing) — legal sign-off before Phase 3.

### Order within the phase

1. **MSISDN normalizer + DB CHECK.** Everything below stores MSISDNs; the normalizer must exist first.
2. **Schema migrations** for the new tables (feature row, credit profile, score history, two snapshot tables, log columns, status enum). One migration PR per table, reviewable independently.
3. **`SYSTEM_CONFIG` seed** for `csdp.*` keys at scoring §11 defaults.
4. **Golden tests** wired into CI against a pure-function implementation of `heuristic_v3` (no DB, no HTTP — just inputs → expected outputs). This proves the spec and the test fixtures agree before any wiring.
5. **Caller inventory** — grep `MnoService.checkEligibility` and `creditScoreService.calculateEligibleLoanAmount`. Document every call site. Decide whether `MnoService` survives Phase 4 deletion (R-3).
6. **Retention policy doc** — per-table windows for `csdp_eligibility_log`, `csdp_cdr_*`, `csdp_webhook_inbound_log`, snapshot tables. Get legal sign-off in writing.

### Exit criteria

- [ ] All new tables migrated on staging; `\d+` matches the spec.
- [ ] `normalizeMsisdn` is the only writer to MSISDN columns, enforced by DB CHECK.
- [ ] Golden tests are green and gating PR merges.
- [ ] `csdp.*` config keys are present in `SYSTEM_CONFIG` with documented owners.
- [ ] Caller inventory + retention policy committed to the repo.
- [ ] No production traffic touches any new table yet.

### What does not move yet

- Profile endpoint behavior is unchanged. The endpoint is already `GET /csdp/profile` (changed earlier); response shape and decision logic stay as they are today until Phase 3 aligns them to the Airtel contract.
- `EligibilityLinkingProcessor` does not run yet.
- No webhook handler changes.
- No admin UI changes.
- `MnoService` and legacy `CreditScoreService` are still live for any non-Airtel callers.

---

## Phase 2 — Algorithm + linking (offline shadow only)

**Goal:** `heuristic_v3` runs end-to-end against real subscriber data, but **no customer-visible decision changes**.

### What ships

- `csdp-scoring` module (or extension of `csdp-eligibility`) implementing scoring §4–§7 stages.
- Feature-row materializer: live writers per the §5.4 mapping (webhooks update specific columns) and the daily `EligibilityLinkingProcessor` repair pass.
- **`EligibilityLinkingProcessor` daily job** at **03:00 Africa/Lagos (WAT)** — wins on conflict, repairs drift, appends `csdp_credit_score_history` rows.
- **15-min hot-subscriber refresh** for active MSISDNs (§12 R-1 — confirm with product). Either a separate Bull queue or a piggyback on `EligibilityLinkingProcessor` with a hot-cohort filter.
- **Aging job** (hourly, separate worker): `ISSUED`/`PARTIAL` past 30 d → `DEFAULTED`; full repayment → `RECOVERED`. Maintains `uncured_default_exists`.
- Webhook idempotency upserts (scoring §10): unique on `loan_id` (fulfillment), `(recovery_id, loan_id)` per line item (recovery), `trans_ref` (Profile).
- **Two-point snapshotting**: `eligibility_features_snapshot` written at Profile time, `loan_features_snapshot` written at fulfillment with copy-from-trans_ref + fallback rematerialization with `snapshot_mismatch = true`.
- Redis live counters for `our_disbursed_24h_naira` (§12 R-2 if accepted) and `eligibility_checks_1h`.
- `system_exposure_pct` Redis publisher: a small worker that recomputes book-outstanding-24h and writes to Redis on a tight cadence.
- Shadow harness: every Profile request runs **both** the legacy path (whatever returns today) and `heuristic_v3`, logging both decisions but returning the legacy decision. `decision_mode = "SHADOW"` written to `csdp_eligibility_log`.
- Metrics + alerts: `csdp.snapshot_mismatch_count`, `EligibilityLinkingProcessor` last-success, aging-job lag, Profile p99 latency, config-cache TTL exceeded.

### Order within the phase

1. **Feature-row materializer**, daily job only (no live writers yet). Run on staging against a fixture; verify it produces correct rows. This is the single most important deliverable — get it right first.
2. **Aging job.** Independent of scoring; needed for `uncured_default_exists` to be truthful before any score is computed.
3. **Webhook idempotency upserts.** Even before scoring is wired, idempotent webhook handling means no replay-induced drift while you build the rest.
4. **Live writers** for the columns marked "live" in §5.4 (fulfillment +=, recovery −=, etc.). The daily job now repairs any divergence overnight.
5. **Redis live counters** for `our_disbursed_24h_naira` and `eligibility_checks_1h`. Wire publishers and readers.
6. **`system_exposure_pct` Redis publisher.**
7. **`csdp-scoring` module** implementing Stages 1–4. Unit-test every stage against the §4.2 golden vectors before integrating.
8. **Profile-time integration**: write `eligibility_features_snapshot`, write `csdp_eligibility_log` with `score_components`, but **do not change the response yet** — log only.
9. **Fulfillment-time integration**: write `loan_features_snapshot`, copy from `trans_ref` if present, fall back with `snapshot_mismatch = true`.
10. **Shadow comparison**: log `(legacy_decision, heuristic_v3_decision, diff)` to a comparison table or structured log. Sample dashboard.
11. **Runbooks live** for the four alert types above.

### Exit criteria

- [ ] Feature rows for every MSISDN with activity in the last 30 d are within 24 h of fresh, verified by spot-checking against source tables.
- [ ] Aging job has converted at least one synthetic 30 d-old `ISSUED` loan to `DEFAULTED` and verified `uncured_default_exists = true` on the feature row.
- [ ] Replaying a fulfillment webhook + recovery webhook does not produce duplicate rows or double-update `recovered_kobo`.
- [ ] `EligibilityLinkingProcessor` 03:00 WAT run completes within its budget on a representative subscriber population; alert fires if it doesn't.
- [ ] All scoring §4.2 golden vectors are reproduced by the live `csdp-scoring` module on staging.
- [ ] Shadow log shows `heuristic_v3` decisions for ≥ 7 days of staging traffic with no error rate.
- [ ] **Snapshot-mismatch rate < 1 %** on shadow traffic (scoring §10; §12 R-6).
- [ ] Profile p99 latency in shadow mode is well under the 1.5 s budget (target: < 500 ms p99 at this stage).

### What does not move yet

- Profile endpoint **method, URL, request shape, and response shape are unchanged**. Customers see the same thing.
- No Airtel-facing wire contract change.
- No admin UI changes.
- No legacy code deleted.

---

## Phase 3 — Wire contract + rollout (customer-visible)

**Goal:** Airtel calls the new contract; `heuristic_v3` decisions become customer-visible behind a percentage rollout flag.

### What ships

- **`GET /csdp/profile` aligned to Airtel contract** ([AIRTEL_CSDP_INTEGRATION_API.md](./AIRTEL_CSDP_INTEGRATION_API.md)) — confirm query params (`msisdn`, `da`, `trans_ref`, `type`) match and the response is `{ "message": "<integer Naira as string>" }` in Naira. The endpoint already exists as GET; this phase finalizes the **shape** (query-param names, Naira-as-string response, `message` key) so Airtel UAT passes.
- Any remaining internal callers on the old `POST /csdp/eligibility` either migrated to `GET /csdp/profile` or that route is removed.
- **Webhook contract alignment** — fulfillment + recovery payload field-name mapping per Airtel spec, including `type` discriminator if Airtel uses a single URL.
- **Outbound integration client** (only if Airtel kickoff confirms RIM must POST callbacks to Airtel — else not needed).
- **`decision_mode` flag** wired to `csdp_feature_flag`: `SHADOW` → `LIVE_5` (5 % traffic) → `LIVE_50` → `LIVE`. Each promotion is a feature-flag flip, not a deploy.
- **Cold-start cliff product decision** implemented (continuity bonus or no cold-start) — must land **before LIVE_5** per §12 R-9.
- **`SYSTEM_CONFIG` cache** with TTL + degraded-behavior fallback (deny-all or safe-defaults) wired and tested via a chaos drill.
- Shadow-vs-live comparison dashboards per slice (loan_type, MSISDN cohort) — risk team uses these to sign off on each promotion.

### Order within the phase

1. **`GET /csdp/profile` shape alignment** — query-param names + validation (`msisdn`, `da`, `trans_ref`, `type`), MSISDN normalization on the way in, response body `{ "message": "<naira-int-as-string>" }` on the way out. Endpoint method/route already correct; this step is contract polish + wiring it to call `csdp-scoring` from Phase 2.
2. **Contract tests** (golden request/response) for Profile and webhooks, derived from the Airtel doc samples. Failing test = blocks deploy.
3. **Webhook payload mapping** — align `LoanWebhookDto` and `RecoveryWebhookDto` field names to Airtel's `type` / `request_type` discriminator if needed.
4. **Cold-start cliff product call** — implement whichever direction product chooses. If continuity bonus, add as a §5 cold-start branch and add golden tests for the cliff cohort.
5. **Config cache TTL drill** — kill `SYSTEM_CONFIG` reads in staging, verify degraded behavior fires the alert and serves the agreed fallback.
6. **Promote `decision_mode = LIVE_5`** for a chosen MSISDN slice. Watch the comparison dashboards for ~7 days.
7. **Promote `LIVE_50`**, then **`LIVE`** — at each step, sign-off from risk + product against the shadow dashboards. No promotion without a documented sign-off.

### Exit criteria

- [ ] Airtel UAT passes against `GET /csdp/profile` — both shape and numbers.
- [ ] Webhook payload mapping verified end-to-end with Airtel's test traffic.
- [ ] Snapshot-mismatch rate < 1 % on **live** traffic (scoring §10; §12 R-6 hard gate).
- [ ] `decision_mode = LIVE` with `heuristic_v3` answering 100 % of Profile traffic for at least 7 days, no Sev-1 incidents.
- [ ] Default rate, approval rate, and labelled-data accumulation tracking against the targets in stakeholder doc §"What success looks like" (≤ 5 % default, partner SLA met, training-data flow validated).
- [ ] NDPR retention enforcement live on `csdp_eligibility_log`, snapshots, and `csdp_cdr_*`.

### What does not move yet

- Legacy `LoansPage` / `UsersPage` / `components/loans/*` may still be live for back-office investigation (no harm — they are read-only of the soon-to-be-deleted tables).
- `credit-score`, `loans`, `transactions` modules still in the codebase. Removal happens in Phase 4 once it is safe.
- ML upgrade path (scoring §14) is post-Phase-4; do not start until 60–90 d of clean labels are in.

---

## Phase 4 — Admin UI + cleanup

**Goal:** ops can run, tune, and explain the system without engineers; legacy code and tables are deleted.

### What ships

- **Scoring-ops admin UI** (parallel to legacy lending parity):
  - `SYSTEM_CONFIG` editor for every `csdp.*` key (scoring §11), with type validation, ranges, audit, and RBAC scope `csdp:config:write`.
  - Per-MSISDN decision explainer (renders `score_components` JSONB).
  - Eligibility-log explorer (filters: `gate_failed`, `decision_mode`, `model_version`, `snapshot_mismatch`).
  - Exposure dashboard (real-time `system_exposure_pct`, taper visualization, book-outstanding 24 h).
  - Cold-start cohort tracker (Adaeze→Tunde funnel).
  - Loan state machine view (per-MSISDN ISSUED/PARTIAL/RECOVERED/DEFAULTED transitions).
  - Snapshot-mismatch alarm panel.
  - `EligibilityLinkingProcessor` + aging-job health view.
  - Webhook replay tool.
- **Lending-parity admin UI** for any back-office flow currently on `LoansPage` / `UsersPage` that is still needed — keyed by MSISDN, not `User.id`.
- **`NOTIFICATIONS.RelatedEntityType` enum extended** for `csdp_subscriber`, `csdp_loan`, `csdp_recovery` etc.; writers + UI updated. **Must precede legacy table drops.**
- **`ADMIN_ACTIVITY_LOGS` resource enum extended** for csdp entities; new `csdp:*` permission scopes in `ADMIN_ROLES`.
- **Deletes** (in this order):
  1. `MnoService.checkEligibility` (if Phase 1 caller inventory found zero callers).
  2. `credit-score` module (logic absorbed into `csdp-scoring`).
  3. `loans` and `transactions` modules (for the operator segment — confirm no remaining readers).
  4. Borrower paths in `users` (admin-only auth surface remains).
- **DDL drops** (in this FK order, after code drops):
  1. `CREDIT_SCORE_HISTORY`
  2. `TRANSACTIONS`
  3. `LOANS`
  4. Borrower rows / table for `USERS` (keep `ADMIN_USERS` etc.)
  5. Legacy `credit_score.*` / `loan.*` rows in `SYSTEM_CONFIG`.

### Order within the phase

1. **Scoring-ops UI first** — ops needs visibility before legacy back-office tools are removed, otherwise you open a window with no admin recourse.
2. **Notifications + activity-log enum extensions** — these are precondition migrations for the deletes that follow.
3. **Lending-parity UI** for whatever the back-office actually still uses (do this last in the UI track — much of the legacy admin surface may already be obsolete by now).
4. **Code deletes** (4 sub-deletes above). Each is its own PR, reviewed against the caller inventory from Phase 1.
5. **DDL drops** (5 sub-drops above). Each is its own migration. **Verify staging row counts first** even though tables are expected empty.
6. **Post-cleanup audit**: grep for `User.id`, `creditScore`, `transactionId`, `Loan` imports across the repo. Flag any survivors.

### Exit criteria

- [ ] Risk + ops can tune any `csdp.*` key and explain any single denial without engineering involvement.
- [ ] No code references `User`, `Loan`, `Transaction`, or `CREDIT_SCORE_HISTORY` for borrower flows.
- [ ] Legacy DDL dropped on staging and prod; no FK orphans.
- [ ] All notifications and activity-log entries continue to deep-link correctly post-drop.
- [ ] CI green; full test suite passes; production stable for ≥ 7 days post-cleanup.

### What does not move yet

- v2 supervised model (scoring §14) — separate workstream, starts after 60–90 d of clean labels.

---

## Cross-phase invariants

These hold from Phase 1 onwards and are non-negotiable.

- **MSISDN canonical form is `234XXXXXXXXXX`** in every column, enforced by DB CHECK. Display formatting only at boundaries.
- **`SYSTEM_CONFIG` keys are `csdp.*`-namespaced.** Legacy `credit_score.*` / `loan.*` keys are read by no new code.
- **Idempotency keys are fixed:** Profile = `trans_ref`, fulfillment = `loan_id`, recovery = `(recovery_id, loan_id)` per line item. Never bridge to legacy `transactionId`.
- **Daily 03:00 WAT `EligibilityLinkingProcessor` wins on feature-row conflicts.** Live writers exist for freshness; the daily job exists for correctness.
- **`csdp_eligibility_log.score_components` schema is the v2 training schema.** Don't break it without ML sign-off.
- **No customer-visible behavior change without a `decision_mode` promotion + sign-off.** Code can ship dark; promotions are explicit.
- **Snapshot-mismatch > 1 % is an incident, not noise.**

---

## Quick phase summary

| Phase | One-line goal | Who feels the change |
|-------|---------------|----------------------|
| 1 | Schema, normalizer, golden tests in place | Engineering only |
| 2 | `heuristic_v3` runs in shadow against real data | Engineering + risk (dashboards) |
| 3 | Airtel sees the new contract; live decisions migrate behind flags | Customers (gradually) + Airtel |
| 4 | Ops can self-serve; legacy code and tables deleted | Admin / back-office users |

---

*Document version: 1.0 — companion phasing for [CSDP_HUB_MIGRATION_PLAN.md](./CSDP_HUB_MIGRATION_PLAN.md) v1.9.*
