# Pre-Commit Checklist

Before committing code, verify all items in this checklist:

## Database & Schema Compliance

- [ ] **Database schema matches `RIM_schema.md` exactly**
- [ ] **All entity relationships follow schema documentation**
- [ ] **Field names, types, and constraints match schema**
- [ ] **Migrations are generated using TypeORM (never written manually)**
- [ ] **Foreign key relationships are correct**
- [ ] **Enum values match schema definitions**

## Architecture & Design

- [ ] No circular dependencies between modules
- [ ] Module imports follow the correct order (third-party, shared, domain)
- [ ] Services use constructor injection
- [ ] Controllers are thin, services handle business logic
- [ ] Repository pattern is used for data access

## Validation & DTOs

- [ ] All DTOs have proper validation decorators
- [ ] Separate DTOs for create/update operations
- [ ] Response DTOs don't expose sensitive data
- [ ] ValidationPipe is configured globally

## Error Handling

- [ ] Using built-in NestJS exceptions
- [ ] Proper error handling with try-catch
- [ ] Error messages don't leak sensitive information
- [ ] All errors are logged with appropriate context

## Configuration

- [ ] No hardcoded configuration values
- [ ] Environment variables are validated
- [ ] Secrets are not committed to repository
- [ ] Configuration uses ConfigModule

## Database & Queries

- [ ] Database queries avoid N+1 problems
- [ ] Indexes are defined on frequently queried fields
- [ ] Transactions are used for multi-step operations
- [ ] Query results are paginated for large datasets

## Security

- [ ] All routes protected with appropriate guards
- [ ] Input validation on all DTOs
- [ ] Passwords are hashed with bcrypt
- [ ] JWT tokens have expiration
- [ ] SQL injection is prevented (parameterized queries)
- [ ] XSS is prevented (input sanitization)

## Code Quality

- [ ] TypeScript strict mode is enabled
- [ ] No `any` types used
- [ ] No `@ts-ignore` comments
- [ ] All functions have explicit return types
- [ ] Code follows naming conventions

## Logging

- [ ] Logging is implemented for important operations
- [ ] Using NestJS Logger instead of console.log
- [ ] No passwords/tokens in logs
- [ ] Appropriate log levels used (log, warn, error, debug)

## Performance

- [ ] No blocking synchronous operations in request handlers
- [ ] Caching implemented for frequently accessed data
- [ ] CPU-intensive tasks are offloaded to background jobs
- [ ] Connection pooling is configured

## Testing

- [ ] Tests are written for business logic
- [ ] Unit tests mock external dependencies
- [ ] Edge cases and error conditions are tested
- [ ] Tests are passing

## Documentation

- [ ] API endpoints documented with Swagger
- [ ] Complex logic has explanatory comments
- [ ] README updated if needed
- [ ] Migration documentation updated

## Final Checks

- [ ] Code builds successfully
- [ ] No linter errors
- [ ] All tests pass
- [ ] Git commit message is descriptive
- [ ] Related documentation is updated

## Common Issues to Avoid

- [ ] Not using God Services
- [ ] Not bypassing the DI container
- [ ] Not using `any` type
- [ ] Not ignoring TypeScript errors
- [ ] Not creating deep module hierarchies
- [ ] Not using `console.log` for logging
- [ ] Not mixing business logic in middleware/guards/interceptors
