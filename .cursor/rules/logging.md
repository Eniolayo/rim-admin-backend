# Logging Best Practices

## Use NestJS Logger

Always use the built-in Logger from `@nestjs/common` instead of `console.log`.

```typescript
import { Logger, Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async findUser(id: string): Promise<User> {
    this.logger.log(`Finding user with id: ${id}`);

    try {
      const user = await this.userRepo.findOne({ where: { id } });

      if (!user) {
        this.logger.warn(`User not found: ${id}`);
        throw new NotFoundException('User not found');
      }

      this.logger.debug(`User found: ${user.email}`);
      return user;
    } catch (error) {
      this.logger.error(`Error finding user: ${error.message}`, error.stack);
      throw error;
    }
  }
}
```

## Log Levels

### LOG - General Information

```typescript
this.logger.log('User created successfully');
this.logger.log(`Processing order: ${orderId}`);
```

### DEBUG - Detailed Debug Information

```typescript
this.logger.debug(`Query params: ${JSON.stringify(params)}`);
this.logger.debug(`Cache hit for key: ${cacheKey}`);
```

### WARN - Warning Messages

```typescript
this.logger.warn(`Low stock alert for product: ${productId}`);
this.logger.warn(`API rate limit approaching for user: ${userId}`);
```

### ERROR - Error Messages

```typescript
this.logger.error(`Failed to process payment: ${error.message}`, error.stack);
this.logger.error(`Database connection lost`, error.stack);
```

### VERBOSE - Very Detailed Information

```typescript
this.logger.verbose(`Request received: ${req.method} ${req.url}`);
this.logger.verbose(`Response sent: ${res.statusCode}`);
```

## What to Log

### DO Log:

- Important business events (user registration, order placed)
- Errors and exceptions with stack traces
- Performance metrics (slow queries, API response times)
- Security events (failed login attempts, unauthorized access)
- Integration points (external API calls)
- Background job start/completion

### DON'T Log:

- Passwords or sensitive credentials
- Full credit card numbers
- Personal identification numbers (SSN, etc.)
- API keys or tokens
- Excessive debug information in production

## Structured Logging

```typescript
this.logger.log({
  message: 'User created',
  userId: user.id,
  email: user.email,
  timestamp: new Date().toISOString(),
});
```

## Request/Response Logging

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const delay = Date.now() - now;

        this.logger.log(`${method} ${url} ${response.statusCode} - ${delay}ms`);
      }),
    );
  }
}
```

## Context-Aware Logging

```typescript
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async create(dto: CreateUserDto, requestId?: string) {
    const context = requestId ? `[${requestId}]` : '';

    this.logger.log(`${context} Creating user: ${dto.email}`);
    // ...
  }
}
```

## Production Logging Configuration

```typescript
// main.ts
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  await app.listen(3000);
}
```

## Never Log Sensitive Data

**BAD:**

```typescript
this.logger.log(`User login: ${email}, password: ${password}`);
this.logger.log(`Credit card: ${cardNumber}`);
this.logger.log(`JWT token: ${token}`);
```

**GOOD:**

```typescript
this.logger.log(`User login attempt: ${email}`);
this.logger.log(`Payment processed for order: ${orderId}`);
this.logger.log(`User authenticated: ${userId}`);
```
