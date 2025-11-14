# Dependency Injection Best Practices

## Provider Scope

### Default to DEFAULT Scope

Use singleton scope unless you have a specific reason

### Use REQUEST Scope Only When Necessary

**When to use:**

- User-specific data that changes per request
- Request-scoped authentication context

**WARNING:** REQUEST scope creates new instances per request, impacting performance

### Never Use REQUEST Scope For

- Database connections
- Heavy services with initialization logic
- Services that don't need request-specific data

## Injection Patterns

### Always Use Constructor Injection

```typescript
constructor(
  private readonly userService: UserService,
  private readonly configService: ConfigService,
) {}
```

### Never Use Property Injection

Avoid `@Inject()` on class properties - use constructor injection instead

### Use Interfaces for Abstraction

```typescript
// Define interface
export interface IUserRepository {
  findById(id: string): Promise<User>;
}

// Provide with token
@Injectable()
export class UserService {
  constructor(
    @Inject('IUserRepository')
    private readonly userRepo: IUserRepository,
  ) {}
}

// Register in module
@Module({
  providers: [
    {
      provide: 'IUserRepository',
      useClass: UserRepository,
    },
  ],
})
```

## Provider Registration

### Standard Provider

```typescript
@Module({
  providers: [UserService],
})
```

### Custom Provider

```typescript
@Module({
  providers: [
    {
      provide: 'CONFIG_OPTIONS',
      useValue: { port: 3000 },
    },
  ],
})
```

### Factory Provider

```typescript
@Module({
  providers: [
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: async (configService: ConfigService) => {
        return await createConnection(configService.get('DB_URL'));
      },
      inject: [ConfigService],
    },
  ],
})
```
