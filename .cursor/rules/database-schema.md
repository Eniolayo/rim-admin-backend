# Database Schema Compliance

## CRITICAL: Schema Documentation is Source of Truth

The database schema defined in `RIM_schema.md` is the **single source of truth** for all entity relationships, fields, and constraints.

## Before Any Database Work

### Read Schema Documentation First

Before creating or modifying any entity, module, or database-related code:

1. **ALWAYS** read the relevant sections from `RIM_schema.md`
2. Verify entity names, field types, relationships, and constraints
3. Check for related entities that may be affected
4. Review the "Relationships Summary" section
5. Check "Key Business Rules" for business logic constraints

### Pre-Implementation Checklist

- [ ] Read relevant schema sections from `RIM_schema.md`
- [ ] Verify relationships and constraints
- [ ] Check for cascading effects on related entities
- [ ] Ensure TypeORM entities match schema definitions exactly
- [ ] Validate field names, types, and nullable constraints
- [ ] Confirm enum values match documentation

## Relationship Compliance

### Foreign Keys Must Match Exactly

- All foreign keys must match exactly as defined in the schema
- Follow the exact relationship types (1:1, 1:_, _:\*)
- Respect nullable/non-nullable constraints
- Use the correct field names as documented

### Example Verification

**Schema Says:**

```
USERS (1) ──< (1) BUSINESSES
- businesses.owner_user_id -> users.user_id
```

**TypeORM Entity Must Be:**

```typescript
@Entity('BUSINESSES')
export class Business {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'owner_user_id' })
  owner: User;
}
```

## Entity Naming Convention

### Use Exact Names from Schema

**Good:**

- Entity name: `BUSINESSES` (as defined in schema)
- Table name: `@Entity('BUSINESSES')`
- Field name: `owner_user_id` (exact match)

**Bad:**

- Entity name: `BusinessProfile` (not in schema)
- Table name: `@Entity('business_profiles')`
- Field name: `ownerId` (doesn't match schema)

### Field Types Must Match

```typescript
// Schema defines: business_name VARCHAR(255) NOT NULL
@Column({ type: 'varchar', length: 255, nullable: false })
businessName: string; // Correct

// Schema defines: registration_date DATE
@Column({ type: 'date', nullable: true })
registrationDate: Date; // Correct

// Schema defines: is_verified BOOLEAN DEFAULT FALSE
@Column({ type: 'boolean', default: false })
isVerified: boolean; // Correct
```

## Enum Values

### Use Exact Enum Values from Schema

**Schema Defines:**

```
business_type: ENUM('retail', 'wholesale', 'service')
```

**TypeORM Must Use:**

```typescript
export enum BusinessType {
  RETAIL = 'retail',
  WHOLESALE = 'wholesale',
  SERVICE = 'service',
}

@Column({
  type: 'enum',
  enum: BusinessType,
})
businessType: BusinessType;
```

## Migration Guidelines

### NEVER Write Migrations Manually

1. **Always Use TypeORM to Generate Migrations**
   - Manual migrations are error-prone
   - Can lead to schema inconsistencies
   - TypeORM automatically generates correct migrations

2. **Always Use Docker to Generate Migrations**

```bash
# Generate migration based on entity changes
docker-compose exec app npm run migration:generate -- src/database/migrations/MigrationName

# Run pending migrations
docker-compose exec app npm run migration:run

# Revert last migration
docker-compose exec app npm run migration:revert
```

3. **Migration Workflow**
   - Step 1: Update entity files to match schema documentation
   - Step 2: Run TypeORM generate command
   - Step 3: Review generated migration file
   - Step 4: Verify migration matches schema intent
   - Step 5: Run migration to apply changes

4. **Review Generated Migrations**
   - Always review before running
   - Check for data loss operations (DROP COLUMN, DROP TABLE)
   - Ensure foreign key constraints are correct
   - Verify indexes are created as expected
   - Confirm default values and NOT NULL constraints

## Relationship Patterns

### One-to-Many

```typescript
// Parent
@Entity('USERS')
export class User {
  @OneToMany(() => Business, (business) => business.owner)
  businesses: Business[];
}

// Child
@Entity('BUSINESSES')
export class Business {
  @ManyToOne(() => User, (user) => user.businesses)
  @JoinColumn({ name: 'owner_user_id' })
  owner: User;
}
```

### Many-to-Many

```typescript
@Entity('PRODUCTS')
export class Product {
  @ManyToMany(() => Category)
  @JoinTable({
    name: 'PRODUCT_CATEGORIES',
    joinColumn: { name: 'product_id' },
    inverseJoinColumn: { name: 'category_id' },
  })
  categories: Category[];
}
```

### One-to-One

```typescript
@Entity('USERS')
export class User {
  @OneToOne(() => Wallet)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;
}
```

## Never Assume

If unclear about any relationship or field:

1. Read the schema documentation first
2. Check the entity definition in schema
3. Review related entities
4. Verify cascading rules
5. Confirm nullable constraints

## Schema Validation

Before committing entity changes:

- [ ] Entity name matches schema exactly
- [ ] All fields have correct types
- [ ] Nullable constraints match documentation
- [ ] Foreign keys point to correct tables
- [ ] Enum values match schema definitions
- [ ] Indexes are defined on queried fields
- [ ] Default values match schema
- [ ] Relationship types (1:1, 1:_, _:\*) are correct
