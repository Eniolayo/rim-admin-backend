# Error Handling

## Exception Rules

### Use Built-in HTTP Exceptions

```typescript
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
```

### Exception Usage Guidelines

- `BadRequestException` (400) - Invalid input data
- `UnauthorizedException` (401) - Missing or invalid authentication
- `ForbiddenException` (403) - Authenticated but not authorized
- `NotFoundException` (404) - Resource not found
- `ConflictException` (409) - Resource already exists
- `UnprocessableEntityException` (422) - Business logic validation failed
- `InternalServerErrorException` (500) - Unexpected errors

## Custom Exceptions

### Create Domain-Specific Exceptions

```typescript
export class UserAlreadyExistsException extends ConflictException {
  constructor(email: string) {
    super(`User with email ${email} already exists`);
  }
}

export class InvalidPasswordException extends BadRequestException {
  constructor() {
    super(
      'Password must contain at least one uppercase, lowercase, and number',
    );
  }
}
```

## Exception Filters

### Global Exception Filter

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
```

### Register Global Filter

```typescript
app.useGlobalFilters(new AllExceptionsFilter());
```

## Error Response Format

### Consistent Error Structure

```typescript
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    "email must be a valid email",
    "password must be at least 8 characters"
  ],
  "timestamp": "2025-10-29T10:30:00.000Z",
  "path": "/api/users"
}
```

## Service Layer Error Handling

### Always Handle Errors in Services

```typescript
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async findById(id: string): Promise<User> {
    try {
      const user = await this.userRepo.findOne({ where: { id } });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Error finding user: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error retrieving user');
    }
  }
}
```

## Never Swallow Errors

**Bad:**

```typescript
try {
  await this.doSomething();
} catch (error) {
  // Silent failure - DON'T DO THIS
}
```

**Good:**

```typescript
try {
  await this.doSomething();
} catch (error) {
  this.logger.error('Error doing something', error.stack);
  throw new InternalServerErrorException('Operation failed');
}
```

## Database Error Handling

```typescript
async create(dto: CreateUserDto): Promise<User> {
  try {
    const user = this.userRepo.create(dto);
    return await this.userRepo.save(user);
  } catch (error) {
    // Handle unique constraint violation
    if (error.code === '23505') {
      throw new ConflictException('Email already exists');
    }

    this.logger.error(`Error creating user: ${error.message}`, error.stack);
    throw new InternalServerErrorException('Failed to create user');
  }
}
```
