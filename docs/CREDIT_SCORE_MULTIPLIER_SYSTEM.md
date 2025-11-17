# Credit Score Multiplier-Based System - Implementation Guide

## Overview

Implement a flexible, multiplier-based credit score system that awards points to users when they repay loans through transactions. The system should dynamically calculate points based on:
- **Repayment Amount**: Larger repayments earn more points
- **Repayment Duration**: Faster repayments earn bonus multipliers
- **Partial vs Full Repayments**: Support both partial and full repayment scenarios

The system uses configuration-driven multipliers stored in `SYSTEM_CONFIG` table, allowing administrators to adjust scoring rules without code changes.

---

## Configuration Structure

### System Configuration Entry

**Category**: `credit_score`  
**Key**: `repayment_scoring`  
**Type**: `json`

### Default Configuration Schema

```json
{
  "basePoints": 50,
  "amountMultipliers": [
    {
      "minAmount": 0,
      "maxAmount": 1000,
      "multiplier": 0.5
    },
    {
      "minAmount": 1001,
      "maxAmount": 5000,
      "multiplier": 1.0
    },
    {
      "minAmount": 5001,
      "maxAmount": 10000,
      "multiplier": 1.5
    },
    {
      "minAmount": 10001,
      "maxAmount": 999999,
      "multiplier": 2.0
    }
  ],
  "durationMultipliers": [
    {
      "minDays": 0,
      "maxDays": 7,
      "multiplier": 2.0
    },
    {
      "minDays": 8,
      "maxDays": 14,
      "multiplier": 1.5
    },
    {
      "minDays": 15,
      "maxDays": 30,
      "multiplier": 1.0
    },
    {
      "minDays": 31,
      "maxDays": 60,
      "multiplier": 0.75
    },
    {
      "minDays": 61,
      "maxDays": 999,
      "multiplier": 0.5
    }
  ],
  "maxPointsPerTransaction": 500,
  "enablePartialRepayments": true,
  "minPointsForPartialRepayment": 5
}
```

### Configuration Fields Explained

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `basePoints` | number | Base points awarded for any repayment | 50 |
| `amountMultipliers` | array | Tiered multipliers based on repayment amount | See above |
| `durationMultipliers` | array | Tiered multipliers based on repayment speed | See above |
| `maxPointsPerTransaction` | number | Maximum points that can be awarded per transaction | 500 |
| `enablePartialRepayments` | boolean | Whether to award points for partial repayments | true |
| `minPointsForPartialRepayment` | number | Minimum points threshold for partial repayments | 5 |

---

## Key Features Breakdown

### Feature 1: Dynamic Point Calculation

**Description**: Calculate credit score points dynamically based on repayment amount and duration using configured multipliers.

**Requirements**:
- Read configuration from `SYSTEM_CONFIG` table
- Calculate duration in days between loan disbursement and repayment
- Match repayment amount to appropriate amount multiplier tier
- Match repayment duration to appropriate duration multiplier tier
- Apply formula: `points = basePoints × amountMultiplier × durationMultiplier`
- Enforce maximum points cap per transaction

**Implementation Location**: 
- `src/modules/credit-score/services/credit-score.service.ts`
- New method: `calculatePointsForRepayment()`

**Helper Methods Needed**:
- `getAmountMultiplier(amount: number, tiers: Array): number`
- `getDurationMultiplier(days: number, tiers: Array): number`

---

### Feature 2: Partial Repayment Support

**Description**: Award points for partial loan repayments, scaled proportionally to the repayment percentage.

**Requirements**:
- Check if `enablePartialRepayments` is true in configuration
- Calculate repayment percentage: `repaymentAmount / loanAmount`
- Scale points by repayment percentage: `points = points × repaymentPercentage`
- Enforce minimum points threshold for partial repayments
- Only award points if calculated points exceed `minPointsForPartialRepayment`

**Implementation Location**:
- `src/modules/credit-score/services/credit-score.service.ts`
- Modify `awardPointsForRepayment()` method

**Business Logic**:
```typescript
if (config.enablePartialRepayments && !isFullRepayment) {
  const repaymentPercentage = repaymentAmount / loanAmount;
  points = points * repaymentPercentage;
  
  if (points < config.minPointsForPartialRepayment) {
    return 0; // Don't award if below minimum threshold
  }
}
```

---

### Feature 3: Full Repayment Bonus

**Description**: Award additional points or apply bonus multiplier when loan is fully repaid.

**Requirements**:
- Detect when loan becomes fully repaid (outstandingAmount <= 0)
- Apply full repayment bonus multiplier (if configured)
- Ensure idempotency - don't award points twice for same loan completion
- Create history record with reason: `loan_completed` or `partial_repayment`

**Implementation Location**:
- `src/modules/credit-score/services/credit-score.service.ts`
- Modify `awardPointsForRepayment()` method

**Configuration Addition** (optional):
```json
{
  "fullRepaymentBonus": 1.2,  // 20% bonus multiplier
  "fullRepaymentFixedBonus": 25  // Or fixed bonus points
}
```

---

### Feature 4: Configuration Management

**Description**: Provide admin interface to manage credit score configuration through SystemConfig API.

**Requirements**:
- Create default configuration entry in database seed/migration
- Validate configuration structure when updating
- Provide UI in admin panel to edit configuration
- Support JSON editing with validation
- Log configuration changes for audit

**Implementation Location**:
- `src/database/seeds/` - Create seed file for default config
- `src/modules/system-config/` - Already exists, ensure JSON validation
- Frontend: `src/components/settings/SystemConfigurationSection.tsx`

**Validation Rules**:
- `basePoints` must be >= 0
- `amountMultipliers` must have non-overlapping ranges
- `durationMultipliers` must have non-overlapping ranges
- `maxPointsPerTransaction` must be > 0
- All multipliers must be >= 0

---

### Feature 5: Transaction-Based Point Awarding

**Description**: Award points immediately when a repayment transaction is marked as completed.

**Requirements**:
- Trigger point calculation when transaction status changes to `COMPLETED`
- Support both partial and full repayments
- Update user's credit score atomically
- Create credit score history record for audit trail
- Handle errors gracefully without failing transaction reconciliation

**Implementation Location**:
- `src/modules/transactions/services/transactions.service.ts`
- `src/modules/credit-score/services/credit-score.service.ts`

**Integration Points**:
- `TransactionsService.reconcile()` - Already calls credit score service
- `CreditScoreService.awardPointsForRepayment()` - Needs modification

---

### Feature 6: History Tracking & Audit

**Description**: Track all credit score changes with detailed metadata for audit and analytics.

**Requirements**:
- Record previous score, new score, and points awarded
- Store transaction ID and loan ID for traceability
- Record reason: `partial_repayment` or `loan_completed`
- Store calculation metadata (amount, duration, multipliers used)
- Support querying history by user, loan, or transaction

**Implementation Location**:
- `src/entities/credit-score-history.entity.ts` - May need to add metadata field
- `src/modules/credit-score/repositories/credit-score-history.repository.ts`

**Metadata Structure**:
```json
{
  "repaymentAmount": 5000,
  "loanAmount": 10000,
  "durationDays": 12,
  "amountMultiplier": 1.5,
  "durationMultiplier": 1.5,
  "basePoints": 50,
  "calculatedPoints": 112.5,
  "finalPoints": 112,
  "isPartialRepayment": true,
  "repaymentPercentage": 0.5
}
```

---

### Feature 7: Edge Case Handling

**Description**: Handle edge cases gracefully to ensure system stability.

**Edge Cases to Handle**:

1. **Missing Configuration**
   - Use sensible defaults if config not found
   - Log warning when using defaults

2. **Invalid Configuration**
   - Validate configuration structure
   - Fall back to defaults if invalid
   - Log error for admin review

3. **Zero or Negative Amounts**
   - Return 0 points for invalid amounts
   - Log warning

4. **Missing Loan Disbursement Date**
   - Use loan `createdAt` as fallback
   - Log warning

5. **Future Dates**
   - Handle if repayment date is before disbursement
   - Use absolute value for duration calculation

6. **Concurrent Transactions**
   - Use database transactions for atomicity
   - Handle race conditions with optimistic locking

7. **Very Large Amounts**
   - Cap at maximum tier
   - Prevent integer overflow

---

## Implementation Steps

### Step 1: Update Configuration Schema

1. Create database seed/migration to add default `repayment_scoring` config
2. Add configuration validation in `SystemConfigService`
3. Update frontend to support JSON editing with schema validation

### Step 2: Implement Calculation Logic

1. Add `calculatePointsForRepayment()` method to `CreditScoreService`
2. Implement `getAmountMultiplier()` helper method
3. Implement `getDurationMultiplier()` helper method
4. Add unit tests for calculation logic

### Step 3: Modify Award Logic

1. Update `awardPointsForRepayment()` to use new calculation
2. Add support for partial repayments
3. Add full repayment bonus logic
4. Update history tracking with metadata

### Step 4: Integration

1. Ensure `TransactionsService.reconcile()` properly triggers scoring
2. Test with various repayment scenarios
3. Add logging for debugging

### Step 5: Frontend Updates

1. Add configuration UI for `repayment_scoring`
2. Display calculation breakdown in credit score history
3. Show points awarded in transaction details

### Step 6: Testing

1. Unit tests for calculation methods
2. Integration tests for transaction flow
3. Edge case testing
4. Performance testing with high transaction volume

---

## Code Structure

### Service Method Signature

```typescript
/**
 * Calculate credit score points for a repayment transaction
 * @param repaymentAmount - Amount being repaid in this transaction
 * @param loanAmount - Total loan amount
 * @param disbursedAt - When loan was disbursed
 * @param repaidAt - When repayment transaction was completed
 * @param isFullRepayment - Whether this completes the loan
 * @returns Calculated points to award
 */
async calculatePointsForRepayment(
  repaymentAmount: number,
  loanAmount: number,
  disbursedAt: Date,
  repaidAt: Date,
  isFullRepayment: boolean,
): Promise<number>
```

### Configuration Interface

```typescript
interface RepaymentScoringConfig {
  basePoints: number;
  amountMultipliers: Array<{
    minAmount: number;
    maxAmount: number;
    multiplier: number;
  }>;
  durationMultipliers: Array<{
    minDays: number;
    maxDays: number;
    multiplier: number;
  }>;
  maxPointsPerTransaction: number;
  enablePartialRepayments: boolean;
  minPointsForPartialRepayment?: number;
  fullRepaymentBonus?: number; // Optional bonus multiplier
}
```

---

## Example Calculations

### Example 1: Full Repayment - Fast & Large Amount

- **Loan Amount**: ₦10,000
- **Repayment Amount**: ₦10,000 (full)
- **Duration**: 5 days
- **Base Points**: 50
- **Amount Multiplier**: 2.0 (tier: 10001-999999)
- **Duration Multiplier**: 2.0 (tier: 0-7 days)
- **Calculation**: 50 × 2.0 × 2.0 = 200 points
- **Capped at**: 200 points (below max of 500)
- **Result**: **200 points awarded**

### Example 2: Partial Repayment - Medium Speed

- **Loan Amount**: ₦10,000
- **Repayment Amount**: ₦5,000 (50% partial)
- **Duration**: 20 days
- **Base Points**: 50
- **Amount Multiplier**: 1.5 (tier: 5001-10000)
- **Duration Multiplier**: 1.0 (tier: 15-30 days)
- **Calculation**: 50 × 1.5 × 1.0 = 75 points
- **Partial Scaling**: 75 × 0.5 = 37.5 points
- **Result**: **38 points awarded** (rounded)

### Example 3: Small Partial Repayment - Slow

- **Loan Amount**: ₦10,000
- **Repayment Amount**: ₦500 (5% partial)
- **Duration**: 45 days
- **Base Points**: 50
- **Amount Multiplier**: 0.5 (tier: 0-1000)
- **Duration Multiplier**: 0.75 (tier: 31-60 days)
- **Calculation**: 50 × 0.5 × 0.75 = 18.75 points
- **Partial Scaling**: 18.75 × 0.05 = 0.9375 points
- **Below Minimum**: 0.9375 < 5 (minPointsForPartialRepayment)
- **Result**: **0 points awarded**

---

## Testing Scenarios

### Test Case 1: Configuration Missing
- **Setup**: Remove `repayment_scoring` config
- **Expected**: Use hardcoded defaults, log warning
- **Verify**: Points still awarded with default values

### Test Case 2: Invalid Configuration
- **Setup**: Set invalid JSON in config
- **Expected**: Fall back to defaults, log error
- **Verify**: System doesn't crash, defaults used

### Test Case 3: Very Fast Repayment
- **Setup**: Repay loan in 1 day
- **Expected**: Maximum duration multiplier applied
- **Verify**: Points calculated correctly

### Test Case 4: Very Slow Repayment
- **Setup**: Repay loan after 100 days
- **Expected**: Minimum duration multiplier applied
- **Verify**: Points still awarded but reduced

### Test Case 5: Large Amount Repayment
- **Setup**: Repay ₦50,000 loan
- **Expected**: Maximum amount multiplier applied
- **Verify**: Points capped at maxPointsPerTransaction

### Test Case 6: Multiple Partial Repayments
- **Setup**: Make 3 partial repayments of ₦3,333 each
- **Expected**: Points awarded for each transaction
- **Verify**: Total points sum correctly, no double-counting

### Test Case 7: Concurrent Repayments
- **Setup**: Two transactions completing same loan simultaneously
- **Expected**: Only one awards completion bonus
- **Verify**: Idempotency maintained

---

## Migration & Deployment

### Database Changes
- No schema changes required (uses existing `SYSTEM_CONFIG` table)
- Add seed data for default configuration

### Backward Compatibility
- Existing `points_per_loan_completion` config still supported
- New system takes precedence if `repayment_scoring` exists
- Gradual migration path available

### Rollout Strategy
1. Deploy code with feature flag
2. Add default configuration to database
3. Test with small subset of transactions
4. Monitor point distribution
5. Adjust configuration based on analytics
6. Enable for all users

---

## Monitoring & Analytics

### Metrics to Track
- Average points awarded per transaction
- Points distribution by amount tier
- Points distribution by duration tier
- Partial vs full repayment ratio
- Credit score growth rate

### Logging Requirements
- Log all point calculations with metadata
- Log configuration changes
- Log edge cases and fallbacks
- Track calculation performance

### Alerts
- Alert if configuration missing
- Alert if calculation errors exceed threshold
- Alert if point distribution seems abnormal

---

## Future Enhancements

### Potential Additions
1. **Time-based bonuses**: Extra points for on-time repayments
2. **Streak bonuses**: Bonus for consecutive on-time repayments
3. **Amount-based caps**: Different max points for different amount ranges
4. **User tier multipliers**: Different multipliers for different user tiers
5. **Seasonal multipliers**: Temporary bonus multipliers for promotions
6. **Penalty system**: Deduct points for late repayments (negative multipliers)

---

## Summary

This multiplier-based system provides a flexible, configuration-driven approach to credit score calculation. Key benefits:

✅ **Flexible**: Easy to adjust without code changes  
✅ **Transparent**: Clear calculation logic  
✅ **Scalable**: Supports various repayment scenarios  
✅ **Maintainable**: Configuration-driven reduces code complexity  
✅ **Auditable**: Full history tracking with metadata  

The system rewards good repayment behavior (large amounts, fast repayments) while still incentivizing partial repayments, creating a balanced credit scoring mechanism.

