# Migration Guide: SupportAgent with AdminUser FK Relationship

## Overview

This migration refactors the relationship between `SupportAgent` and `AdminUser` from a weak email-based link to a strong foreign key relationship. Additionally, it adds department support to `AdminRole`.

## Changes Summary

### Before (Old Flow)

1. **SupportAgent and AdminUser Relationship:**
   - Weak relationship based on email matching
   - No database foreign key constraint
   - `TicketAccessGuard` looked up agents by email: `findByEmail(user.email)`
   - No guarantee of data integrity

2. **AdminRole:**
   - No department field
   - Department information only stored on SupportAgent

3. **Data Flow:**
   ```
   AdminUser (email) → [Email Match] → SupportAgent (email)
   Ticket.assignedTo → SupportAgent.id
   ```

### After (New Flow)

1. **SupportAgent and AdminUser Relationship:**
   - Strong foreign key relationship: `SupportAgent.adminUserId → AdminUser.id`
   - Database-enforced referential integrity
   - `TicketAccessGuard` looks up agents by adminUserId: `findByAdminUserId(user.id)`
   - Direct relationship ensures data consistency

2. **AdminRole:**
   - Added nullable `departmentId` field (FK to Department)
   - Department can be assigned at role level

3. **Data Flow:**
   ```
   AdminUser.id → [FK] → SupportAgent.adminUserId
   Ticket.assignedTo → SupportAgent.id (unchanged)
   AdminRole.departmentId → Department.id (new)
   ```

## Impact on Existing Code

### Code Changes

1. **TicketAccessGuard:**
   - **Before:** `await this.agentRepository.findByEmail(user.email)`
   - **After:** `await this.agentRepository.findByAdminUserId(user.id)`
   - **Impact:** More reliable, faster lookups

2. **AgentRepository:**
   - **Added:** `findByAdminUserId(adminUserId: string)` method
   - **Updated:** `findByEmail` now includes AdminUser relation
   - **Added:** `findByAdminUserIds(adminUserIds: string[])` for bulk queries

3. **SupportAgent Entity:**
   - **Added:** `adminUserId` column (UUID, not nullable)
   - **Added:** `@ManyToOne` relation to AdminUser
   - **Removed:** Email uniqueness constraint (email now comes from AdminUser)
   - **Added:** Index on `adminUserId` for performance

4. **AdminRole Entity:**
   - **Added:** `departmentId` column (UUID, nullable)
   - **Added:** `@ManyToOne` relation to Department

5. **AdminUser Entity:**
   - **Added:** `@OneToOne` relation to SupportAgent (reverse relation for convenience)

### Query Examples

**Old Query (Email-based):**
```typescript
// Find agent by email
const agent = await agentRepository.findByEmail('agent@example.com');
```

**New Query (FK-based):**
```typescript
// Find agent by AdminUser ID
const agent = await agentRepository.findByAdminUserId(adminUserId);

// Or use the relation
const adminUser = await adminUserRepository.findOne({
  where: { id: adminUserId },
  relations: ['supportAgent']
});
const agent = adminUser.supportAgent;
```

## Migration Steps

### Step 1: Data Cleanup (Before Migration)

**⚠️ WARNING: These commands will DELETE all existing data. Use with caution!**

```sql
-- Start a transaction for safety
BEGIN;

-- Delete all ticket-related data first (due to foreign keys)
DELETE FROM "TICKET_HISTORY";
DELETE FROM "CHAT_MESSAGES";
DELETE FROM "SUPPORT_TICKETS";

-- Delete all support agents
DELETE FROM "SUPPORT_AGENTS";

-- Delete all departments
DELETE FROM "DEPARTMENTS";

-- Verify deletions
SELECT COUNT(*) FROM "SUPPORT_TICKETS"; -- Should be 0
SELECT COUNT(*) FROM "SUPPORT_AGENTS"; -- Should be 0
SELECT COUNT(*) FROM "DEPARTMENTS"; -- Should be 0

-- If everything looks good, commit
COMMIT;

-- If something went wrong, rollback
-- ROLLBACK;
```

### Step 2: Add adminUserId Column to SUPPORT_AGENTS

```sql
BEGIN;

-- Add the new column (nullable first for migration)
ALTER TABLE "SUPPORT_AGENTS" 
ADD COLUMN "adminUserId" uuid;

-- Create index for performance
CREATE INDEX "IDX_SUPPORT_AGENTS_adminUserId" ON "SUPPORT_AGENTS" ("adminUserId");

COMMIT;
```

### Step 3: Migrate Existing Data (if any remains)

**Note:** This step is only needed if you have existing data to migrate. If you cleaned up in Step 1, skip to Step 4.

```sql
BEGIN;

-- Match SupportAgent.email to AdminUser.email and set adminUserId
UPDATE "SUPPORT_AGENTS" sa
SET "adminUserId" = au.id
FROM "ADMIN_USERS" au
WHERE sa.email = au.email
  AND sa."adminUserId" IS NULL;

-- Verify migration
SELECT sa.id, sa.email, sa."adminUserId", au.id, au.email
FROM "SUPPORT_AGENTS" sa
LEFT JOIN "ADMIN_USERS" au ON sa."adminUserId" = au.id
WHERE sa."adminUserId" IS NULL; -- Should return 0 rows

COMMIT;
```

### Step 4: Add Foreign Key Constraint

```sql
BEGIN;

-- Make adminUserId NOT NULL (after data migration)
ALTER TABLE "SUPPORT_AGENTS" 
ALTER COLUMN "adminUserId" SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE "SUPPORT_AGENTS"
ADD CONSTRAINT "FK_SUPPORT_AGENTS_adminUserId"
FOREIGN KEY ("adminUserId")
REFERENCES "ADMIN_USERS"("id")
ON DELETE CASCADE;

COMMIT;
```

### Step 5: Add departmentId to ADMIN_ROLES

```sql
BEGIN;

-- Add the new column (nullable)
ALTER TABLE "ADMIN_ROLES" 
ADD COLUMN "departmentId" uuid;

-- Add foreign key constraint
ALTER TABLE "ADMIN_ROLES"
ADD CONSTRAINT "FK_ADMIN_ROLES_departmentId"
FOREIGN KEY ("departmentId")
REFERENCES "DEPARTMENTS"("id")
ON DELETE SET NULL;

COMMIT;
```

### Step 6: Remove Email Uniqueness Constraint (if exists)

```sql
BEGIN;

-- Drop unique constraint on email if it exists
ALTER TABLE "SUPPORT_AGENTS"
DROP CONSTRAINT IF EXISTS "UQ_SUPPORT_AGENTS_email";

COMMIT;
```

## Breaking Changes

1. **SupportAgent.email is no longer unique**
   - Email should come from AdminUser
   - If you need to query by email, use the AdminUser relation

2. **TicketAccessGuard behavior**
   - Now requires `adminUserId` to be set on SupportAgent
   - Agents without a valid `adminUserId` will be denied access

3. **Agent creation**
   - Must now provide `adminUserId` when creating a SupportAgent
   - Cannot create an agent without linking to an AdminUser

## New Features

### Department Management Endpoints

- `GET /support/departments` - List all departments
- `GET /support/departments/:id` - Get department by ID
- `POST /support/departments` - Create department
- `PATCH /support/departments/:id` - Update department
- `DELETE /support/departments/:id` - Delete department (Admin only)

### Department Assignment to Roles

- AdminRole can now have a `departmentId`
- Useful for assigning departments to support agent roles
- Department is nullable (only support agent roles need it)

## Validation Rules

### Department Deletion

A department cannot be deleted if:
1. It is assigned to any AdminRole (`departmentId` references it)
2. It has any SupportAgents (agents with `department` field matching department name)

### SupportAgent Creation

A SupportAgent must:
1. Have a valid `adminUserId` that exists in ADMIN_USERS
2. The AdminUser should have a role of "moderator" or "support agent"

## Rollback Plan

If you need to rollback:

```sql
BEGIN;

-- Remove foreign key constraints
ALTER TABLE "SUPPORT_AGENTS"
DROP CONSTRAINT IF EXISTS "FK_SUPPORT_AGENTS_adminUserId";

ALTER TABLE "ADMIN_ROLES"
DROP CONSTRAINT IF EXISTS "FK_ADMIN_ROLES_departmentId";

-- Remove columns
ALTER TABLE "SUPPORT_AGENTS"
DROP COLUMN IF EXISTS "adminUserId";

ALTER TABLE "ADMIN_ROLES"
DROP COLUMN IF EXISTS "departmentId";

-- Restore email uniqueness (if needed)
ALTER TABLE "SUPPORT_AGENTS"
ADD CONSTRAINT "UQ_SUPPORT_AGENTS_email" UNIQUE ("email");

COMMIT;
```

## Testing Checklist

- [ ] Verify ticket assignment works with new FK relationship
- [ ] Verify ticket access guard works correctly
- [ ] Test agent queries perform well with new indexes
- [ ] Test bulk operations with new relationship
- [ ] Test department CRUD endpoints
- [ ] Test department deletion validation
- [ ] Verify department assignment to AdminRole
- [ ] Test agent creation with adminUserId
- [ ] Verify email-based lookups still work (via relation)

## Notes

- The `Ticket.assignedTo` field still stores `SupportAgent.id` (no change needed)
- All existing ticket assignment logic remains compatible
- The main change is in how we look up agents from AdminUser
- Department assignment to roles is optional (nullable field)

