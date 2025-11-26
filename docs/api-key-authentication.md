# API Key Authentication for USSD Endpoints

## Overview

This document describes the API key/secret authentication system implemented to protect USSD loans endpoints. The system allows external users to authenticate using API keys and secrets, granting them superAdmin-level access to protected endpoints.

## Table of Contents

1. [Architecture](#architecture)
2. [Entity Structure](#entity-structure)
3. [Authentication Flow](#authentication-flow)
4. [API Endpoints](#api-endpoints)
5. [Usage Examples](#usage-examples)
6. [Security Considerations](#security-considerations)
7. [Error Handling](#error-handling)

## Architecture

### Components

1. **ApiKey Entity** - Stores API key credentials and metadata
2. **ApiKeyService** - Handles generation, validation, and management of API keys
3. **ApiKeyGuard** - Validates API key/secret from request headers
4. **ApiKeysController** - Management endpoints for API keys (SuperAdmin only)
5. **USSD Loans Controller** - Protected endpoints using ApiKeyGuard

### Flow Diagram

```
Request → ApiKeyGuard → ApiKeyService.validateApiKey() → Set request.user → Controller Handler
           ↓                    ↓
    Extract headers      Validate & Load AdminUser
    (x-api-key,         (with superAdmin role)
     x-api-secret)
```

## Entity Structure

### ApiKey Entity

**Location:** `src/entities/api-key.entity.ts`

**Fields:**
- `id` (UUID) - Primary key
- `apiKey` (varchar, unique) - Hashed API key (stored as bcrypt hash)
- `apiKeyHash` (varchar) - Bcrypt hash of the API key for verification
- `apiSecret` (varchar) - Bcrypt hash of the API secret
- `name` (varchar) - External user's name
- `email` (varchar, unique) - External user's email (enforces one key per email)
- `description` (text, nullable) - Optional description
- `status` (enum) - `active`, `inactive`, or `revoked`
- `lastUsedAt` (timestamp, nullable) - Last successful authentication timestamp
- `expiresAt` (timestamp) - Expiration date (30 days from creation)
- `createdBy` (UUID, FK) - SuperAdmin who created the API key
- `createdAt`, `updatedAt` (timestamps) - Audit fields

**Constraints:**
- Unique constraint on `email` ensures one active API key per user
- Unique constraint on `apiKey` field
- Indexes on `apiKey`, `email`, `status`, and `createdBy` for performance

## Authentication Flow

### 1. API Key Generation (SuperAdmin Only)

1. SuperAdmin calls `POST /admin/api-keys` with name, email, and optional description
2. System checks if email already has an active API key (throws error if exists)
3. Verifies creator is a SuperAdmin
4. Generates 32-character API key and 64-character secret
5. Hashes both with bcrypt (10 rounds)
6. Sets expiration to 30 days from creation
7. Saves to database
8. Returns plain values (only shown once)

### 2. API Key Validation

1. Client sends request with `x-api-key` and `x-api-secret` headers
2. `ApiKeyGuard` extracts headers
3. `ApiKeyService.validateApiKey()`:
   - Finds all active API keys
   - Compares provided values against hashed values using `bcrypt.compare`
   - Checks expiration date
   - Verifies status is `active`
   - Updates `lastUsedAt` timestamp
   - Loads creator AdminUser with superAdmin role
   - Returns AdminUser if valid, null otherwise
4. Guard sets `request.user` to the AdminUser
5. Request proceeds to controller handler

## API Endpoints

### Management Endpoints (SuperAdmin Only)

All management endpoints require JWT authentication and SuperAdmin role.

#### Generate API Key

**Endpoint:** `POST /admin/api-keys`

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "description": "API key for USSD integration"
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "apiKey": "abc123def456...",
  "apiSecret": "xyz789uvw012...",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "description": "API key for USSD integration",
  "expiresAt": "2024-02-15T10:30:00.000Z",
  "createdAt": "2024-01-16T10:30:00.000Z",
  "warning": "Store these credentials securely. They will not be shown again."
}
```

**Error Responses:**
- `400 Bad Request` - Email already has an active API key or invalid input
- `403 Forbidden` - User is not a SuperAdmin
- `404 Not Found` - Creator not found

#### List API Keys

**Endpoint:** `GET /admin/api-keys`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "description": "API key for USSD integration",
    "status": "active",
    "lastUsedAt": "2024-01-20T14:30:00.000Z",
    "expiresAt": "2024-02-15T10:30:00.000Z",
    "createdAt": "2024-01-16T10:30:00.000Z",
    "creatorEmail": "admin@rim.ng"
  }
]
```

#### Get API Key by ID

**Endpoint:** `GET /admin/api-keys/:id`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):** Same structure as list item

#### Revoke API Key

**Endpoint:** `DELETE /admin/api-keys/:id`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:** `204 No Content`

### Protected USSD Endpoints

#### Loan Offer

**Endpoint:** `POST /ussd/loan-offer`

**Headers:**
```
x-api-key: <api-key>
x-api-secret: <api-secret>
Content-Type: application/json
```

**Request Body:**
```json
{
  "phoneNumber": "+2348012345678",
  "sessionId": "session-123",
  "network": "mtn",
  "channel": "USSD"
}
```

**Response (200 OK):**
```json
{
  "offers": [
    {
      "amount": 5000,
      "interestRate": 5,
      "duration": 30
    }
  ]
}
```

#### Loan Approve

**Endpoint:** `POST /ussd/loan-approve`

**Headers:**
```
x-api-key: <api-key>
x-api-secret: <api-secret>
Content-Type: application/json
```

**Request Body:**
```json
{
  "phoneNumber": "+2348012345678",
  "loanId": "uuid",
  "sessionId": "session-123"
}
```

**Response (200 OK):**
```json
{
  "status": "approved",
  "message": "Loan approved and queued for disbursement"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing API key/secret
- `400 Bad Request` - Invalid request data
- `404 Not Found` - User or loan not found

## Usage Examples

### cURL Examples

#### Generate API Key (SuperAdmin)

```bash
curl -X POST http://localhost:3000/api/admin/api-keys \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@example.com",
    "description": "API key for USSD integration"
  }'
```

#### Call USSD Loan Offer Endpoint

```bash
curl -X POST http://localhost:3000/api/ussd/loan-offer \
  -H "x-api-key: abc123def456..." \
  -H "x-api-secret: xyz789uvw012..." \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+2348012345678",
    "sessionId": "session-123",
    "network": "mtn"
  }'
```

### JavaScript/TypeScript Examples

#### Using Fetch API

```javascript
// Generate API Key (SuperAdmin)
async function generateApiKey() {
  const response = await fetch('http://localhost:3000/api/admin/api-keys', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'John Doe',
      email: 'john.doe@example.com',
      description: 'API key for USSD integration',
    }),
  });

  const data = await response.json();
  console.log('API Key:', data.apiKey);
  console.log('API Secret:', data.apiSecret);
  // Store securely - these values are only shown once!
}

// Call USSD Loan Offer
async function getLoanOffers(apiKey, apiSecret, phoneNumber) {
  const response = await fetch('http://localhost:3000/api/ussd/loan-offer', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'x-api-secret': apiSecret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phoneNumber: phoneNumber,
      sessionId: 'session-123',
      network: 'mtn',
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}
```

#### Using Axios

```javascript
import axios from 'axios';

// Generate API Key
async function generateApiKey() {
  const { data } = await axios.post(
    'http://localhost:3000/api/admin/api-keys',
    {
      name: 'John Doe',
      email: 'john.doe@example.com',
      description: 'API key for USSD integration',
    },
    {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    }
  );

  return {
    apiKey: data.apiKey,
    apiSecret: data.apiSecret,
  };
}

// Call USSD Endpoint
async function callUssdEndpoint(apiKey, apiSecret, endpoint, payload) {
  const { data } = await axios.post(
    `http://localhost:3000/api/ussd/${endpoint}`,
    payload,
    {
      headers: {
        'x-api-key': apiKey,
        'x-api-secret': apiSecret,
      },
    }
  );

  return data;
}
```

### Postman Configuration

1. **Generate API Key:**
   - Method: POST
   - URL: `{{baseUrl}}/admin/api-keys`
   - Headers:
     - `Authorization: Bearer {{jwtToken}}`
     - `Content-Type: application/json`
   - Body (JSON):
     ```json
     {
       "name": "John Doe",
       "email": "john.doe@example.com",
       "description": "API key for USSD integration"
     }
     ```

2. **Call USSD Endpoint:**
   - Method: POST
   - URL: `{{baseUrl}}/ussd/loan-offer`
   - Headers:
     - `x-api-key: {{apiKey}}`
     - `x-api-secret: {{apiSecret}}`
     - `Content-Type: application/json`
   - Body (JSON):
     ```json
     {
       "phoneNumber": "+2348012345678",
       "sessionId": "session-123",
       "network": "mtn"
     }
     ```

## Security Considerations

### 1. Credential Storage

- **API keys and secrets are hashed** using bcrypt (10 rounds) before storage
- **Plain values are only returned once** during generation
- **Never log or expose** plain API keys or secrets

### 2. Transmission Security

- **Always use HTTPS** in production
- API keys and secrets are sent in headers (not URL parameters)
- Headers are case-insensitive: `x-api-key` or `X-API-Key` both work

### 3. Key Management

- **One API key per email** - enforced at database level
- **30-day expiration** - keys automatically expire after 30 days
- **Revocation support** - keys can be revoked by SuperAdmin
- **Status tracking** - keys can be active, inactive, or revoked

### 4. Access Control

- **Only SuperAdmin users** can create API keys
- **API keys grant superAdmin-level access** when validated
- **Last used timestamp** tracks usage for audit purposes

### 5. Best Practices

- Store API keys securely (environment variables, secret management services)
- Rotate keys regularly (revoke old, generate new)
- Monitor `lastUsedAt` for suspicious activity
- Use different keys for different environments (dev, staging, production)
- Never commit API keys to version control

## Error Handling

### Common Error Responses

#### 401 Unauthorized

**Missing Headers:**
```json
{
  "statusCode": 401,
  "message": "API key and secret are required"
}
```

**Invalid Credentials:**
```json
{
  "statusCode": 401,
  "message": "Invalid API key or secret"
}
```

#### 400 Bad Request

**Duplicate Email:**
```json
{
  "statusCode": 400,
  "message": "An active API key already exists for email: john.doe@example.com"
}
```

**Invalid Input:**
```json
{
  "statusCode": 400,
  "message": ["email must be an email", "name must be longer than or equal to 2 characters"]
}
```

#### 403 Forbidden

**Not SuperAdmin:**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions: Super admin access required"
}
```

#### 404 Not Found

**API Key Not Found:**
```json
{
  "statusCode": 404,
  "message": "API key not found"
}
```

### Error Handling in Code

```typescript
try {
  const response = await fetch('/api/ussd/loan-offer', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'x-api-secret': apiSecret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    // Handle authentication error
    console.error('Invalid API credentials');
    // Possibly regenerate or refresh API key
  } else if (!response.ok) {
    // Handle other errors
    const error = await response.json();
    console.error('Error:', error.message);
  } else {
    const data = await response.json();
    // Process successful response
  }
} catch (error) {
  console.error('Network error:', error);
}
```

## Migration

The API_KEYS table will be created via TypeORM migration. The migration should include:

- Create `API_KEYS` table
- Unique constraint on `email` column
- Unique constraint on `apiKey` column
- Indexes on `apiKey`, `email`, `status`, `createdBy`
- Foreign key constraint to `ADMIN_USERS.createdBy`

## Testing

### Manual Testing Checklist

- [ ] Generate API key with valid SuperAdmin credentials
- [ ] Attempt to generate duplicate API key (should fail)
- [ ] Call USSD endpoint with valid API key/secret
- [ ] Call USSD endpoint with invalid API key/secret (should fail)
- [ ] Call USSD endpoint with missing headers (should fail)
- [ ] Revoke API key and attempt to use it (should fail)
- [ ] List all API keys
- [ ] Get API key by ID

### Integration Testing

Test the complete flow:
1. SuperAdmin generates API key
2. External system uses API key to call USSD endpoints
3. Verify requests are authenticated and authorized
4. Verify `lastUsedAt` is updated
5. Revoke API key
6. Verify revoked key no longer works

## Troubleshooting

### Issue: "API key and secret are required"

**Cause:** Missing or empty headers

**Solution:** Ensure both `x-api-key` and `x-api-secret` headers are present and non-empty

### Issue: "Invalid API key or secret"

**Possible Causes:**
- Incorrect API key or secret
- API key has been revoked
- API key has expired
- API key status is not 'active'

**Solution:**
- Verify credentials are correct
- Check API key status via management endpoint
- Generate new API key if needed

### Issue: "An active API key already exists for email"

**Cause:** Attempting to create a second API key for the same email

**Solution:** 
- Revoke existing API key first, or
- Use the existing API key

### Issue: "Only Super Admin users can create API keys"

**Cause:** User creating API key is not a SuperAdmin

**Solution:** Ensure the authenticated user has SuperAdmin role

## Summary

The API key authentication system provides secure access to USSD endpoints for external integrations. Key features:

- ✅ Secure credential storage (bcrypt hashing)
- ✅ One API key per email (enforced)
- ✅ 30-day automatic expiration
- ✅ Revocation support
- ✅ Usage tracking (`lastUsedAt`)
- ✅ SuperAdmin-level access when validated
- ✅ Comprehensive error handling

For questions or issues, contact the development team.

