# CSDP as application hub — migration plan

**Audience:** engineering and product  
**Status:** draft plan for alignment (not committed delivery dates)  
**Related docs:** [Ussd loan Callback.md](./Ussd%20loan%20Callback.md), [CREDIT_SCORE_MULTIPLIER_SYSTEM.md](./CREDIT_SCORE_MULTIPLIER_SYSTEM.md), [**Airtel — CSDP Integration API**](./AIRTEL_CSDP_INTEGRATION_API.md) (**authoritative partner wire spec** — what Airtel expects RIM to follow), plus **§2.7** in this doc (summary + gap vs repo).

---

## 1. Intent

Consolidate RIM around **CSDP (carrier / integration layer)** as the **primary hub** of the application: identity and lending truth keyed for **MNO workflows** (e.g. MSISDN-first), **Airtel file ingest**, eligibility, and—over time—**scoring and lifecycle** that today live under separate modules (`users`, `loans`, `transactions`, `credit-score`, parts of `mno`).

**Near-term goal (target: order of weeks):** deprecate redundant paths where they duplicate CSDP responsibilities, and **port the discrete scoring / limit behaviors** defined in **`CreditScoreService`** (see **§4.1 U1–U8** — not one monolith), under the CSDP umbrella, with **§4.2** parity gates and **§2.6 / §6.1** phased work (**Pre-P0 → P0a → P0b**).

**Production data note:** There is **no production borrower data** in `USERS` or `LOANS` today, and **no production rows to migrate** from `CREDIT_SCORE_HISTORY` for borrower score audit (same “empty legacy” assumption unless staging proves otherwise). The plan therefore **does not** rely on **migrating historical score rows** — focus is **porting algorithms and wiring**, **new** `csdp_credit_score_history` (or equivalent) for **future** audit, optional **DDL**, and **retiring unused core code/tables** when safe.

---

## 2. Current architecture (two paths)

### 2.1 Core RIM path

- **Entities:** `User`, `Loan`, `Transaction`, etc. (default TypeORM connection).
- **Scoring / limits:** `CreditScoreService` — thresholds, repayment-based points, system config (`credit_score.*`, `loan.*`), first-time user defaults, interest/repayment period helpers as documented in existing docs.
- **Eligibility example:** `MnoService` resolves a subscriber to `User` and calls `calculateEligibleLoanAmount(user.id)`.

### 2.2 CSDP path

- **Entities:** `csdp_*` tables (e.g. `csdp_subscriber`, `csdp_loan`, `csdp_recovery`, ingest batches, CDR tables, eligibility logs).
- **DB:** Named connections `csdpHot` / `csdpBatch` (optional separate URLs; may fall back to same Postgres in dev).
- **Eligibility (Profile):** `POST /csdp/eligibility` → `DecisionRouterService` — feature-flagged modes; **today** effective limit path is **Teamwee proxy** for several modes, with **`rimLimitKobo` intentionally null** until a RIM engine is implemented there. **Airtel’s published Profile contract differs** (GET, query params, `{ message }` in **Naira**) — see **§2.7**.
- **Ingest:** Airtel (and similar) files → `csdp_ingest_batch` → `ingest.processor` → parsed rows and **`CsdpLoan` / CDR / recovery** persistence — **integration-shaped** truth, not wired to core `Loan` / `User` in this pipeline.

### 2.3 Gap

We maintain **parallel models** and **parallel eligibility philosophy**: core app is **user-id-centric** with full scoring; CSDP is **MSISDN-centric** with operator ingest and Teamwee-backed limits. That increases cognitive load and duplicate “sources of truth” risk unless we **converge deliberately**.

### 2.4 `MnoService` — load-bearing bridge (MSISDN → `User` today)

For MNO-facing eligibility that still goes through the **default** stack, **`MnoService.checkEligibility`** is the **only** place that ties a phone number to RIM scoring today: it normalizes the phone, **`findByPhone` → `User`**, checks `user.status`, then calls **`creditScoreService.calculateEligibleLoanAmount(user.id)`**. There is no parallel path inside that method for `csdp_subscriber` or CSDP scoring.

```72:116:rim-admin-backend/src/modules/mno/services/mno.service.ts
      // Find user by phone number
      const user = await this.userRepository.findByPhone(normalizedPhone);
      if (!user) {
        return {
          status: 'error',
          message: `Subscriber not found for phone number: ${normalizedPhone}`,
          errorCode: 'SUBSCRIBER_NOT_FOUND',
          requestId: request.requestId,
        };
      }

      // Check if user is active
      if (user.status !== 'active') {
        return {
          status: 'error',
          message: `Subscriber account is ${user.status}`,
          errorCode: 'SUBSCRIBER_INACTIVE',
          requestId: request.requestId,
        };
      }

      // Calculate eligible loan amount based on credit score
      let eligibleAmount: number;
      try {
        eligibleAmount =
          await this.creditScoreService.calculateEligibleLoanAmount(user.id);
        this.logger.log(
          { userId: user.id, eligibleAmount },
          'Calculated eligible loan amount',
        );
      } catch (error) {
        this.logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            userId: user.id,
          },
          'Error calculating eligible loan amount',
        );
        return {
          status: 'error',
          message: 'Unable to calculate eligible loan amount',
          errorCode: 'CALCULATION_ERROR',
          requestId: request.requestId,
        };
      }
```

The **load-bearing seam** is **`calculateEligibleLoanAmount(user.id)`** (lines **96–97** in the file above): MNO eligibility is **`User.id`**, not MSISDN-native CSDP state, until **§2.6** is implemented.

Any “linear” story that still serves **MNO callers hitting this code path** must **explicitly** replace or branch this seam: **MSISDN → who gets scored** cannot stay implicitly “must exist in `USERS`” if the hub is CSDP.

### 2.5 Prerequisite for **P1** — routing, flags, and shadow comparison

**P1** (“eligibility uses RIM limit behind flags”) is **blocked** until the plan below is written, reviewed, and implemented — not only until `DecisionRouterService` returns a non-null `rimLimitKobo` for `/csdp/eligibility`.

| Step | What to deliver |
|------|-----------------|
| **1. Inventory callers** | List every production entry point for eligibility: `POST /csdp/eligibility`, **`MnoService.checkEligibility`**, USSD or other gateways — and which MSISDN segments each serves. |
| **2. Single routing story** | Under a **feature flag** (reuse or extend `csdp_feature_flag` / config): same logical request either (a) keeps today’s `User` + `CreditScoreService` path, (b) resolves **`csdp_subscriber`** by MSISDN and calls **ported CSDP scoring**, or (c) dual-read for shadow. **`MnoService` must participate** if MNO traffic still uses it — otherwise P1 ships only for Airtel API and leaves the bridge broken. |
| **3. Shadow comparison** | When Teamwee (or legacy limit) and RIM/CSDP limits both run: log structured diffs (msisdn hashed, trans ref, both limits, latency), metrics, and optional sampling dashboards — **before** any `LIVE_*` percentage routes customer-visible outcome to RIM-only. |
| **4. Response contract** | Confirm each caller’s expected shape (Naira vs kobo, error codes when subscriber missing from `csdp_subscriber` vs `USERS`) so switching the router does not silently change partner behavior. |

Until **§2.5 steps 1–3** are done, treat **P1 as at risk**: implementing RIM only inside `DecisionRouterService` without **`MnoService`** alignment does **not** migrate the load-bearing bridge.

### 2.6 Bridge during transition — `MnoService` vs `POST /csdp/eligibility`

Today **`MnoService.checkEligibility`** ends in **`creditScoreService.calculateEligibleLoanAmount(user.id)`** (see §2.4). **`POST /csdp/eligibility`** is a **separate** HTTP surface with **`DecisionRouterService`** (Teamwee / stub RIM). The plan must **name** how both behave while flags roll out — not leave it implicit.

| Strategy | Description | When to use |
|----------|-------------|-------------|
| **A — Single scoring service, dual persistence** | One injected “eligibility limit” service: under flag reads **`User`** + old repos **or** **`csdp_subscriber`** + profile + `csdp_loan` outstanding, same **pure** threshold math. **`MnoService`** and CSDP eligibility **both** call it (adapter translates `user.id` vs MSISDN). | Minimize duplicate math; clear parity surface for tests. |
| **B — MNO calls CSDP path internally** | `MnoService` resolves MSISDN → invokes same use-case as `/csdp/eligibility` (in-process), maps response to MNO DTO. | One HTTP-less code path for “operator limit”; stricter coupling to CSDP module. |
| **C — Parallel endpoints until cutover** | Keep **`MnoService`** on `CreditScoreService` until P1b; only Airtel API uses new stack first. | Higher drift risk; only if MNO and Airtel release schedules differ. |

**Product/engineering must pick A, B, or C (or a documented hybrid)** before flipping production flags so teams do not assume “P1 shipped” when only one entry point moved.

### 2.7 Airtel CSDP Integration API — partner contract (why this was missing earlier)

**Canonical spec (what Airtel wants RIM to follow):** [./AIRTEL_CSDP_INTEGRATION_API.md](./AIRTEL_CSDP_INTEGRATION_API.md) — keep that file aligned with the **official** Airtel document (PDF / portal); this section is a **short summary + implementation gaps**.

Earlier versions of this plan were written mainly from **in-repo code** (`csdp/*`, `CreditScoreService`, `MnoService`) and internal migrations. They did **not** embed Airtel’s **external** integration memo — so **wire format**, **HTTP verbs**, and **who calls whom** were under-specified. **§2.7 + the linked doc** capture the contract Airtel expects RIM to align with.

**Clarify with Airtel (one-time integration kickoff):** For each numbered flow below, confirm whether **RIM hosts** the URL (inbound from Airtel) or **RIM calls** a URL Airtel gives you. The template text “Endpoint: [to be provided by partner]” is ambiguous; delivery depends on that answer.

#### 1. Profile (eligibility / limit)

| Item | Airtel spec (contract) | RIM today (typical) | Gap / action |
|------|------------------------|---------------------|--------------|
| **Trigger** | Called when customer requests a loan | `POST /csdp/eligibility` (API-key auth) | May need **GET + query** façade or reverse proxy mapping if Airtel cannot POST JSON. |
| **Method** | **GET** | **POST** | Add **GET** handler or gateway rules; document exception if Airtel accepts POST. |
| **Inputs** | `msisdn` (234… 13), `da` (int, **kobo**), `trans_ref`, `type` = AIRTIME \| DATA \| TALKTIME | Body: `msisdn`, `trans_ref`, **`da_kobo`** (string), **`loan_type`** | Rename / alias DTO fields; validate `da` int vs string bigint. |
| **Output** | JSON with **single string** limit in **`message`**, value in **Naira** | JSON **`{ "limit": "<string>" }`**; router often thinks in **kobo** internally (see `DecisionRouterService` TODOs) | **Convert to Naira** for partner-visible response; use key **`message`** if spec is strict; confirm “plain text vs JSON” (spec shows JSON). |

#### 2. Loan notification (fulfillment)

| Item | Airtel spec | RIM today | Gap / action |
|------|-------------|-----------|----------------|
| **Purpose** | Notify when a **new loan** is given | `POST /csdp/webhooks/loan` **inbound** DTO (`LoanWebhookDto`: `loan_id`, `msisdn`, `vendor`, `loan_type`, `principal_naira`, `repayable_naira`, `status`, `trans_ref`, `issued_at`, …) | Field names and shapes differ (`amount` / `max_amount` / `trans_datetime` / `transaction_type` / `type: fulfillment` / `status: success`). Map **spec → DTO** or version webhooks. |
| **Method** | POST | POST | OK; **payload contract** must match. |

#### 3. Recovery notification (repayment)

| Item | Airtel spec | RIM today | Gap / action |
|------|-------------|-----------|----------------|
| **Purpose** | Same **URL** as loan notification; distinguish by **`type`** = `repayment` (spec) vs fulfillment | Separate routes: `POST /csdp/webhooks/recovery` | Either **unify** routes per Airtel “single URL” rule or document **path-based** split as accepted variance. |
| **Body** | `recovery_id`, `loans[]`, `type` / `request_type` (samples use mixed naming — **confirm canonical**) | `RecoveryWebhookDto` + processor | Align enums and **loan item** shape (`id`, `paid`, `amount`, `partner` vs `loan_id`, `amount_applied_kobo`). |

#### Hub / migration implications

- **P1 eligibility** is not only “RIM math vs Teamwee” — it must **emit a partner-compliant Profile response** (Naira + `message` + method/shape) or Airtel integration **fails UAT** regardless of scoring correctness.
- **Scoring port (§4)** feeds **numbers**; **§2.7** feeds **wire contract** — both are **P0/P1** concerns; do not conflate them.
- **Outbound vs inbound:** If Airtel’s doc describes **callbacks RIM must invoke** (RIM → Airtel HTTP client), that work is **not** covered by inbound `csdp/webhooks/*` alone — track as **integration client** tasks (config: base URL, auth, retries).
- Add **contract tests** (golden request/response) for Profile + webhooks alongside **§4.2** parity tests.

---

## 3. Target architecture (CSDP as hub)

### 3.1 Principles

1. **Single canonical lending model for operator-driven customers** — prefer **`csdp_subscriber` + `csdp_loan` + related tables** (or renamed equivalents) as system of record for that segment, rather than permanent dual writes to `User` / `Loan`.
2. **Scoring lives under CSDP** — new or moved services (e.g. `csdp-scoring` or extension of `csdp-eligibility`) implement the **same business rules** currently in `CreditScoreService`, backed by **subscriber-level** (or dedicated) persisted state, not only ephemeral requests.
3. **Ingest remains the operator tape** — daily dumps stay the **authoritative input for reconciliation and audit**; they do not automatically replace a **designed** loan lifecycle unless product rules say so.
4. **Deprecate old modules by vertical slice** — remove `users` / `loans` / `transactions` / `credit-score` **only after** read paths, writes, admin UI, and migrations are replaced for each slice.

### 3.2 What “hub” does *not* mean

- **Not** “copy every CDR line into a core `Loan` row” without rules — that creates noise and drift.
- **Not** a folder rename only — behavior and data must follow.

---

## 4. Scoring port (under CSDP umbrella)

`CreditScoreService` is **not** one algorithm — it is a **cluster of distinct behaviors** with different **User / Loan / Transaction** coupling. Each row below is a **separate port unit** with its own adapter or rewrite plan (see [Ussd loan Callback.md](./Ussd%20loan%20Callback.md), [CREDIT_SCORE_MULTIPLIER_SYSTEM.md](./CREDIT_SCORE_MULTIPLIER_SYSTEM.md)).

**Verbal checklist → §4.1 units (for searchability):**

| How people describe the work | §4.1 unit(s) | Notes |
|-------------------------------|--------------|--------|
| Threshold band lookup (`credit_score.thresholds`) | **U1** | Part of eligibility-from-score. |
| First-time user default (`loan.first_time_user_amount`) | **U2** | `totalLoans === 0` branch. |
| `calculateEligibleLoanAmount` (cap, outstanding, cache) | **U3** | Composes U1/U2 + **active `Loan`** outstanding + Redis. |
| Repayment amount / duration tiers + multipliers | **U4** | `calculatePointsForRepayment` — **pure** config math. |
| `awardPointsForRepayment` (orchestration + side effects) | **U5** (uses **U4**) | **Rewrite**, not extract — `User` / `Loan` / `Transaction` / history. |
| Interest rate helpers (`loan.interest_rate.*`) | **U6** | |
| Repayment period helpers (`loan.repayment_period.*`) | **U7** | |

### 4.1 Discrete port units (from `credit-score.service.ts`)

| Unit | Primary API / helpers | `SYSTEM_CONFIG` (and related) keys | Coupling today | Port shape | CSDP-side notes |
|------|----------------------|-----------------------------------|------------------|------------|-----------------|
| **U1 — Threshold → base limit** | `calculateEligibleLoanAmountFromScore` (threshold loop) | `credit_score.thresholds` | `User.creditScore`, `User.totalLoans` | **Extract** pure ranking logic; **adapter** supplies score + “first loan?” | Subscriber/profile holds score + loan count analog. |
| **U2 — First-time default amount** | same path when `totalLoans === 0` | `loan.first_time_user_amount` | `User.totalLoans` | **Extract** + **adapter** | Map “first-time subscriber” rule to `csdp_subscriber` / profile fields. |
| **U3 — Eligible amount after caps & outstanding** | `calculateEligibleLoanAmount` | (uses U1/U2) + `User.creditLimit`, `User.autoLimitEnabled` + **active `Loan`** rows | Loads `User`, **queries active loans**, subtracts `outstandingAmount`, **Redis cache** `usersCacheService` | **Adapter-heavy extract**: math portable; **outstanding sum** must query **`csdp_loan`** (or defined equivalent); cache key → MSISDN or subscriber PK. |
| **U4 — Repayment points math** | `calculatePointsForRepayment`, tier helpers | `credit_score.repayment_scoring` | **None** (primitives in / points out) | **True extract** | Easiest spike candidate (**P0a**): prove config + pure function under test. |
| **U5 — Repayment orchestration + side effects** | `awardPointsForRepayment` | (uses U4) + writes history | **`Transaction`** (REPAYMENT+COMPLETED), **`Loan`** read/write, **`User`** read/write, **`CREDIT_SCORE_HISTORY`**, dedupe by `transactionId` | **Rewrite**, not extract | Re-implement on `csdp_recovery` / webhooks / payment events, update `csdp_loan` + subscriber/profile, append `csdp_credit_score_history`; idempotency key is **not** legacy `transactionId` unless you bridge IDs. |
| **U6 — Interest rate tier** | `calculateInterestRateByCreditScore` | `loan.interest_rate.default`, `loan.interest_rate.tiers`, `loan.interest_rate.min`, `loan.interest_rate.max` | `User.creditScore` | **Extract** + **adapter** | Input = subscriber score. |
| **U7 — Repayment period tier** | `calculateRepaymentPeriodByCreditScore` | `loan.repayment_period.*` | `User.creditScore` | **Extract** + **adapter** | Same as U6. |
| **U8 — Score history read (admin)** | `getCreditScoreHistory` | — | `userId` → `CREDIT_SCORE_HISTORY` | **Adapter** | New **`csdp_credit_score_history`** read API keyed by MSISDN; **no legacy rows to migrate** if table empty (§1). |

**Important:** §4.3’s phased port assumes **extract** for **U1, U2, U4, U6, U7** only. **`awardPointsForRepayment` (U5)** **reads and mutates** `User`, `Loan`, and `Transaction` and **writes** score history — that is **not** a clean extract; treat it as a **rewrite** against CSDP equivalents with a **new** idempotency and persistence story.

### 4.2 Characterization / parity tests (mandatory gate, not optional risk text)

Before swapping production callers away from `CreditScoreService`:

1. **Build characterization (golden) tests** against the **current** implementation for **each port unit** (U1–U8 as applicable): fixed config fixtures + fixed inputs → expected outputs (amount, points, rate, days, side-effect expectations where mocked).
2. **Run the same vectors** on the CSDP implementation until they match, or **document signed product deltas** where behavior intentionally changes.
3. **Land these tests in CI on `main` early** — treat them as **Pre-P0 / P0b exit criteria**, not a single bullet in §7 only.

### 4.3 Implementation strategy (after spike)

1. **P0a spike first** — prove end-to-end adapter shape for **one** unit (recommended: **U4** pure math, or **U1+U2** eligibility slice without full U5).
2. **P0b port remaining units** with **§4.2** parity suite per unit; avoid one mega-PR.
3. **`csdp-scoring` module** (or nested under `csdp-eligibility`) — injectable from `DecisionRouterService` and from **`MnoService`** path per **§2.6**.
4. **Persistence** — **only** schema locked in **§10.1**. No `USERS`/`LOANS` row backfill (§1).
5. **Eligibility latency** — `rimLimitKobo` path must respect existing hard budgets where applicable.
6. **DB connections** — document `csdpHot` vs default for reads/writes; **`SYSTEM_CONFIG`** lives on the **default** DB connection today — CSDP scoring must **read config** accordingly (see §4.4).

### 4.4 `SYSTEM_CONFIG`: shared keys vs CSDP-namespaced keys

`CreditScoreService` reads category/key paths such as **`credit_score.thresholds`**, **`credit_score.repayment_scoring`**, **`loan.first_time_user_amount`**, **`loan.interest_rate.*`**, **`loan.repayment_period.*`** from **`SYSTEM_CONFIG`** (table stays — §10.4).

| Approach | Pros | Cons |
|----------|------|------|
| **Shared keys (reuse existing paths)** | One admin surface for ops; safe **shadow** compare: old and new code read **identical** config during flag flip. | CSDP and legacy code must agree on semantics until legacy deleted. |
| **CSDP-prefixed keys** (e.g. `csdp.credit_score.thresholds`) | Clear ownership boundary. | **Dual-write or migration** of admin UI + risk of drift during transition unless you **mirror** or **read-through** old keys. |
| **Hybrid** | New keys only for CSDP-only knobs. | Document precedence to avoid ambiguous merges. |

**Record the choice in the same ADR as §2.6 / §10.1.** It directly affects whether you can flip flags **safely** while two code paths coexist.

---

## 5. Ingest and daily Airtel dumps

**Role:** **Operator-supplied data plane** — batches (`csdp_ingest_batch`), rows, CDR tables, vendor loan/recovery mapping inside `ingest.processor`.

**Relationship to scoring:**

- Ingest **feeds reconciliation, investigations, and loan/recovery state** in the CSDP model.
- **Scoring** should depend on **clear events** (repayment settled, loan closed, etc.), not raw dump lines alone, unless product defines features from CDRs.

**Recommendation:** keep ingest as **source of truth for “what Airtel sent”**; drive score updates from **normalized lifecycle events** derived from ingest + webhooks, with idempotent processing.

---

## 6. Deprecation of other modules

### 6.1 Order of work (suggested)

The plan **does not** jump straight from “Pre-P0” to “ship all of P0”: **coupling in U5** and multiple discrete units (**§4.1**) require a **spike** and **characterization tests** as explicit gates.

| Phase | Focus | Exit criteria |
|-------|--------|----------------|
| **Pre-P0** | **§10.1** schema lock; **§2.6** MNO bridge strategy (A/B/C); **§4.4** `SYSTEM_CONFIG` shared vs namespaced keys (ADR); **§4.2 characterization tests** — golden vectors against **current** `CreditScoreService` per port unit (U1–U8 as applicable) on `main` / CI | ADRs signed; no scoring DDL until then; failing parity suite **blocks** P0b merges for that unit |
| **P0a** | **Spike** — prove adapter shape for **one** unit end-to-end on CSDP stack (recommended **U4** pure math, or **U1+U2** without U5) | Short write-up + branch/demo; validates persistence + config read path |
| **P0b** | Port **remaining §4.1 units**; **`csdp-scoring`** (or equivalent); persistence §10.1; **§4.2** parity for each shipped unit; **notifications** (paragraph below — enum + writers + UI); **§2.5** routing spec approved | Parity tests green or documented deltas; P0a learnings applied; no “big bang” without per-unit coverage |
| **P1** | Eligibility: RIM limit + **§2.5** shadow (Teamwee vs RIM) **including `MnoService`** per §2.6; **§2.7** Airtel Profile wire contract (GET/query/`message`/Naira) | **§2.5 steps 1–3** complete; **Airtel UAT**-ready Profile response; MNO not stuck on `calculateEligibleLoanAmount(user.id)` alone unless strategy **C** is explicit |
| **P2** | **U5** rewrite: recovery / events → score + loan/subscriber updates on CSDP | No production dependency on core `Transaction` for that segment |
| **P3** | Admin API + **§6.3** frontend lending parity | **~3–4 weeks UI** budgeted separately |
| **P4** | Remove unused modules; optional DDL drop | **Notifications** safe (paragraph below); **no** row migration (§1) |

**Notifications (P0b — blocking before P4 drops; required before P1 if any flow emits loan/user notifications):** `RelatedEntityType` in `rim-admin-backend/src/entities/notification.entity.ts` today only allows `ticket` \| `loan` \| `transaction` \| `user`. Any new canonical entity (`csdp_subscriber`, `csdp_loan`, …) used for in-app alerts **must** be added to the enum (and DB enum migration), and **notification creation + UI resolution** updated — **before** `LOANS` / `USERS` / `TRANSACTIONS` are dropped or you **orphan** existing in-app notifications and break deep links.

### 6.2 Modules in scope for eventual removal or shrink

- `credit-score` (logic absorbed into CSDP)
- `loans`, `transactions` (for operator segment — may remain for non-operator legacy until sunset)
- `users` (for same segment — or reduced to admin-only auth if MSISDN is the only customer key)
- Overlapping `mno` paths — reconcile with **§2.6** and single eligibility entry point

*Exact list should be confirmed with product for non-Airtel channels.*

### 6.3 Frontend scope (non-trivial; do not collapse into “P3 one-liner”)

Existing CSDP UI (**`CsdpSubscribersPage`**, **`CsdpIngestPage`**, investigation flows) is **not** lending-operations parity. Legacy admin surface includes **`LoansPage`**, **`UsersPage`**, and **`components/loans/*`** — a **large** rebuild or rewrite if those routes are retired in favor of CSDP.

| Workstream | Notes |
|------------|--------|
| **Investigation (today)** | CSDP subscribers + ingest — keep; extend as needed. |
| **Lending operations (gap)** | Loan lists, approvals, status transitions, subscriber lifecycle beyond “investigate MSISDN” — **budget roughly 3–4 weeks** for UI parity alone (APIs, tables, forms, permissions, empty states), **in addition** to backend P0–P2. |
| **Parallel track** | Start UX inventory early (**Pre-P0**): screen-by-screen map from `UsersPage` / `LoansPage` / `components/loans/*` → CSDP equivalents or explicit “not in v1”. |

Product and engineering should treat **frontend as its own phase gate**, not implicit backend completion.

---

## 7. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Timeline slip (“everything in a few weeks”) | Ship **vertical slices** (e.g. eligibility + score read first); keep old path behind flags |
| Two scoring implementations drift | **§4.2** characterization tests per **§4.1** unit; single config story **§4.4** |
| Identity mismatch (MSISDN vs `User.id`) | **MSISDN is canonical** for operator segment; no legacy `User.id` migration needed if `USERS` stays empty for borrowers |
| DB / connection split | Unify or document transactional boundaries |
| Teamwee cutover | Feature flags; shadow compare limits before full RIM-only |
| Admin UX gaps | §6.3 — scoped UI phases; **3–4 week** lending UI budget separate from API work |
| `MnoService` left on `User` path while `/csdp/eligibility` moves | **§2.5** — single routing + shadow story includes **all** eligibility entry points |
| Airtel UAT fails on **shape** not math | **§2.7** contract tests + explicit response mapping (Naira, `message`, GET vs POST) |

---

## 8. Success criteria (define with product)

Minimum **three end-to-end flows** to sign off “hub v1”:

1. **Eligibility (Profile):** MSISDN + context → **partner-compliant** limit (per **§2.7**: e.g. **Naira** in `message` if required), driven by **ported RIM scoring** (not only Teamwee) when flag says so — **and** HTTP/shape matches Airtel integration API.
2. **Loan lifecycle:** Disbursement / state visible in CSDP model; matches operator expectations.
3. **Repayment → score:** Recovery or equivalent event **updates** subscriber score / limit predictably and idempotently.

---

## 9. Open decisions (for team discussion)

- [ ] Is **any** non-operator lending kept long-term? If yes, does it stay on core `User`/`Loan` or merge into CSDP?
- [ ] Canonical **identity**: MSISDN-only for operator customers (aligned with empty `USERS` for borrowers today)?
- [ ] **Reporting and finance**: which tables are legal/ops source of truth post-cutover?
- [ ] **`SYSTEM_CONFIG` keys** (§4.4): shared `credit_score.*` / `loan.*` vs `csdp.*` namespaced — **record in ADR** before dual-stack flag days.
- [ ] **§2.6** MNO bridge: strategy A, B, or C — does `MnoService` call ported scoring, delegate to CSDP use-case, or stay on legacy until explicit cutover?
- [ ] **§2.7 Airtel Profile**: GET vs POST, `{ message }` vs `{ limit }`, **Naira** output, query param names — signed off with Airtel; façade or adapter layer in `csdp-eligibility`.
- [ ] **§2.7 Loan / recovery notifications**: single URL vs split routes; field mapping to `LoanWebhookDto` / `RecoveryWebhookDto`; outbound client if RIM must POST to Airtel.

---

## 10. Database inventory — create, drop, leave alone

Table names below match **Postgres / TypeORM `name` / `@Entity(...)`** as implemented under `rim-admin-backend/src/entities/`. **Drops are a target end-state** only after **code removal** and explicit sign-off — there is **no** requirement to ETL production rows out of `USERS`/`LOANS` if they remain empty. Never drop in isolation without resolving foreign keys.

### 10.1 Blocking schema decision (**before** P0 scoring implementation)

**Pick one persistence approach and record it (ADR or dated update to this doc) before writing scoring migrations or service code.** “Subscriber columns **or** `csdp_credit_profile` **or** both” left open **during** the port will force rework and easily burns **~1 week**.

| Option | When to choose |
|--------|----------------|
| **A — Columns on `csdp_subscriber` only** | Few fields; happy with a wider subscriber row; simplest queries for eligibility hot path. |
| **B — `csdp_credit_profile` (1:1 with MSISDN) only** | Want lending/scoring columns grouped and versioned separately from operator ingest fields on subscriber. |
| **C — Hybrid** | Only if the split is **documented** (e.g. scores on profile, counters on subscriber) — requires strict rules to avoid duplication. |

After the choice lands, **§10.2** lists concrete DDL — implement **only** that shape.

### 10.2 Tables to **create** (after §10.1 is locked)

Add via CSDP migrations once the schema choice is fixed. Names below assume **Option B** for illustration; if **Option A**, fold these columns into `csdp_subscriber` instead and omit `csdp_credit_profile`.

| Table / change | Purpose |
|----------------|--------|
| **`csdp_credit_profile`** (if Option B or C) | Subscriber-level credit state: score, limit, flags, `auto_limit_enabled`, counters — mirror semantics previously on `USERS` for lending. |
| **Extra columns on `csdp_subscriber`** (if Option A or C) | Same semantics as above when not stored in profile table. |
| **`csdp_credit_score_history`** | Append-only audit of score / limit changes (parity with `CREDIT_SCORE_HISTORY`, keyed by MSISDN / subscriber PK). |
| **`csdp_ledger`** or **`csdp_subscriber_transaction`** (optional) | Only if product needs a first-class ledger beyond `csdp_recovery` + loan status. |

### 10.3 Tables to **drop** (final phase — customer lending on default DB)

Apply **only** when the operator segment no longer reads/writes these tables through the codebase. **No production borrower migration** is in scope: if `USERS` / `LOANS` / `TRANSACTIONS` / `CREDIT_SCORE_HISTORY` are **empty**, drops are mainly **schema cleanup** after FK order is respected (still verify staging/prod once).

**Suggested drop order** (respects typical FK direction in this codebase: `CREDIT_SCORE_HISTORY` → `TRANSACTIONS` / `LOANS` / `USERS`; `TRANSACTIONS` → `LOANS` / `USERS`; `LOANS` → `USERS`):

1. `CREDIT_SCORE_HISTORY` (references `USERS`, `LOANS`, `TRANSACTIONS`)
2. `TRANSACTIONS` (references `USERS`, `LOANS`)
3. `LOANS` (references `USERS`)
4. `USERS` (borrower / app user record for the deprecated path)

**Preconditions before any drop:**

- [ ] No API, job, or admin UI references these entities for production operator flows.
- [ ] Confirm **row counts** (and compliance, if any stray test rows exist) before drop — **not** a large migration project if tables are empty.
- [ ] **`NOTIFICATIONS`** extended per **§6.1 (notifications paragraph)** — `RelatedEntityType` and consumers ready for CSDP kinds **before** dropping `user` / `loan` / `transaction` enum usage.

If **non-operator** lending must continue on `USERS` / `LOANS` / `TRANSACTIONS`, **do not drop** those tables; scope deprecation to code paths only.

### 10.4 Tables to **leave alone** (platform, admin, config, support)

Keep as the **backbone of the admin application** and shared configuration — CSDP hub does not replace these:

| Table | Role |
|-------|------|
| `ADMIN_USERS` | Staff identity |
| `ADMIN_ROLES` | RBAC |
| `ADMIN_INVITATIONS` | Onboarding admins |
| `ADMIN_ACTIVITY_LOGS` | Audit |
| `BACKUP_CODES` | MFA |
| `PENDING_LOGINS` | Admin MFA / setup flows |
| `SECURITY_SETTINGS` | Security config |
| `DEPARTMENTS` | Org structure for support |
| `SYSTEM_CONFIG` | **Keep** — scoring thresholds, multipliers, and loan config keys remain the config store unless product moves them elsewhere. **CSDP scoring must follow §4.4** (same keys vs namespaced) so flag flips stay safe. |
| `API_KEYS` | Programmatic access (including patterns used for integrations) |
| `SUPPORT_TICKETS` | Support workflow |
| `SUPPORT_AGENTS` | Agent assignment |
| `CHAT_MESSAGES` | Ticket chat |
| `TICKET_HISTORY` | Ticket audit |

**Review / evolve (usually keep table; P0 work applies):**

| Table | Notes |
|-------|--------|
| `NOTIFICATIONS` | Enum today: `ticket` \| `loan` \| `transaction` \| `user` only (`RelatedEntityType` in `notification.entity.ts`). **Extend** for CSDP-related kinds + update writers/UI **before** old entity drops (**§6.1** notifications block). |

### 10.5 CSDP tables — **leave alone** (extend, do not drop for hub strategy)

Existing operator / integration tables (already on `csdpHot` / `csdpBatch` entity sets); the hub plan **adds behavior and possibly columns**, not removal:

- `csdp_subscriber`
- `csdp_loan`
- `csdp_recovery`
- `csdp_recovery_loan_item`
- `csdp_eligibility_log` (partitioned — keep migration-owned DDL)
- `csdp_eligibility_outcome`
- `csdp_webhook_inbound_log`
- `csdp_feature_flag`
- `csdp_ingest_batch`
- `csdp_ingest_row`
- `csdp_cdr_sdp`
- `csdp_cdr_refill`
- `csdp_subscriber_discrepancy_log`

---

## 11. Summary

| Question | Direction |
|----------|-----------|
| Can CSDP ingest replace core modules by itself? | **No** — ingest stores operator data; **lending + scoring** need explicit services and lifecycle. |
| Can the whole app hub live under CSDP? | **Yes**, with a deliberate rollout: scoring ported, events wired, UI/API moved, then deprecation — **without** a `USERS`/`LOANS` data migration if those tables stay unused. |
| Few weeks realistic? | **Backend** slice needs **Pre-P0** + **P0a** + **P0b** (§6.1), not a single “P0” jump; **full admin parity** needs **§6.3** UI budget (**~3–4 weeks** lending UI alone) on top. |

---

*Document version: 1.8 — canonical [AIRTEL_CSDP_INTEGRATION_API.md](./AIRTEL_CSDP_INTEGRATION_API.md) added; migration plan links it as authoritative partner spec.*
