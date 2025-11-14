# Common Anti-Patterns to Avoid

## 1. God Services

Services that do everything are hard to test and maintain.

**BAD:**

```typescript
@Injectable()
export class UserService {
  // User CRUD
  async findAll() {}
  async create() {}
  async update() {}

  // Email operations
  async sendWelcomeEmail() {}
  async sendPasswordReset() {}

  // Payment operations
  async processPayment() {}
  async refundPayment() {}

  // Analytics
  async trackUserActivity() {}
  async generateReport() {}

  // Notifications
  async sendPushNotification() {}

  // Too many responsibilities!
}
```

**GOOD:**

```typescript
@Injectable()
export class UserService {
  // Only user CRUD operations
  async findAll() {}
  async create() {}
  async update() {}
}

@Injectable()
export class EmailService {
  async sendWelcomeEmail() {}
  async sendPasswordReset() {}
}

@Injectable()
export class PaymentService {
  async processPayment() {}
  async refundPayment() {}
}
```

## 2. Bypassing Dependency Injection

Never instantiate services directly.

**BAD:**

```typescript
@Injectable()
export class OrderService {
  async createOrder() {
    // DON'T create instances manually
    const emailService = new EmailService();
    await emailService.sendOrderConfirmation();
  }
}
```

**GOOD:**

```typescript
@Injectable()
export class OrderService {
  constructor(private readonly emailService: EmailService) {}

  async createOrder() {
    await this.emailService.sendOrderConfirmation();
  }
}
```

## 3. Using `any` Type

Avoid `any` - it defeats TypeScript's purpose.

**BAD:**

```typescript
async findUser(id: any): Promise<any> {
  const result: any = await this.userRepo.findOne({ where: { id } });
  return result;
}
```

**GOOD:**

```typescript
async findUser(id: string): Promise<User> {
  const user = await this.userRepo.findOne({ where: { id } });
  if (!user) {
    throw new NotFoundException('User not found');
  }
  return user;
}
```

## 4. Ignoring TypeScript Errors

Never use `@ts-ignore` or `@ts-expect-error` without understanding the issue.

**BAD:**

```typescript
// @ts-ignore
const result = someComplexOperation();
```

**GOOD:**

```typescript
// Fix the underlying type issue
interface OperationResult {
  success: boolean;
  data?: any;
}

const result: OperationResult = someComplexOperation();
```

## 5. Deep Module Hierarchies

Keep module structure flat and simple.

**BAD:**

```
src/
  modules/
    core/
      shared/
        common/
          base/
            user/  # Too deep!
```

**GOOD:**

```
src/
  modules/
    user/
    auth/
    order/
  common/
  config/
```

## 6. Using `console.log` for Logging

Use NestJS Logger instead of console.log.

**BAD:**

```typescript
@Injectable()
export class UserService {
  async create(dto: CreateUserDto) {
    console.log('Creating user', dto);
    // ...
  }
}
```

**GOOD:**

```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async create(dto: CreateUserDto) {
    this.logger.log(`Creating user: ${dto.email}`);
    // ...
  }
}
```

## 7. Business Logic in Middleware/Guards/Interceptors

Keep them focused on their single responsibility.

**BAD:**

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // DON'T put business logic in guards
    const user = request.user;
    if (user.credits < 10) {
      // Send email
      // Update database
      // Log analytics
      return false;
    }

    return true;
  }
}
```

**GOOD:**

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // Only authentication/authorization logic
    return !!request.user;
  }
}

// Put business logic in services
@Injectable()
export class CreditService {
  async checkCredits(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (user.credits < 10) {
      await this.emailService.sendLowCreditsWarning(user);
      await this.analyticsService.trackLowCredits(user);
      return false;
    }

    return true;
  }
}
```

## 8. Circular Dependencies

Avoid modules that import each other.

**BAD:**

```typescript
// user.module.ts
@Module({
  imports: [OrderModule], // Imports OrderModule
})
export class UserModule {}

// order.module.ts
@Module({
  imports: [UserModule], // Also imports UserModule - CIRCULAR!
})
export class OrderModule {}
```

**GOOD - Use Shared Module:**

```typescript
// shared.module.ts
@Module({
  providers: [SharedService],
  exports: [SharedService],
})
export class SharedModule {}

// user.module.ts
@Module({
  imports: [SharedModule],
})
export class UserModule {}

// order.module.ts
@Module({
  imports: [SharedModule],
})
export class OrderModule {}
```

**GOOD - Use Events:**

```typescript
// user.service.ts
@Injectable()
export class UserService {
  constructor(private eventEmitter: EventEmitter2) {}

  async createUser(dto: CreateUserDto) {
    const user = await this.userRepo.save(dto);

    // Emit event instead of direct dependency
    this.eventEmitter.emit('user.created', user);

    return user;
  }
}

// order.service.ts
@Injectable()
export class OrderService {
  @OnEvent('user.created')
  handleUserCreated(user: User) {
    // Handle user creation
  }
}
```

## 9. Not Handling Promises

Always handle promise rejections.

**BAD:**

```typescript
async createUser(dto: CreateUserDto) {
  // Unhandled promise - can cause crashes
  this.emailService.sendWelcome(dto.email);

  return await this.userRepo.save(dto);
}
```

**GOOD:**

```typescript
async createUser(dto: CreateUserDto) {
  const user = await this.userRepo.save(dto);

  // Handle promise
  try {
    await this.emailService.sendWelcome(user.email);
  } catch (error) {
    this.logger.error(`Failed to send welcome email: ${error.message}`);
    // Don't fail the entire operation
  }

  return user;
}

// Or use fire-and-forget pattern
async createUser(dto: CreateUserDto) {
  const user = await this.userRepo.save(dto);

  // Queue email for background processing
  await this.emailQueue.add('welcome', { userId: user.id });

  return user;
}
```

## 10. Exposing Internal Entities

Never expose database entities directly through APIs.

**BAD:**

```typescript
@Get(':id')
async findOne(@Param('id') id: string): Promise<User> {
  // Returns entity with password, tokens, etc.
  return await this.userService.findById(id);
}
```

**GOOD:**

```typescript
@Get(':id')
async findOne(@Param('id') id: string): Promise<UserResponseDto> {
  const user = await this.userService.findById(id);
  // Transform to DTO without sensitive data
  return plainToClass(UserResponseDto, user);
}
```

## 11. Magic Numbers and Strings

Use constants or enums instead.

**BAD:**

```typescript
if (user.status === 'active') {
  // Magic string
}

if (user.age > 18) {
  // Magic number
}
```

**GOOD:**

```typescript
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

const MINIMUM_AGE = 18;

if (user.status === UserStatus.ACTIVE) {
  // Clear intent
}

if (user.age > MINIMUM_AGE) {
  // Clear intent
}
```

## 12. Synchronous Operations in Request Handlers

Never block the event loop.

**BAD:**

```typescript
@Get('export')
async exportUsers() {
  const users = await this.userRepo.find();

  // Synchronous CPU-intensive operation - BLOCKS everything!
  const csv = users.map(u => `${u.id},${u.name}`).join('\n');

  return csv;
}
```

**GOOD:**

```typescript
@Post('export')
async exportUsers() {
  // Queue the job for background processing
  const job = await this.exportQueue.add('users', {});

  return {
    jobId: job.id,
    status: 'processing',
    message: 'Export started. Check status at /export/status/' + job.id,
  };
}
```

## 13. Not Validating Environment Variables

Always validate configuration at startup.

**BAD:**

```typescript
const dbUrl = process.env.DATABASE_URL; // Might be undefined!
```

**GOOD:**

```typescript
import * as Joi from 'joi';

ConfigModule.forRoot({
  validationSchema: Joi.object({
    DATABASE_URL: Joi.string().required(),
    JWT_SECRET: Joi.string().min(32).required(),
    PORT: Joi.number().default(3000),
  }),
});
```

## 14. Overly Complex Query Builders

Keep queries readable.

**BAD:**

```typescript
const users = await this.userRepo
  .createQueryBuilder('user')
  .leftJoinAndSelect('user.profile', 'profile')
  .leftJoinAndSelect('user.orders', 'orders')
  .leftJoinAndSelect('orders.items', 'items')
  .leftJoinAndSelect('items.product', 'product')
  .where('user.isActive = :active', { active: true })
  .andWhere('profile.age > :age', { age: 18 })
  .andWhere('orders.status IN (:...statuses)', {
    statuses: ['pending', 'completed'],
  })
  .orderBy('user.createdAt', 'DESC')
  .take(10)
  .getMany();
```

**GOOD:**

```typescript
// Split into repository method
async findActiveUsersWithOrders(
  age: number,
  statuses: OrderStatus[],
  limit: number,
): Promise<User[]> {
  return this.userRepo
    .createQueryBuilder('user')
    .leftJoinAndSelect('user.profile', 'profile')
    .leftJoinAndSelect('user.orders', 'orders')
    .where('user.isActive = :active', { active: true })
    .andWhere('profile.age > :age', { age })
    .andWhere('orders.status IN (:...statuses)', { statuses })
    .orderBy('user.createdAt', 'DESC')
    .take(limit)
    .getMany();
}
```
