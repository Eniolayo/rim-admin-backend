# Module Organization

## Module Structure Rules

### One Module Per Domain Concept

Each module should represent a single business domain (e.g., `UsersModule`, `AuthModule`, `ProductsModule`)

### Module Size Limit

If a module has more than 5-7 providers, consider splitting it into sub-modules

### Avoid Circular Dependencies

- **NEVER** import modules that import each other
- If two modules need to communicate, create a shared module or use events
- Only use `forwardRef()` as a last resort and document why it's necessary

### Module Imports Order

```typescript
@Module({
  imports: [
    // 1. Third-party modules
    TypeOrmModule.forFeature([Entity]),
    // 2. Shared/common modules
    CommonModule,
    // 3. Domain modules (avoid circular deps)
    OtherDomainModule,
  ],
})
```

## File Organization

### Directory Structure

- Group related files by feature/domain, not by type
- Structure: `src/[domain]/[domain].controller.ts`, `[domain].service.ts`, `[domain].module.ts`
- Keep DTOs, entities, and interfaces close to where they're used

### Example Structure

```
src/
├── modules/
│   ├── users/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.module.ts
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   ├── dto/
│   │   │   ├── create-user.dto.ts
│   │   │   └── update-user.dto.ts
│   │   └── interfaces/
│   │       └── user.interface.ts
```

## Module Dependencies

### Dependency Flow

- Controllers depend on Services
- Services depend on Repositories
- Repositories depend on Entities
- Never reverse these dependencies

### Shared Modules

- Create a `CommonModule` for cross-cutting concerns
- Use `@Global()` decorator sparingly (only for truly global services like Config, Logger)
