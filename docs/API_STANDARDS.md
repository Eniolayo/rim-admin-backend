# API Standards Implementation

This document describes the API standards implemented in the RIM Admin Backend API.

## Overview

The RIM API follows industry-standard protocols and specifications to ensure security, interoperability, and compliance:

- **OpenAPI 3.0**: Complete API specification
- **OAuth 2.0**: Industry-standard authentication
- **TLS 1.3**: Latest encryption protocol
- **REST**: RESTful API design principles

## OpenAPI 3.0 Specification

### Implementation

The API uses NestJS Swagger module to generate OpenAPI 3.0 compliant documentation.

**Access Points:**
- **Swagger UI**: `https://api.rim.ng/api/docs`
- **OpenAPI JSON**: `https://api.rim.ng/api/docs-json`
- **OpenAPI YAML**: `https://api.rim.ng/api/docs-yaml`

### Features

1. **Complete API Documentation**
   - All endpoints documented with request/response schemas
   - Example requests and responses
   - Error response documentation

2. **Multiple Authentication Methods**
   - Bearer Token (JWT) for admin users
   - API Key for external integrations
   - OAuth 2.0 for third-party applications

3. **Server Definitions**
   - Production: `https://api.rim.ng/api`
   - Staging: `https://staging-api.rim.ng/api`
   - Development: `http://localhost:3000/api`

4. **Tag Organization**
   - Endpoints grouped by functionality
   - Links to design documentation

### Example OpenAPI Schema

```yaml
openapi: 3.0.0
info:
  title: RIM Admin API
  version: 1.0.0
  description: RIM Admin Backend API Documentation - OpenAPI 3.0 Compliant
servers:
  - url: https://api.rim.ng/api
    description: Production Server
  - url: https://staging-api.rim.ng/api
    description: Staging Server
security:
  - bearer: []
  - api-key: []
  - oauth2: []
```

## OAuth 2.0 Authentication

### Supported Flows

1. **Client Credentials Flow** (Implemented)
   - For server-to-server integrations (MNO, USSD)
   - No user interaction required
   - Scopes: `mno:eligibility`, `mno:fulfillment`, `mno:repayment`, `mno:enquiry`

2. **Authorization Code Flow** (Placeholder)
   - For user-facing applications
   - Requires user consent
   - Scopes: `read:loans`, `write:loans`, `read:users`, `write:users`, etc.

3. **Refresh Token Flow** (Placeholder)
   - For token renewal
   - Extends session without re-authentication

### Token Endpoint

**Endpoint**: `POST /api/auth/oauth/token`

**Request Example (Client Credentials)**:
```json
{
  "grant_type": "client_credentials",
  "client_id": "airtel@rim.ng",
  "client_secret": "your-client-secret",
  "scope": "mno:eligibility mno:fulfillment mno:repayment mno:enquiry"
}
```

**Response Example**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "mno:eligibility mno:fulfillment mno:repayment mno:enquiry"
}
```

### Using OAuth 2.0 Tokens

Include the access token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer <access_token>" \
     https://api.rim.ng/api/mno/eligibility
```

### OAuth 2.0 Guard

The `OAuth2Guard` validates OAuth 2.0 access tokens and extracts:
- User/Client ID
- Scopes
- Grant type

### Scope-Based Authorization

Endpoints can require specific scopes:

```typescript
@UseGuards(OAuth2Guard)
@ApiSecurity('oauth2', ['mno:eligibility'])
@Post('eligibility')
async checkEligibility() {
  // Requires 'mno:eligibility' scope
}
```

## API Key Authentication

### Implementation

API keys are 96-character tokens with 30-day expiration.

**Header**: `X-API-TOKEN`

**Example**:
```bash
curl -H "X-API-TOKEN: <96-character-token>" \
     https://api.rim.ng/api/mno/eligibility
```

### Features

- **Rate Limiting**: 1000 requests/minute per API key
- **Automatic Expiration**: 30 days from creation
- **Immediate Revocation**: Can be revoked at any time
- **Audit Trail**: Tracks last used timestamp

## TLS 1.3 Support

### Configuration

TLS 1.3 is configured at the reverse proxy/load balancer level. See [TLS 1.3 Configuration Guide](./TLS_1.3_CONFIGURATION.md) for details.

### Requirements

- **Production**: TLS 1.3 required
- **Minimum**: TLS 1.2 acceptable for development
- **Cipher Suites**: Modern cipher suites (AES-GCM, ChaCha20-Poly1305)

### Verification

Test TLS 1.3 support:

```bash
# Using OpenSSL
openssl s_client -connect api.rim.ng:443 -tls1_3

# Using curl
curl --tlsv1.3 https://api.rim.ng/api/health
```

## REST API Design

### Principles

1. **Resource-Based URLs**
   - `/api/users/{id}` - Get user
   - `/api/loans/{id}` - Get loan
   - `/api/mno/eligibility` - Check eligibility

2. **HTTP Methods**
   - `GET` - Retrieve resources
   - `POST` - Create resources or trigger actions
   - `PATCH` - Partial updates
   - `DELETE` - Remove resources

3. **Status Codes**
   - `200` - Success
   - `201` - Created
   - `400` - Bad Request
   - `401` - Unauthorized
   - `403` - Forbidden
   - `404` - Not Found
   - `429` - Too Many Requests
   - `500` - Internal Server Error

4. **Response Format**
   ```json
   {
     "status": "success",
     "data": { ... },
     "message": "Operation completed"
   }
   ```

5. **Error Format**
   ```json
   {
     "status": "error",
     "message": "Error description",
     "errorCode": "ERROR_CODE",
     "requestId": "optional-request-id"
   }
   ```

## Authentication Methods Comparison

| Method | Use Case | Token Format | Expiration | Rate Limit |
|--------|----------|--------------|------------|------------|
| **JWT Bearer** | Admin users | JWT token | 1 hour | 100/min |
| **API Key** | External integrations | 96-char token | 30 days | 1000/min |
| **OAuth 2.0** | Third-party apps | JWT access token | 1 hour | 1000/min |

## Compliance

### Standards Compliance

- ✅ **OpenAPI 3.0**: Full specification compliance
- ✅ **OAuth 2.0**: RFC 6749 compliant
- ✅ **TLS 1.3**: RFC 8446 compliant
- ✅ **REST**: RESTful design principles
- ✅ **JWT**: RFC 7519 compliant

### Security Standards

- ✅ **PCI DSS**: TLS 1.3 encryption
- ✅ **GDPR**: Secure data transmission
- ✅ **ISO 27001**: Network security controls
- ✅ **NIST**: TLS recommendations (SP 800-52 Rev. 2)

## Testing

### OpenAPI Specification Validation

```bash
# Validate OpenAPI spec
npx swagger-cli validate http://localhost:3000/api/docs-json

# Generate client SDKs
npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:3000/api/docs-json \
  -g typescript-axios \
  -o ./generated-client
```

### OAuth 2.0 Testing

```bash
# Get access token
curl -X POST https://api.rim.ng/api/auth/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "airtel@rim.ng",
    "client_secret": "secret",
    "scope": "mno:eligibility"
  }'

# Use access token
curl -H "Authorization: Bearer <token>" \
     https://api.rim.ng/api/mno/eligibility
```

## Documentation

- [OpenAPI Specification](./README.md#api-documentation)
- [OAuth 2.0 Implementation](./README.md#oauth-20)
- [TLS 1.3 Configuration](./TLS_1.3_CONFIGURATION.md)
- [API Key Authentication](./admin-api-key-design.md)

## Support

For API standards questions or issues:
- **Technical Support**: support@rim.ng
- **Documentation**: https://api.rim.ng/api/docs
- **Status Page**: https://status.rim.ng
