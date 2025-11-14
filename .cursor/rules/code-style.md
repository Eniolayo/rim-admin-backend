# Code Style & Patterns

## Service Layer Rules

### Keep Services Focused

Each service should have a single, well-defined responsibility.

**Good:**

```typescript
@Injectable()
export class UserService {
  async findById(id: string): Promise<User> {}
  async create(data: CreateUserDto): Promise<User> {}
  async update(id: string, data: UpdateUserDto): Promise<User> {}
  async delete(id: string): Promise<void> {}
}
```

**Bad:**

```typescript
@Injectable()
export class UserService {
  // Too many responsibilities
  async findById(id: string): Promise<User> {}
  async sendWelcomeEmail(user: User): Promise<void> {}
  async processPayment(userId: string): Promise<void> {}
  async generateReport(userId: string): Promise<Report> {}
}
```

### Service Size Limit

If a service grows beyond 200 lines, consider splitting it:

```typescript
// Before: UserService (300 lines)
@Injectable()
export class UserService {
  // CRUD operations
  // Email operations
  // Profile operations
  // Notification operations
}

// After: Split into focused services
@Injectable()
export class UserService {
  // Only CRUD operations
}

@Injectable()
export class UserProfileService {
  // Profile-specific operations
}

@Injectable()
export class UserNotificationService {
  // Notification operations
}
```

## Controller Rules

### Keep Controllers Thin

Controllers should only handle HTTP concerns and delegate to services.

**Good:**

```typescript
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }
}
```

**Bad:**

```typescript
@Controller('users')
export class UserController {
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    // DON'T put business logic in controllers
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = await this.userRepo.save({
      ...createUserDto,
      password: hashedPassword,
    });
    await this.emailService.sendWelcome(user.email);
    return user;
  }
}
```

### Use Proper HTTP Status Codes

```typescript
@Controller('users')
export class UserController {
  @Post()
  @HttpCode(HttpStatus.CREATED) // 201
  async create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT) // 204
  async remove(@Param('id') id: string) {
    await this.userService.remove(id);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK) // 200 (default)
  async findOne(@Param('id') id: string) {
    return this.userService.findById(id);
  }
}
```

### Document APIs with Swagger

```typescript
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UserController {
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }
}
```

## Repository Pattern

### Use Repository Pattern for Data Access

Services should not directly use TypeORM methods. Create repository classes.

```typescript
// repositories/user.repository.ts
@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({ where: { email } });
  }

  async findActive(): Promise<User[]> {
    return this.repository.find({ where: { isActive: true } });
  }

  async save(user: User): Promise<User> {
    return this.repository.save(user);
  }
}

// services/user.service.ts
@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
```

## Return Domain Objects, Not Entities

### Use DTOs for Responses

```typescript
import { Exclude } from 'class-transformer';

// Entity
@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  @Exclude() // Never expose password
  password: string;

  @Column({ nullable: true })
  @Exclude() // Never expose refresh token
  refreshToken: string;
}

// Service
@Injectable()
export class UserService {
  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    // Transform to plain object to apply @Exclude
    return classToPlain(user) as User;
  }
}

// Or use explicit Response DTO
export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  // No password or refreshToken fields
}
```

## Naming Conventions

### File Naming

- Controllers: `user.controller.ts`
- Services: `user.service.ts`
- Modules: `user.module.ts`
- DTOs: `create-user.dto.ts`, `update-user.dto.ts`
- Entities: `user.entity.ts`
- Interfaces: `user.interface.ts`
- Guards: `jwt-auth.guard.ts`
- Decorators: `current-user.decorator.ts`

### Class Naming

```typescript
// Controllers
export class UserController {}

// Services
export class UserService {}

// DTOs
export class CreateUserDto {}
export class UpdateUserDto {}

// Entities
export class User {}

// Guards
export class JwtAuthGuard {}

// Interceptors
export class TransformInterceptor {}
```

### Method Naming

```typescript
// CRUD operations
findAll()
findOne(id: string)
findById(id: string)
create(dto: CreateDto)
update(id: string, dto: UpdateDto)
remove(id: string)
delete(id: string)

// Boolean checks
isActive()
hasPermission()
canAccess()

// Queries
getActiveUsers()
findByEmail()
searchUsers()
```

## Code Organization

### Import Order

```typescript
// 1. Node modules
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// 2. Project imports - Entities
import { User } from './entities/user.entity';

// 3. Project imports - DTOs
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// 4. Project imports - Interfaces
import { IUserService } from './interfaces/user-service.interface';

@Injectable()
export class UserService implements IUserService {
  // Implementation
}
```

### Class Member Order

```typescript
@Injectable()
export class UserService {
  // 1. Properties
  private readonly logger = new Logger(UserService.name);

  // 2. Constructor
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // 3. Public methods (alphabetically)
  async create(dto: CreateUserDto): Promise<User> {}

  async findAll(): Promise<User[]> {}

  async findById(id: string): Promise<User> {}

  async update(id: string, dto: UpdateUserDto): Promise<User> {}

  // 4. Private methods (alphabetically)
  private async hashPassword(password: string): Promise<string> {}

  private async validateEmail(email: string): Promise<void> {}
}
```

## Async/Await Best Practices

### Always Use Async/Await

```typescript
// Good
async findUser(id: string): Promise<User> {
  const user = await this.userRepo.findOne({ where: { id } });
  if (!user) {
    throw new NotFoundException('User not found');
  }
  return user;
}

// Bad - Don't use .then()
findUser(id: string): Promise<User> {
  return this.userRepo
    .findOne({ where: { id } })
    .then(user => {
      if (!user) throw new NotFoundException('User not found');
      return user;
    });
}
```

### Handle Errors Properly

```typescript
async createUser(dto: CreateUserDto): Promise<User> {
  try {
    const user = this.userRepo.create(dto);
    return await this.userRepo.save(user);
  } catch (error) {
    this.logger.error(`Failed to create user: ${error.message}`);
    throw new InternalServerErrorException('Failed to create user');
  }
}
```

## TypeScript Best Practices

### Use Explicit Types

```typescript
// Good
async findById(id: string): Promise<User> {
  return await this.userRepo.findOne({ where: { id } });
}

// Bad - implicit any
async findById(id) {
  return await this.userRepo.findOne({ where: { id } });
}
```

### Avoid Type Assertions

```typescript
// Bad
const user = data as User;

// Good
if (this.isUser(data)) {
  const user: User = data;
}

// Type guard
private isUser(data: any): data is User {
  return data && typeof data.id === 'string' && typeof data.email === 'string';
}
```

### Use Enums for Constants

```typescript
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest',
}

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}
```
