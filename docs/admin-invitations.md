# Admin Invitation System

## Overview

The Admin Invitation System allows Super Admins to invite new administrators to the platform via email. Invited users receive a secure token link that allows them to complete their account setup, including password creation and mandatory 2FA configuration.

## Architecture

### Components

1. **Entity**: `AdminInvitation` - Stores invitation data
2. **Repository**: `InvitationRepository` - Data access layer
3. **Service**: `InvitationsService` - Business logic layer
4. **Controller**: `InvitationsController` - API endpoints
5. **DTOs**: Request/Response data transfer objects

### Database Schema

```typescript
ADMIN_INVITATIONS
├── id (UUID, Primary Key)
├── email (VARCHAR, Indexed)
├── role (ENUM: super_admin | admin | moderator)
├── inviteToken (VARCHAR, Unique, Indexed)
├── invitedBy (UUID, FK → ADMIN_USERS.id)
├── invitedByName (VARCHAR, Denormalized)
├── createdAt (TIMESTAMP)
├── expiresAt (TIMESTAMP, Indexed)
├── acceptedAt (TIMESTAMP, Nullable)
└── status (ENUM: pending | accepted | expired, Indexed)
```

## Role Mapping

The system maps frontend role identifiers to backend role names:

| Frontend Role | Backend Role Name |
|--------------|-------------------|
| `super_admin` | "Super Admin" |
| `admin` | "Finance Officer" |
| `moderator` | "Support Agent" |

This mapping ensures that invitations use consistent role identifiers while the backend maintains human-readable role names.

## Complete Flow

### 1. Invitation Creation

**Endpoint**: `POST /api/admin/invitations`  
**Access**: Super Admin only

**Request**:
```json
{
  "email": "newadmin@example.com",
  "role": "admin"
}
```

**Process**:
1. Validate email format and check for duplicate pending invitations
2. Verify email is not already registered as an admin user
3. Map frontend role to backend role name
4. Find the role in the database by name
5. Generate a secure 64-character hex token using `crypto.randomBytes(32)`
6. Create invitation with 7-day expiration
7. Store invitation in database

**Response**: `AdminInvitationResponseDto` with invitation details including token

**Error Cases**:
- `400 Bad Request`: Duplicate email invitation, email already registered, invalid role
- `404 Not Found`: Role not found in system
- `403 Forbidden`: User is not a Super Admin
- `500 Internal Server Error`: Database or system errors

### 2. Invitation Verification

**Endpoint**: `GET /api/admin/invitations/verify/:token`  
**Access**: Public (no authentication required)

**Process**:
1. Look up invitation by token
2. Check if invitation exists
3. Verify invitation status (not already accepted)
4. Check expiration date
5. Auto-mark as expired if past expiration date

**Response**:
```json
{
  "valid": true,
  "invitation": {
    "id": "...",
    "email": "newadmin@example.com",
    "role": "admin",
    "expiresAt": "2024-01-15T00:00:00Z",
    "status": "pending"
  }
}
```

Or if invalid:
```json
{
  "valid": false,
  "message": "This invitation has expired"
}
```

**Error Cases**:
- Returns `valid: false` with descriptive message for invalid/expired/already-used tokens
- `500 Internal Server Error`: System errors (returns valid: false with error message)

### 3. Account Setup

**Endpoint**: `POST /api/admin/invitations/setup`  
**Access**: Public (no authentication required)

**Request**:
```json
{
  "inviteToken": "abc123...",
  "name": "John Doe",
  "password": "SecurePassword123"
}
```

**Password Requirements**:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

**Process**:
1. Verify invitation token (same checks as verification endpoint)
2. Check if email already has an account
3. Map frontend role to backend role name
4. Find role in database
5. Hash password using bcrypt (10 rounds)
6. Generate username from name (lowercase, spaces → dots)
7. Handle username conflicts by appending numbers
8. Create `AdminUser` with:
   - `twoFactorEnabled: false` ⚠️ **CRITICAL**
   - `status: ACTIVE`
   - `roleId` from found role
   - `createdBy` from invitation
9. Mark invitation as accepted with timestamp

**Response**: `AdminUserResponseDto` with created user details

**Error Cases**:
- `400 Bad Request`: Invalid token, expired invitation, already used, email already registered
- `500 Internal Server Error`: Role not found, database errors

### 4. First Login & 2FA Setup (Automatic Flow)

After account setup, when the new admin logs in:

**Endpoint**: `POST /api/auth/login`

**Process**:
1. User provides email and password
2. Auth service validates credentials
3. **Auth service checks `twoFactorEnabled` field**
4. Since `twoFactorEnabled === false`, returns:
   ```json
   {
     "user": { ... },
     "status": "MFA_SETUP_REQUIRED",
     "sessionToken": "abc123...",
     "expiresAt": "2024-01-08T10:10:00Z"
   }
   ```

**2FA Setup Flow**:

1. **Start Setup** (`POST /api/auth/2fa/setup`):
   - Uses `sessionToken` from login response
   - Generates OTP secret
   - Creates QR code
   - Generates backup codes
   - Returns QR code data URL and backup codes

2. **Verify Setup** (`POST /api/auth/2fa/verify-setup`):
   - User scans QR code and enters 6-digit code
   - System verifies code against secret
   - Enables 2FA on account
   - Returns `MFA_ENABLED` status with temporary hash

3. **Complete Login**:
   - User must now provide 2FA code for subsequent logins
   - System returns JWT tokens after successful 2FA verification

**This ensures all new admins MUST complete 2FA setup before accessing the system.**

### 5. Invitation Management

#### List Invitations

**Endpoint**: `GET /api/admin/invitations`  
**Access**: Super Admin only

Returns all invitations ordered by creation date (newest first).

#### Resend Invitation

**Endpoint**: `POST /api/admin/invitations/:id/resend`  
**Access**: Super Admin only

**Process**:
1. Find invitation by ID
2. Verify status is `pending`
3. Check invitation hasn't expired
4. Generate new token
5. Extend expiration by 7 days
6. Update invitation record

**Error Cases**:
- `404 Not Found`: Invitation doesn't exist
- `400 Bad Request`: Invitation already accepted or expired
- `403 Forbidden`: Not a Super Admin

#### Cancel Invitation

**Endpoint**: `DELETE /api/admin/invitations/:id`  
**Access**: Super Admin only

**Process**:
1. Find invitation by ID
2. Delete invitation record

**Error Cases**:
- `404 Not Found`: Invitation doesn't exist
- `403 Forbidden`: Not a Super Admin

## Security Features

### Token Security
- **64-character hex tokens** generated using cryptographically secure `randomBytes`
- **Unique constraint** on database prevents token collisions
- **7-day expiration** limits window for account setup
- **One-time use** via status tracking (pending → accepted)

### Password Security
- **Bcrypt hashing** with 10 rounds
- **Strong password requirements** enforced via DTO validation
- Passwords never stored in plain text

### Access Control
- **Super Admin only** for invitation management
- **Public endpoints** for verification and setup (token-based security)
- **Role-based access** enforced via guards and decorators

### 2FA Enforcement
- **Mandatory 2FA setup** for all new admin accounts
- **Cannot bypass** - `twoFactorEnabled: false` forces setup flow
- **Backup codes** generated during setup for account recovery

## Error Handling Strategy

### Repository Layer
- Catches database errors
- Handles constraint violations (duplicate tokens/emails)
- Converts database errors to `InternalServerErrorException`
- Re-throws `NotFoundException` for missing records

### Service Layer
- Validates business rules
- Throws `BadRequestException` for invalid input
- Throws `NotFoundException` for missing resources
- Wraps unexpected errors in `InternalServerErrorException`
- Provides descriptive error messages

### Controller Layer
- Uses NestJS validation pipes for DTO validation
- Returns appropriate HTTP status codes
- Documents all error responses in Swagger
- Logs all operations for audit trail

## API Endpoints Summary

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/admin/invitations` | Super Admin | Create invitation |
| GET | `/admin/invitations` | Super Admin | List all invitations |
| GET | `/admin/invitations/verify/:token` | Public | Verify invitation token |
| POST | `/admin/invitations/setup` | Public | Set up admin account |
| POST | `/admin/invitations/:id/resend` | Super Admin | Resend invitation |
| DELETE | `/admin/invitations/:id` | Super Admin | Cancel invitation |

## Data Flow Diagram

```
┌─────────────┐
│ Super Admin │
└──────┬──────┘
       │
       │ POST /admin/invitations
       │ { email, role }
       ▼
┌──────────────────┐
│ InvitationsService│
│  - Validate email │
│  - Map role       │
│  - Generate token │
│  - Create record  │
└──────┬───────────┘
       │
       │ Store in DB
       ▼
┌──────────────────┐
│ AdminInvitation  │
│  - Token sent     │
│  - 7-day expiry   │
└──────┬───────────┘
       │
       │ User clicks link
       ▼
┌──────────────────┐
│ Verify Token     │
│ GET /verify/:token│
└──────┬───────────┘
       │
       │ Valid token
       ▼
┌──────────────────┐
│ Setup Account    │
│ POST /setup      │
│  - Create user   │
│  - twoFactor:false│
└──────┬───────────┘
       │
       │ User logs in
       ▼
┌──────────────────┐
│ Login Response   │
│ status: MFA_SETUP│
│ _REQUIRED        │
└──────┬───────────┘
       │
       │ User completes
       ▼
┌──────────────────┐
│ 2FA Setup Flow   │
│  - QR Code       │
│  - Verify Code    │
│  - Enable 2FA    │
└──────┬───────────┘
       │
       │ 2FA Enabled
       ▼
┌──────────────────┐
│ Active Admin     │
│ Account Ready    │
└──────────────────┘
```

## Testing Considerations

### Unit Tests Should Cover:
- Role mapping correctness
- Token generation uniqueness
- Password hashing
- Username generation and conflict resolution
- Expiration checking logic
- Status transitions

### Integration Tests Should Cover:
- Complete invitation flow
- Token verification
- Account setup
- 2FA enforcement
- Error scenarios
- Access control

### Edge Cases:
- Duplicate email invitations
- Expired invitations
- Already accepted invitations
- Username conflicts
- Role not found
- Database constraint violations

## Migration Notes

The `AdminInvitation` entity requires a database migration. The migration should:

1. Create `ADMIN_INVITATIONS` table
2. Add enum types for `AdminInvitationRole` and `AdminInvitationStatus`
3. Create indexes on `inviteToken`, `email`, `status`, and `expiresAt`
4. Add foreign key constraint on `invitedBy` → `ADMIN_USERS.id`

**Note**: Do not run migrations automatically. Generate and review the migration file before applying.

## Future Enhancements

Potential improvements:
- Email notifications when invitations are sent
- Automatic expiration cleanup job
- Invitation analytics (acceptance rates, time to setup)
- Bulk invitation support
- Custom expiration periods
- Invitation templates

