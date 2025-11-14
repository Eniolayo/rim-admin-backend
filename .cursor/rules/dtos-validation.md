# DTOs and Validation

## DTO Rules

### Always Create DTOs for Input

- Every POST, PUT, PATCH endpoint must have a DTO
- Use `class-validator` decorators for validation
- DTOs provide type safety and automatic validation

### Example DTO

```typescript
import {
  IsString,
  IsEmail,
  MinLength,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsEnum(['admin', 'user', 'guest'])
  role: string;
}
```

## ValidationPipe Configuration

### Global Setup

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // Strip properties not in DTO
    forbidNonWhitelisted: true, // Throw error if extra properties
    transform: true, // Auto-transform payloads to DTO instances
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

## DTO Best Practices

### Create Separate DTOs

Don't reuse DTOs between create/update operations

**Good:**

- `CreateUserDto`
- `UpdateUserDto`
- `UserResponseDto`

**Bad:**

- Using the same DTO for create and update
- Exposing internal entities directly

### Use PartialType for Updates

```typescript
import { PartialType } from '@nestjs/mapped-types';

export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

### Response DTOs

Use `class-transformer` to control what data is exposed:

```typescript
import { Exclude, Expose } from 'class-transformer';

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  email: string;

  @Exclude()
  password: string; // Never expose password

  @Exclude()
  refreshToken: string; // Never expose tokens
}
```

## Common Validation Decorators

### String Validation

- `@IsString()` - Must be a string
- `@MinLength(n)` - Minimum length
- `@MaxLength(n)` - Maximum length
- `@IsEmail()` - Valid email format
- `@IsUrl()` - Valid URL format
- `@Matches(regex)` - Match pattern

### Number Validation

- `@IsNumber()` - Must be a number
- `@IsInt()` - Must be an integer
- `@Min(n)` - Minimum value
- `@Max(n)` - Maximum value
- `@IsPositive()` - Must be positive

### Other Validation

- `@IsBoolean()` - Must be boolean
- `@IsDate()` - Must be a date
- `@IsEnum(enum)` - Must be enum value
- `@IsArray()` - Must be an array
- `@IsOptional()` - Field is optional
- `@ValidateNested()` - Validate nested objects

## Validation Groups

```typescript
export class UpdateUserDto {
  @IsOptional({ groups: ['update'] })
  @IsString({ always: true })
  name?: string;
}

// In controller
@Body(new ValidationPipe({ groups: ['update'] }))
```
