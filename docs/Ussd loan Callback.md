## USSD Loan Callbacks (RIM Backend)

A developer-focused guide describing how to implement the two USSD loan callbacks for **this** RIM backend:

- `/ussd/loan-offer`  
- `/ussd/loan-approve`  

Each endpoint has **two response modes**:

- **Text mode**: plain `CON` / `END` strings for the telco gateway.  
- **JSON mode**: regular JSON payloads for tests or non-USSD integrations.

This document is tailored to the current implementation of:

- `LoansService`  
- `CreditScoreService`  
- `Loan` / `User` / `Transaction` entities  

No AI/ML scoring is assumed; everything is driven by explicit rules and configuration already in the codebase.

---

## Table of contents

1. [High-level flow (RIM-specific)](#high-level-flow-rim-specific)  
2. [How scoring and limits work here](#how-scoring-and-limits-work-here)  
3. [`/ussd/loan-offer` — RIM behavior](#ussdloan-offer--rim-behavior)  
   - Request payload  
   - Inline responsibilities  
   - Example responses (Text / JSON)  
   - Pseudocode  
4. [`/ussd/loan-approve` — RIM behavior](#ussdloan-approve--rim-behavior)  
   - Request payload  
   - Inline responsibilities  
   - New approval + disbursement service  
   - Example responses (Text / JSON)  
   - Pseudocode  
5. [State, idempotency, and retries](#state-idempotency-and-retries)  
6. [Testing checklist](#testing-checklist)  

---

## High-level flow (RIM-specific)

This section restates the goal flow, but wired to how this backend actually works.

1. **User dials USSD and chooses “Loan”** from the menu.
2. **Aggregator calls `/ussd/loan-offer`** with:
   - `msisdn` (phone number)  
   - `sessionId` (telco session identifier)  
   - other fields like `serviceCode`, `text`, `network`, etc.
3. **Backend identifies the user**:
   - Looks up `User` by `phone = msisdn`.  
   - If found → we have `User.id`, `creditScore`, `creditLimit`, `totalLoans`, `totalRepaid`, etc.  
   - If not found → we either deny or branch to onboarding (business decision).
4. **Backend computes loan offers using real credit rules**:
   - Uses `CreditScoreService.calculateEligibleLoanAmount(user.id)` to find the **maximum eligible principal** based on:
     - Current `User.creditScore`  
     - Configured thresholds and limits  
     - `User.creditLimit` and outstanding loans (indirectly via limit config)
   - Uses `CreditScoreService.calculateInterestRateByCreditScore(user.id)` to get the **interest rate**.  
   - Uses `CreditScoreService.calculateRepaymentPeriodByCreditScore(user.id)` to get the **repayment period (days)**.  
   - Derives 2–4 **offer bands** (e.g. 50%, 75%, 100% of the eligible amount).  
   - **No `Loan` row is created yet**.
5. **Backend responds to `/ussd/loan-offer`**:
   - **Text mode**: returns `CON ...` menu listing the options (1–N).  
   - **JSON mode**: returns `{ status, offers: [...], metadata }` with the same amounts and terms.
6. **User picks an option** from the telco menu (e.g. “2. 8,000”).
7. **Aggregator calls `/ussd/loan-approve`** with:
   - `msisdn`, `sessionId`  
   - `selectedOption` and/or `selectedAmount`  
   - optional `network`, `responseType` (text/json), etc.
8. **Backend validates and resolves the selection**:
   - Re-identifies the `User` via `msisdn`.  
   - Either loads previously cached offers using `sessionId` or recomputes offers using the same credit rules.  
   - Validates that the selected option/amount is one of the allowed offers.
9. **Backend creates a `Loan` and triggers approval + disbursement**:
   - Uses the same rules as `LoansService.create` to:
     - Enforce `creditLimit` and outstanding loans.  
     - Choose interest rate and repayment period via `CreditScoreService`.  
     - Compute `disbursedAmount` and `amountDue`.  
   - Then calls a **new service dedicated to USSD** which:
     - Approves the loan.  
     - Triggers disbursement (inline or queued).  
     - Returns an outcome: `approved` or `processing`.
10. **Backend responds to `/ussd/loan-approve`**:
    - **If disbursed inline**:  
      - Text: `END Loan approved. You will receive NGN X shortly.`  
      - JSON: `{ status: "approved", loan: {...} }`
    - **If disbursement is queued / external**:  
      - Text: `END Your loan is being processed. You will be notified shortly.`  
      - JSON: `{ status: "processing", loan: {...} }`

---

## How scoring and limits work here

This section intentionally **ignores any AI/ML wording** and documents how things really work in code.

- **Credit score (`User.creditScore`)**:
  - Numeric field on `User`.  
  - Updated via rules in `CreditScoreService` when repayments happen.  

- **Eligible amount** — `CreditScoreService.calculateEligibleLoanAmount(userId)`:
  - Loads `User` by `id`.  
  - If it’s the first-time user (`totalLoans === 0`), uses a default amount from config (`loan.first_time_user_amount`).  
  - Otherwise, uses configured thresholds (`credit_score.thresholds`) to map `creditScore` → base eligible amount.  
  - If `autoLimitEnabled` is false, clamps the amount to `User.creditLimit` if that is lower.

- **Interest rate** — `CreditScoreService.calculateInterestRateByCreditScore(userId)`:
  - Reads a default rate and tiered rules from `loan.interest_rate.*` config keys.  
  - Chooses a rate based on `creditScore` ranges.  
  - Enforces min/max limits (`interest_rate.min` / `interest_rate.max`).

- **Repayment period** — `CreditScoreService.calculateRepaymentPeriodByCreditScore(userId)`:
  - Reads tiered options from `loan.repayment_period.options`.  
  - Finds the period whose score range includes `creditScore`.  
  - Enforces global min/max days (`repayment_period.min` / `repayment_period.max`).

- **Repayments and score updates** — `CreditScoreService.awardPointsForRepayment(transactionId, loanId, phoneNumber?)`:
  - Validates there is a completed `Transaction` of type `REPAYMENT`.  
  - Updates `Loan.amountPaid`, `Loan.outstandingAmount`, and `Loan.status` (e.g. to `COMPLETED` or `REPAYING`).  
  - Updates `User.totalRepaid` and `User.repaymentStatus` (`PENDING`, `PARTIAL`, `COMPLETED`).  
  - Calculates score points from configurable amount and duration tiers:
    - Based purely on repayment size and timeliness, not AI.  
  - Clamps `User.creditScore` to a configured maximum, may auto-update `User.creditLimit`.  
  - Writes a `CreditScoreHistory` row for full traceability.

- **Effect on USSD**:
  - Every time a customer repays, their `creditScore`, `creditLimit`, and outstanding balance change.  
  - Future `/ussd/loan-offer` calls automatically reflect these changes through `calculateEligibleLoanAmount`, interest rate, and repayment period logic.

---

## `/ussd/loan-offer` — RIM behavior

### Purpose

Given an `msisdn`, quickly compute and present **loan offers** for that user using this app’s real credit and limit rules, without creating a loan yet.

### Example request payload

```json
{
  "msisdn": "+2348012345678",
  "sessionId": "sess-123",
  "serviceCode": "*123#",
  "text": "Loan",
  "network": "mtn",
  "channel": "USSD",
  "responseType": "text"
}
```

- **Required**: `msisdn`,.  
- **Optional**: `network`, `channel`, `responseType`, `sessionId`, etc.

### Inline responsibilities

Within ~1–2 seconds:

1. **Validate input**:
   - Check `msisdn` non-empty and well-formed.  
   - On failure:
     - **Text**: `END Invalid request.`  
     - **JSON**: `{ "status": "error", "code": "INVALID_REQUEST", ... }`

2. **Resolve user**:
   - Find `User` by `phone = msisdn`.  
   - If no user:
     - Decide whether to reject or start onboarding.  
     - Typical reject:
       - **Text**: `END You are not eligible for a loan at this time.`  
       - **JSON**: `{ "status": "error", "code": "USER_NOT_FOUND", ... }`

3. **Compute eligibility with `CreditScoreService`**:
   - `eligibleAmount = CreditScoreService.calculateEligibleLoanAmount(user.id)`  
   - `interestRate = CreditScoreService.calculateInterestRateByCreditScore(user.id)`  
   - `repaymentPeriod = CreditScoreService.calculateRepaymentPeriodByCreditScore(user.id)`  

   If `eligibleAmount <= 0`:
   - Treat as not eligible:
     - **Text**: `END You are not eligible for a loan at this time.`  
     - **JSON**: `{ "status": "error", "code": "NO_ELIGIBLE_AMOUNT", ... }`

4. **Derive offer bands** (business choice, e.g. 3 options):

   - Example:
     - Option 1: 50% of eligible → `Math.round(eligibleAmount * 0.5)`  
     - Option 2: 75% of eligible → `Math.round(eligibleAmount * 0.75)`  
     - Option 3: 100% of eligible → `Math.round(eligibleAmount)`  

   - Remove duplicates and non-positive amounts.  
   - Ensure all are within any effective credit caps.

5. **(Optional) Cache session state**:
   - Store `sessionId` → `{ userId, msisdn, offers, network }` with TTL (e.g. 180s).  
   - Store Eligibility for caching and use in approve loan
   - This is not built into current code, but recommended to support `/ussd/loan-approve` cleanly.

6. **Return response in chosen mode**: (use different endpoints but slightly different names)
   - If `responseType === 'json'`: return JSON.  
   - Otherwise: return a plain `CON` string.

### Example Text responses

**User qualifies:**

```text
CON You qualify for:
1. 5,000
2. 8,000
3. 12,000
Select option (1-3):
```

**User not eligible:**

```text
END Sorry, you are not eligible for a loan at this time.
```

### Example JSON responses

**Success:**

```json
{
  "status": "success",
  "type": "loan-offer",
  "sessionId": "sess-123",
  "msisdn": "+2348012345678",
  "userId": "f0a9c1b0-...",
  "offers": [
    {
      "option": 1,
      "amount": 5000,
      "currency": "NGN",
      "interestRate": 5,
      "repaymentPeriodDays": 30
    },
    {
      "option": 2,
      "amount": 8000,
      "currency": "NGN",
      "interestRate": 5,
      "repaymentPeriodDays": 30
    },
    {
      "option": 3,
      "amount": 12000,
      "currency": "NGN",
      "interestRate": 5,
      "repaymentPeriodDays": 30
    }
  ],
  "metadata": {
    "eligibleAmount": 12000,
    "network": "mtn"
  }
}
```

**Error (user not found):**

```json
{
  "status": "error",
  "type": "loan-offer",
  "code": "USER_NOT_FOUND",
  "message": "No user found for this phone number"
}
```

### Pseudocode

```ts
async function handleLoanOffer(req): Promise<string | LoanOfferJson> {
  const { msisdn, sessionId, network, responseType } = req.body;

  // 1. Validate
  if (!msisdn || !sessionId) {
    return responseType === 'json'
      ? { status: 'error', type: 'loan-offer', code: 'INVALID_REQUEST', message: 'msisdn and sessionId are required' }
      : 'END Invalid request.';
  }

  // 2. Resolve user
  const user = await userRepo.findOne({ where: { phone: msisdn } });
  if (!user) {
    return responseType === 'json'
      ? { status: 'error', type: 'loan-offer', code: 'USER_NOT_FOUND', message: 'No user found for this phone number' }
      : 'END Sorry, you are not eligible for a loan at this time.';
  }

  // 3. Compute eligibility using existing services
  const eligibleAmount = await creditScoreService.calculateEligibleLoanAmount(user.id);
  const interestRate = await creditScoreService.calculateInterestRateByCreditScore(user.id);
  const repaymentPeriod = await creditScoreService.calculateRepaymentPeriodByCreditScore(user.id);

  if (!eligibleAmount || eligibleAmount <= 0) {
    return responseType === 'json'
      ? { status: 'error', type: 'loan-offer', code: 'NO_ELIGIBLE_AMOUNT', message: 'User not eligible for any amount' }
      : 'END Sorry, you are not eligible for a loan at this time.';
  }

  // 4. Build offers
  const offers = buildOfferBands(eligibleAmount, interestRate, repaymentPeriod);
  if (!offers.length) {
    return responseType === 'json'
      ? { status: 'error', type: 'loan-offer', code: 'NO_OFFERS', message: 'No offers available' }
      : 'END Sorry, you are not eligible for a loan at this time.';
  }

  // 5. Optionally cache session
  await saveSession(sessionId, { userId: user.id, msisdn, offers, network });

  // 6. Respond
  if (responseType === 'json') {
    return {
      status: 'success',
      type: 'loan-offer',
      sessionId,
      msisdn,
      userId: user.id,
      offers,
      metadata: { eligibleAmount, network }
    };
  }

  // Text response
  const lines = ['CON You qualify for:'];
  for (const offer of offers) {
    lines.push(`${offer.option}. ${formatAmount(offer.amount)}`);
  }
  lines.push(`Select option (1-${offers.length}):`);
  return lines.join('\n');
}
```

---

## `/ussd/loan-approve` — RIM behavior

### Purpose

Take the user’s selection from `/ussd/loan-offer`, **re‑validate their eligibility using the cached data from the initial offer call**, create a loan using the same business rules as `LoansService.create`, and then **trigger disbursement via a new service**, always returning a `processing` outcome to the USSD aggregator.

### Example request payload

```json
{
  "msisdn": "+2348012345678",
  "sessionId": "sess-123",
  "selectedOption": "2",
  "selectedAmount": 8000,
  "network": "mtn",
  "channel": "USSD",
  "responseType": "text"
}
```

- Either `selectedOption` or `selectedAmount` should be provided (define precedence).

### Inline responsibilities

1. **Validate input**:
   - Require `msisdn` and `sessionId`.  
   - Require at least one of `selectedOption`, `selectedAmount`.  
   - On invalid:
     - **Text**: `END Invalid request.`  
     - **JSON**: `{ "status": "error", "code": "INVALID_REQUEST", ... }`

2. **Resolve user**:
   - Find `User` by `phone = msisdn`.  
   - If not found → treat like invalid or expired session:
     - **Text**: `END This is not a user.`  
     - **JSON**: `{ "status": "error", "code": "USER_NOT_FOUND", "message": "This is not a user." }`

3. **Resolve cached eligibility, offers and selected amount**:
   - If session cache is available:
     - `session = getSession(sessionId)` with `{ offers, eligibleAmount, userId, msisdn }`.  
     - Validate `session.msisdn === msisdn`.  
   - If no session:
     - Re-run the same `loan-offer` credit logic to recompute `eligibleAmount` and `offers`.

   - **Re-check eligibility**:
     - If `eligibleAmount <= 0` or there are no valid `offers`, treat as not eligible:
       - **Text**: `END You are not eligible for a loan at this time.`  
       - **JSON**: `{ "status": "error", "code": "NO_ELIGIBLE_AMOUNT", ... }`

   - Resolve `amount`:
     - If `selectedOption`:
       - Index into `offers[Number(selectedOption) - 1]`.  
     - Else if `selectedAmount`:
       - Validate `selectedAmount` exists in `offers` or is <= `eligibleAmount`.

   - If resolution fails → invalid selection:
     - **Text**: `END Invalid selection.`  
     - **JSON**: `{ "status": "error", "code": "INVALID_SELECTION", ... }`

4. **Create loan using `LoansService` rules (summarized)**:
   - Enforce that `amount` does not exceed:
     - `User.creditLimit`.  
     - Room within credit limit after considering existing outstanding loans.  
   - Derive:
     - `interestRate` via `calculateInterestRateByCreditScore(user.id)`  
     - `repaymentPeriod` via `calculateRepaymentPeriodByCreditScore(user.id)`  
     - `loanId` (e.g. `LOAN-2025-001`)  
     - `interest = amount * interestRate / 100`  
     - `disbursedAmount = amount - interest`  
     - `amountDue = amount`  
     - `outstandingAmount = amountDue`  
     - `status = PENDING`  
   - Persist the loan and update `User.totalLoans` as in `LoansService.create`.

5. **Approve + trigger disbursement using a new service (USSD flow always returns `processing`)**

Introduce a new service (conceptual name):

```ts
class UssdLoanApprovalService {
  async approveAndDisburse(loan: Loan, user: User): Promise<LoanResponseDto> {
    // 1. Approve loan (similar to LoansService.approve, but system-driven)
    const approvedLoan = await this.approveForUssd(loan);

    // 2. Trigger disbursement (can be inline or via queue / external API)
    //    NOTE: Regardless of the underlying mechanism, the USSD channel
    //    should always receive a `processing` status after this method completes.
    await this.triggerDisbursement(approvedLoan, user);

    // 3. Return the latest loan view; controller will wrap it in a `processing` response
    return this.mapToResponse(approvedLoan);
  }
}
```

- **Approve (system)**:
  - Similar to `LoansService.approve`, but:
    - No admin user required.  
    - Sets `Loan.status = APPROVED`, `approvedAt = now`, maybe system user ID.  

- **Disburse**:
  - Similar to `LoansService.disburse`:
    - Sets `Loan.status = DISBURSED`, `disbursedAt = now`.  
    - Ensures `telcoReference` is set.  
    - Updates `User.repaymentStatus = PENDING`.  

- **Outcome (USSD channel)**:
  - Disbursement is triggered (inline or queued).  
  - The USSD endpoint **always** responds with `status = "processing"` after calling `approveAndDisburse`, regardless of the internal disbursement mechanism.

6. **Return final response**:

- **Text mode**:
  - After triggering disbursement (inline or queued):  
    `END Your loan is being processed. You will be notified shortly.`

- **JSON mode**:
  - Always includes `status: "processing"`, plus key loan fields.

### Example Text responses

**Processing (after disbursement is triggered inline or queued):**

```text
END Your loan is being processed. You will be notified shortly.
```

**Invalid selection:**

```text
END Invalid selection.
```

### Example JSON responses

**Processing:**

```json
{
  "status": "processing",
  "type": "loan-approve",
  "sessionId": "sess-123",
  "msisdn": "+2348012345678",
  "loan": {
    "id": "0c6c...",
    "loanId": "LOAN-2025-001",
    "userId": "f0a9c1b0-...",
    "amount": 8000,
    "status": "APPROVED"
  },
  "message": "Your loan is being processed. You will be notified shortly."
}
```

### Pseudocode

```ts
async function handleLoanApprove(req): Promise<string | LoanApproveJson> {
  const { msisdn, sessionId, selectedOption, selectedAmount, responseType } = req.body;

  // 1. Validate
  if (!msisdn || !sessionId) {
    return asError('INVALID_REQUEST', 'msisdn and sessionId are required', responseType);
  }

  if (!selectedOption && !selectedAmount) {
    return asError('INVALID_REQUEST', 'Selected option or amount is required', responseType);
  }

  // 2. Resolve user
  const user = await userRepo.findOne({ where: { phone: msisdn } });
  if (!user) {
    return asError('USER_NOT_FOUND', 'No user found for this phone number', responseType);
  }

  // 3. Resolve cached eligibility + offers
  let session = await getSession(sessionId);
  let offers = session?.offers;
  let eligibleAmount = session?.eligibleAmount;

  if (!offers || !offers.length || typeof eligibleAmount !== 'number') {
    // Fall back: recompute eligibility and offers as in /ussd/loan-offer
    const recomputed = await recomputeOffersForUser(user);
    offers = recomputed.offers;
    eligibleAmount = recomputed.eligibleAmount;
  }

  if (!offers || !offers.length || !eligibleAmount || eligibleAmount <= 0) {
    return asError('NO_ELIGIBLE_AMOUNT', 'User not eligible for any amount', responseType);
  }

  // 4. Resolve amount
  let amount: number | undefined;

  if (selectedOption) {
    const idx = Number(selectedOption) - 1;
    amount = offers[idx]?.amount;
  } else if (selectedAmount) {
    const parsed = Number(selectedAmount);
    if (offers.some((o) => o.amount === parsed)) {
      amount = parsed;
    }
  }

  if (!amount || amount <= 0) {
    return asError('INVALID_SELECTION', 'Invalid loan selection', responseType);
  }

  // 5. Create base loan using LoansService-like rules
  const loan = await ussdLoanFactory.createLoanForUser(user, amount, session?.network);

  // 6. Approve + trigger disbursement using new service
  const loanView = await ussdLoanApprovalService.approveAndDisburse(loan, user);

  // 7. Respond (USSD channel always sees `processing`)
  if (responseType === 'json') {
    return {
      status: 'processing',
      type: 'loan-approve',
      sessionId,
      msisdn,
      loan: loanView,
      message: 'Your loan is being processed. You will be notified shortly.'
    };
  }

  // Text mode
  return 'END Your loan is being processed. You will be notified shortly.';
}
```

---

## State, idempotency, and retries

- **Session storage**:
  - Recommended: `sessionId` → `{ userId, msisdn, offers, network }` with a short TTL.  
  - This helps validate `selectedOption` without re-deriving offers.

- **Idempotency for `/ussd/loan-approve`**:
  - Aggregators may retry due to timeouts.  
  - Use an idempotency key, e.g.:
    - `loanKey = hash(sessionId + msisdn + amount)`  
    - Ensure that if a loan already exists for this key, it is reused instead of creating a duplicate.

- **Disbursement reliability**:
  - Inline disbursement should be **fast** and retried safely if failures occur.  
  - When inline fails or is not possible:
    - Keep loan at `APPROVED`.  
    - Queue disbursement with backoff / retries.  
    - Respond `processing` to the user.

---

## Testing checklist

- **Loan-offer**:
  - ✅ Valid `msisdn` with good score → sees higher amounts and maybe better terms.  
  - ✅ Low-score user → reduced amounts and/or shorter repayment period.  
  - ✅ Unknown `msisdn` → graceful rejection.

- **Loan-approve**:
  - ✅ `selectedOption` and `selectedAmount` are correctly mapped to offers.  
  - ✅ Loans created reflect the same interest and repayment rules as admin-created loans.  
  - ✅ Approved path:
    - `Loan.status` transitions to `DISBURSED`.  
    - `User.repaymentStatus` is `PENDING`.  
  - ✅ Processing path:
    - `Loan.status = APPROVED`.  
    - Disbursement is queued and can succeed later without double-payout.

- **Scoring & limits**:
  - ✅ After a repayment, `creditScore` and `creditLimit` change as expected.  
  - ✅ New `/ussd/loan-offer` calls after repayment return updated offers.

---
