# Roles and Permissions System - Complete Explanation

## Overview

The RIM Admin system uses a **role-based access control (RBAC)** system with **fine-grained permissions**. This document explains how roles and permissions work in both the backend and frontend.

## Backend Implementation

### 1. Database Structure

#### AdminRole Entity

Located in: `rim-admin-backend/src/entities/admin-role.entity.ts`

```typescript
@Entity("ADMIN_ROLES")
export class AdminRole {
  id: string; // UUID primary key
  name: string; // Unique role name (e.g., "Super Admin", "Support Agent")
  description: string; // Role description
  permissions: Permission[]; // JSONB array of permissions
  userCount: number; // Denormalized count of users with this role
  createdAt: Date;
  updatedAt: Date;
  adminUsers: AdminUser[]; // One-to-many relationship
}
```

#### Permission Structure

Permissions are stored as JSONB in the database:

```typescript
interface Permission {
  resource: string; // Resource name (e.g., "users", "loans", "transactions")
  actions: ("read" | "write" | "delete")[]; // Array of allowed actions
}
```

**Example Permission Data:**

```json
{
  "permissions": [
    {
      "resource": "users",
      "actions": ["read", "write", "delete"]
    },
    {
      "resource": "loans",
      "actions": ["read", "write"]
    },
    {
      "resource": "transactions",
      "actions": ["read"]
    }
  ]
}
```

#### AdminUser Entity

Each admin user has a `roleId` that references an `AdminRole`:

```typescript
@Entity("ADMIN_USERS")
export class AdminUser {
  id: string;
  username: string;
  email: string;
  roleId: string; // Foreign key to AdminRole
  roleEntity: AdminRole; // Loaded relation (for permission checks)
  // ... other fields
}
```

### 2. Permission Guard System

#### PermissionsGuard

Location: `rim-admin-backend/src/modules/auth/guards/permissions.guard.ts`

**How it works:**

1. **Extracts user from request** (set by `JwtAuthGuard`)
2. **Checks for permission decorators** using NestJS `Reflector`
3. **Validates permissions** against the user's role permissions
4. **Throws ForbiddenException** if permission check fails

**Flow:**

```
Request → JwtAuthGuard → PermissionsGuard → Controller Handler
           ↓                    ↓
    Validates JWT      Checks Permissions
    Loads User         from roleEntity
```

#### Permission Decorators

**@Permissions() Decorator**
Location: `rim-admin-backend/src/modules/auth/decorators/permissions.decorator.ts`

```typescript
@Permissions('users', 'write')
@Post('users')
async createUser() {
  // Requires 'write' permission on 'users' resource
}
```

**Parameters:**

- `resource` (string): Resource name (e.g., 'users', 'loans')
- `...actions` (PermissionAction[]): Required actions ('read', 'write', 'delete')
  - If no actions specified, defaults to all: ['read', 'write', 'delete']

**Role-Specific Decorators:**

- `@RequireSuperAdmin()` - Only users with "Super Admin" role
- `@RequireSupportAgent()` - Only users with "Moderator" role
- `@RequireFinanceOfficer()` - Only users with "Admin" role

### 3. Roles Controller

Location: `rim-admin-backend/src/modules/admin/controllers/roles.controller.ts`

**Current Implementation:**

```typescript
@Controller("admin/roles")
@UseGuards(JwtAuthGuard) // Only JWT authentication required
export class RolesController {
  // No permission guards - any authenticated admin can manage roles
}
```

**Note:** The roles controller currently only requires JWT authentication. It does NOT have permission guards, meaning any authenticated admin user can create, update, or delete roles. This might be intentional for flexibility, but you may want to add `@RequireSuperAdmin()` to restrict role management.

### 4. Roles Service

Location: `rim-admin-backend/src/modules/admin/services/roles.service.ts`

**Key Methods:**

- `list()` - Get all roles with user counts
- `get(id)` - Get a single role by ID
- `create(dto)` - Create a new role (validates unique name)
- `update(id, dto)` - Update role (recalculates userCount)
- `remove(id)` - Delete role (prevents deletion if users assigned)

**Business Rules:**

- Role names must be unique
- Cannot delete a role if it has assigned users
- User count is automatically recalculated on update

## Frontend Implementation

### 1. Admin Roles Section

Location: `rim-admin-frontend/src/components/admin/AdminRolesSection.tsx`

**Features:**

- Lists all admin roles in a table
- Shows role name, description, user count, and permissions
- Edit button (opens form dialog)
- Delete button (with confirmation)
- Add Role button

**Recent Fixes:**

- Fixed form state management (was using `control._formValues` incorrectly)
- Added proper error handling to mutations
- Fixed checkbox state reactivity using `watch()`

### 2. Admin Role Form

Location: `rim-admin-frontend/src/components/admin/AdminRoleForm.tsx`

**Features:**

- Create/Edit role form
- Dynamic permission management
- Resource selection dropdown
- Action checkboxes (read, write, delete)

**Form Structure:**

```typescript
{
  name: string;
  description: string;
  permissions: Array<{
    resource: string;
    actions: ("read" | "write" | "delete")[];
  }>;
}
```

**Available Resources:**

- users
- loans
- transactions
- support
- settings
- notifications

**Available Actions:**

- read
- write
- delete

### 3. API Service

Location: `rim-admin-frontend/src/services/admin/api.ts`

**Endpoints:**

- `GET /admin/roles` - List all roles
- `GET /admin/roles/:id` - Get single role
- `POST /admin/roles` - Create role
- `PATCH /admin/roles/:id` - Update role
- `DELETE /admin/roles/:id` - Delete role

### 4. React Query Hooks

Location: `rim-admin-frontend/src/services/admin/hooks.ts`

**Hooks:**

- `useAdminRoles()` - Query all roles
- `useAdminRole(id)` - Query single role
- `useCreateAdminRole()` - Create mutation
- `useUpdateAdminRole()` - Update mutation
- `useDeleteAdminRole()` - Delete mutation

**Error Handling:**
All mutations now have `onError` handlers that display user-friendly error messages via toaster notifications.

## Common Issues and Fixes

### Issue 1: Form Checkboxes Not Updating

**Problem:** Checkboxes in the role form weren't updating when clicked.

**Root Cause:** The form was using `control._formValues` which is not reactive and was being mutated directly.

**Fix:**

- Switched to using `watch('permissions')` for reactive state
- Used `setValue()` to properly update form values
- Removed direct mutation of `control._formValues`

### Issue 2: Errors Not Displayed

**Problem:** When edit/delete operations failed, no error message was shown to the user.

**Root Cause:** Missing `onError` handlers in mutation hooks.

**Fix:**

- Added `onError` handlers to `useUpdateAdminRole()`
- Added `onError` handlers to `useDeleteAdminRole()`
- Added `onError` handlers to `useCreateAdminRole()`

### Issue 3: Permission Check Failures

**Problem:** Users getting "Insufficient permissions" errors.

**Common Causes:**

1. Role doesn't have the required permission for the resource
2. Role doesn't have the required action (read/write/delete)
3. Role name mismatch (for role-specific decorators)
4. `roleEntity` not loaded in JWT strategy

**Solutions:**

- Check role permissions in database
- Verify resource name matches exactly
- Ensure actions array includes required actions
- Check that JWT strategy loads `roleEntity` relation

## Security Considerations

### Current State

1. **Roles Controller:** Only requires JWT authentication (no permission guards)

   - Any authenticated admin can manage roles
   - Consider adding `@RequireSuperAdmin()` if role management should be restricted

2. **Permission Checks:** Applied via decorators on individual endpoints

   - Most endpoints use `@Permissions()` decorator
   - Some use role-specific decorators like `@RequireSuperAdmin()`

3. **JWT Strategy:** Must load `roleEntity` for permission checks to work
   - Located in: `rim-admin-backend/src/modules/auth/strategies/jwt.strategy.ts`
   - Should include: `relations: ['roleEntity']`

### Best Practices

1. **Always use JwtAuthGuard first:**

   ```typescript
   @UseGuards(JwtAuthGuard, PermissionsGuard)  // Order matters!
   ```

2. **Use specific permissions:**

   ```typescript
   @Permissions('users', 'write')  // Better than requiring all actions
   ```

3. **Protect sensitive operations:**

   ```typescript
   @RequireSuperAdmin()  // For critical operations
   ```

4. **Validate on backend:** Never trust frontend-only permission checks

## Testing Roles and Permissions

### Test Scenarios

1. **Create Role:**

   - Navigate to `/admin`
   - Click "Add Role"
   - Fill in name, description, and permissions
   - Submit and verify success

2. **Edit Role:**

   - Click edit icon on a role
   - Modify permissions
   - Submit and verify changes

3. **Delete Role:**

   - Click delete icon on a role
   - Verify error if role has assigned users
   - Delete role with no users (should succeed)

4. **Permission Enforcement:**
   - Create role with only "read" permission on "users"
   - Try to create/update user (should fail with 403)
   - Try to view users (should succeed)

## API Endpoints Reference

### Roles Endpoints

```
GET    /admin/roles           - List all roles
GET    /admin/roles/:id       - Get role by ID
POST   /admin/roles           - Create new role
PATCH  /admin/roles/:id       - Update role
DELETE /admin/roles/:id       - Delete role
```

### Request/Response Examples

**Create Role:**

```json
POST /admin/roles
{
  "name": "Support Agent",
  "description": "Can view and respond to support tickets",
  "permissions": [
    {
      "resource": "support",
      "actions": ["read", "write"]
    },
    {
      "resource": "users",
      "actions": ["read"]
    }
  ]
}
```

**Response:**

```json
{
  "id": "uuid",
  "name": "Support Agent",
  "description": "Can view and respond to support tickets",
  "permissions": [...],
  "userCount": 0,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

## Summary

The roles and permissions system provides:

- **Flexible role management** via database-stored permissions
- **Fine-grained access control** at the endpoint level
- **Type-safe permission checking** via decorators
- **Reactive frontend** with proper error handling

**Key Files:**

- Backend Guard: `rim-admin-backend/src/modules/auth/guards/permissions.guard.ts`
- Backend Decorator: `rim-admin-backend/src/modules/auth/decorators/permissions.decorator.ts`
- Backend Controller: `rim-admin-backend/src/modules/admin/controllers/roles.controller.ts`
- Frontend Component: `rim-admin-frontend/src/components/admin/AdminRolesSection.tsx`
- Frontend Form: `rim-admin-frontend/src/components/admin/AdminRoleForm.tsx`
- Frontend Hooks: `rim-admin-frontend/src/services/admin/hooks.ts`
