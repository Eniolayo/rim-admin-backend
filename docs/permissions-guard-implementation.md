# Permission-Based Authorization Guard Implementation

## Overview

This document describes the implementation of a permission-based authorization guard system for the RIM Admin Backend. The system allows fine-grained control over API endpoint access based on admin user roles and their associated permissions stored in the database.

## Architecture

The permission system consists of three main components:

1. **Decorators** - Metadata decorators that specify permission requirements
2. **Guard** - The `PermissionsGuard` that enforces permission checks
3. **Database** - Permission data stored in `AdminRole.permissions` (JSONB)

### Flow Diagram

```
Request → JwtAuthGuard → PermissionsGuard → Controller Handler
           ↓                    ↓
    Validates JWT      Checks Permissions
    Loads User         from roleEntity
```

## Components

### 1. Permissions Decorator

**File:** `src/modules/auth/decorators/permissions.decorator.ts`

The `@Permissions()` decorator allows you to specify resource-based permission requirements for endpoints.

**Usage:**
```typescript
@Permissions('users', 'write')
@Get('users')
async getUsers() {
  // Only users with 'write' permission on 'users' resource can access
}
```

**Parameters:**
- `resource` (string): The resource name (e.g., 'users', 'loans', 'transactions')
- `...actions` (PermissionAction[]): One or more actions required ('read', 'write', 'delete')
  - If no actions specified, defaults to ['read', 'write', 'delete']

**Example:**
```typescript
// Require 'write' permission on 'users' resource
@Permissions('users', 'write')
@Post('users')
async createUser() { }

// Require both 'read' and 'write' permissions
@Permissions('loans', 'read', 'write')
@Patch('loans/:id')
async updateLoan() { }
```

### 2. RequireSuperAdmin Decorator

**File:** `src/modules/auth/decorators/require-super-admin.decorator.ts`

The `@RequireSuperAdmin()` decorator is a convenience wrapper that restricts access to users with the "Super Admin" role.

**Usage:**
```typescript
@RequireSuperAdmin()
@Patch('users/:id/status')
async updateUserStatus() {
  // Only Super Admin users can access
}
```

**How it works:**
- Checks if the authenticated user's role name (case-insensitive) is "Super Admin"
- Throws `ForbiddenException` if the user is not a super admin

### 3. PermissionsGuard

**File:** `src/modules/auth/guards/permissions.guard.ts`

The `PermissionsGuard` implements NestJS's `CanActivate` interface and performs the actual permission validation.

**How it works:**

1. **Extracts user from request**: Gets the authenticated `AdminUser` from the request object (set by `JwtAuthGuard`)

2. **Checks for decorators**: Uses NestJS `Reflector` to check for:
   - `@RequireSuperAdmin()` decorator
   - `@Permissions()` decorator

3. **Validates permissions**:
   - For `@RequireSuperAdmin()`: Checks if `user.roleEntity.name.toLowerCase() === 'super admin'`
   - For `@Permissions()`: 
     - Finds permission in `user.roleEntity.permissions` array matching the resource
     - Verifies user has all required actions for that resource

4. **Error handling**:
   - Throws `ForbiddenException` with descriptive messages if permission check fails
   - Logs warnings for security auditing

## Permission Structure

Permissions are stored in the `AdminRole` entity as a JSONB array:

```typescript
interface Permission {
  resource: string;
  actions: ('read' | 'write' | 'delete')[];
}
```

**Example from database:**
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
    }
  ]
}
```

## Usage Examples

### Example 1: Super Admin Only Endpoint

```typescript
import { RequireSuperAdmin } from '../../auth/decorators/require-super-admin.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('admin/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  @Patch(':id/status')
  @RequireSuperAdmin()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async updateStatus(@Param('id') id: string) {
    // Only Super Admin can update user status
  }
}
```

### Example 2: Resource-Based Permission

```typescript
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';

@Controller('loans')
@UseGuards(JwtAuthGuard)
export class LoansController {
  @Get()
  @Permissions('loans', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async listLoans() {
    // Requires 'read' permission on 'loans' resource
  }

  @Post()
  @Permissions('loans', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async createLoan() {
    // Requires 'write' permission on 'loans' resource
  }

  @Delete(':id')
  @Permissions('loans', 'delete')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async deleteLoan(@Param('id') id: string) {
    // Requires 'delete' permission on 'loans' resource
  }
}
```

### Example 3: Multiple Actions Required

```typescript
@Patch('loans/:id/approve')
@Permissions('loans', 'read', 'write')
@UseGuards(JwtAuthGuard, PermissionsGuard)
async approveLoan(@Param('id') id: string) {
  // Requires both 'read' and 'write' permissions on 'loans' resource
}
```

## Guard Registration

The `PermissionsGuard` is registered in the `AuthModule`:

```typescript
@Module({
  providers: [
    // ... other providers
    PermissionsGuard,
  ],
  exports: [
    // ... other exports
    PermissionsGuard,
  ],
})
export class AuthModule {}
```

This makes it available for use in any module that imports `AuthModule`.

## Error Messages

The guard provides descriptive error messages for different failure scenarios:

1. **No user in request context:**
   ```
   "User not authenticated"
   ```

2. **User role not found:**
   ```
   "User role not found"
   ```

3. **Super admin check failed:**
   ```
   "Insufficient permissions: Super admin access required"
   ```

4. **Resource permission not found:**
   ```
   "Insufficient permissions: Access to resource 'users' is required"
   ```

5. **Action permission not found:**
   ```
   "Insufficient permissions: Required actions [write, delete] for resource 'users'"
   ```

## Database Requirements

For the guard to work correctly:

1. **User must have roleEntity loaded**: The `JwtStrategy` loads the user with `roleEntity` relation:
   ```typescript
   async validate(payload: JwtPayload): Promise<AdminUser> {
     const user = await this.authService.validateUserById(payload.sub);
     return user; // user.roleEntity is loaded
   }
   ```

2. **Role must have permissions**: The `AdminRole` entity must have a `permissions` array populated

3. **Role name for Super Admin**: The role name must be exactly "Super Admin" (case-insensitive)

## Security Considerations

1. **Always use JwtAuthGuard first**: The `PermissionsGuard` relies on `JwtAuthGuard` to authenticate and load the user:
   ```typescript
   @UseGuards(JwtAuthGuard, PermissionsGuard) // Order matters!
   ```

2. **Guard order matters**: Guards execute in the order specified. `JwtAuthGuard` must run before `PermissionsGuard`.

3. **No permission decorator = allow**: If neither `@Permissions()` nor `@RequireSuperAdmin()` is present, the guard allows access (assuming JWT authentication passed).

4. **Logging**: The guard logs all permission check failures for security auditing.

## Troubleshooting

### Issue: "User role not found"

**Cause:** The user's `roleEntity` is not loaded or is null.

**Solution:** 
- Ensure `JwtStrategy.validate()` loads the user with `roleEntity` relation
- Check that the user has a valid `roleId` in the database

### Issue: "Insufficient permissions" even for Super Admin

**Cause:** Role name doesn't match exactly "Super Admin" (case-insensitive).

**Solution:**
- Check the role name in the database: `SELECT name FROM ADMIN_ROLES WHERE name ILIKE 'super admin';`
- Ensure the role name is exactly "Super Admin" (with space and proper capitalization)

### Issue: Permission check always fails

**Cause:** Resource name mismatch or actions not included in role permissions.

**Solution:**
- Verify the resource name in `@Permissions()` matches exactly with the resource name in the database
- Check that the role has the required actions in its permissions array
- Review the `AdminRole.permissions` JSONB data

### Issue: Guard not executing

**Cause:** Guard not added to `@UseGuards()` or not registered in module.

**Solution:**
- Ensure `PermissionsGuard` is in the `@UseGuards()` array
- Verify `PermissionsGuard` is registered in `AuthModule` providers and exports
- Check that the module using the guard imports `AuthModule`

## Testing

When testing endpoints protected by the guard:

1. **Test with Super Admin user:**
   ```typescript
   const superAdmin = await createTestUser({ role: 'Super Admin' });
   const token = await login(superAdmin);
   // Should succeed
   ```

2. **Test with regular admin:**
   ```typescript
   const admin = await createTestUser({ role: 'Support Agent' });
   const token = await login(admin);
   // Should fail with 403 Forbidden
   ```

3. **Test permission-based access:**
   ```typescript
   const userWithReadOnly = await createTestUser({
     role: 'Support Agent', // Has only 'read' on 'users'
   });
   // GET /users should succeed
   // POST /users should fail with 403
   ```

## Future Enhancements

Potential improvements to the permission system:

1. **Permission caching**: Cache role permissions in Redis to reduce database queries
2. **Dynamic permissions**: Allow permissions to be updated without code changes
3. **Permission inheritance**: Support hierarchical permission structures
4. **Audit logging**: Log all permission checks to an audit table
5. **Permission decorator chaining**: Support multiple `@Permissions()` decorators with AND/OR logic

