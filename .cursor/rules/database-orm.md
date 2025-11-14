# Database & ORM Best Practices

## TypeORM Query Optimization

### Avoid N+1 Queries

**BAD:**

```typescript
const users = await this.userRepo.find();
for (const user of users) {
  user.posts = await this.postRepo.findByUserId(user.id);
}
```

**GOOD:**

```typescript
const users = await this.userRepo.find({
  relations: ['posts'],
});
```

### Use Query Builder for Complex Queries

```typescript
const users = await this.userRepo
  .createQueryBuilder('user')
  .leftJoinAndSelect('user.posts', 'post')
  .where('user.isActive = :isActive', { isActive: true })
  .andWhere('post.createdAt > :date', { date: lastWeek })
  .orderBy('user.createdAt', 'DESC')
  .take(10)
  .getMany();
```

### Pagination with Query Builder

```typescript
async findWithPagination(page: number, limit: number) {
  const [items, total] = await this.userRepo
    .createQueryBuilder('user')
    .skip((page - 1) * limit)
    .take(limit)
    .getManyAndCount();

  return {
    items,
    total,
    page,
    lastPage: Math.ceil(total / limit),
  };
}
```

## Transaction Management

### Use Transactions for Multiple Operations

```typescript
async createUserWithProfile(userData: CreateUserDto, profileData: CreateProfileDto) {
  return await this.dataSource.transaction(async (manager) => {
    const user = manager.create(User, userData);
    await manager.save(user);

    const profile = manager.create(Profile, { ...profileData, userId: user.id });
    await manager.save(profile);

    return user;
  });
}
```

### Transaction with QueryRunner (Advanced)

```typescript
const queryRunner = this.dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

try {
  const user = await queryRunner.manager.save(User, userData);
  const profile = await queryRunner.manager.save(Profile, profileData);

  await queryRunner.commitTransaction();
  return user;
} catch (error) {
  await queryRunner.rollbackTransaction();
  throw error;
} finally {
  await queryRunner.release();
}
```

## Entity Definitions

### Define Indexes on Frequently Queried Fields

```typescript
import { Entity, Column, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ unique: true })
  email: string;

  @Index()
  @Column()
  status: string;

  // Composite index
  @Index(['lastName', 'firstName'])
  @Column()
  lastName: string;

  @Column()
  firstName: string;
}
```

### Relationship Definitions

```typescript
// One-to-Many
@Entity()
export class User {
  @OneToMany(() => Post, (post) => post.user)
  posts: Post[];
}

@Entity()
export class Post {
  @ManyToOne(() => User, (user) => user.posts)
  user: User;
}

// Many-to-Many
@Entity()
export class Student {
  @ManyToMany(() => Course, (course) => course.students)
  @JoinTable()
  courses: Course[];
}

@Entity()
export class Course {
  @ManyToMany(() => Student, (student) => student.courses)
  students: Student[];
}
```

## Repository Pattern

### Custom Repository

```typescript
@Injectable()
export class UserRepository extends Repository<User> {
  constructor(private dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ where: { email } });
  }

  async findActiveUsers(): Promise<User[]> {
    return this.find({ where: { isActive: true } });
  }
}
```

## Soft Deletes

```typescript
@Entity()
export class User {
  @DeleteDateColumn()
  deletedAt?: Date;
}

// Soft delete
await userRepo.softDelete(id);

// Find including soft-deleted
await userRepo.find({ withDeleted: true });

// Restore soft-deleted
await userRepo.restore(id);
```

## Query Performance Tips

1. **Select Only Required Fields**

```typescript
const users = await this.userRepo
  .createQueryBuilder('user')
  .select(['user.id', 'user.name', 'user.email'])
  .getMany();
```

2. **Use Streaming for Large Datasets**

```typescript
const stream = await this.userRepo.createQueryBuilder('user').stream();
```

3. **Batch Operations**

```typescript
// Insert multiple
await this.userRepo.insert([user1, user2, user3]);

// Update multiple
await this.userRepo.update({ status: 'pending' }, { status: 'active' });
```

4. **Use Raw Queries for Complex Operations**

```typescript
await this.userRepo.query(
  'UPDATE users SET status = $1 WHERE created_at < $2',
  ['inactive', lastYear],
);
```
