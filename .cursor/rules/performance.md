# Performance Guidelines

## Event Loop Protection

### Never Block the Event Loop

Node.js is single-threaded, so blocking operations halt all request processing.

**BAD - Synchronous Operations:**

```typescript
import * as fs from 'fs';

// Blocks entire application
const data = fs.readFileSync('file.txt');
const hash = crypto.createHash('sha256').update(data).digest('hex');
```

**GOOD - Asynchronous Operations:**

```typescript
import { promises as fs } from 'fs';
import { createHash } from 'crypto';

// Non-blocking
const data = await fs.readFile('file.txt');
const hash = createHash('sha256').update(data).digest('hex');
```

### Avoid CPU-Intensive Operations in Request Handlers

For CPU-heavy tasks, use:

- Background job queues (Bull/BullMQ)
- Worker threads
- Child processes

## Background Job Processing

### Use Bull/BullMQ for Background Jobs

```typescript
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class ImageService {
  constructor(
    @InjectQueue('image-processing')
    private imageQueue: Queue,
  ) {}

  async processImage(imageId: string) {
    // Add to queue, don't block request
    await this.imageQueue.add('resize', {
      imageId,
      sizes: [100, 200, 500],
    });

    return { status: 'processing' };
  }
}

// Processor
@Processor('image-processing')
export class ImageProcessor {
  @Process('resize')
  async handleResize(job: Job) {
    const { imageId, sizes } = job.data;
    // CPU-intensive work here
    await this.resizeImage(imageId, sizes);
  }
}
```

### Job Queue Best Practices

1. **Set Job Priorities**

```typescript
await queue.add('task', data, { priority: 1 }); // High priority
await queue.add('task', data, { priority: 10 }); // Low priority
```

2. **Configure Retry Logic**

```typescript
await queue.add('task', data, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
});
```

3. **Monitor Job Progress**

```typescript
@Process('heavy-task')
async handleTask(job: Job) {
  await job.progress(25);
  // ... do work
  await job.progress(50);
  // ... more work
  await job.progress(100);
}
```

## Caching Strategies

### Implement Caching for Frequently Accessed Data

```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private userRepo: Repository<User>,
  ) {}

  async getUser(id: string): Promise<User> {
    const cacheKey = `user:${id}`;

    // Try cache first
    const cached = await this.cacheManager.get<User>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const user = await this.userRepo.findOne({ where: { id } });

    // Store in cache (TTL: 1 hour)
    await this.cacheManager.set(cacheKey, user, 3600);

    return user;
  }

  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    const user = await this.userRepo.save({ id, ...data });

    // Invalidate cache
    await this.cacheManager.del(`user:${id}`);

    return user;
  }
}
```

### Cache Configuration

```typescript
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

CacheModule.register({
  store: redisStore,
  host: 'localhost',
  port: 6379,
  ttl: 600, // Default TTL: 10 minutes
  max: 100, // Maximum items in cache
});
```

### Caching Patterns

**1. Cache-Aside (Lazy Loading)**

```typescript
// Read from cache, if miss, read from DB and populate cache
```

**2. Write-Through**

```typescript
async updateUser(id: string, data: UpdateUserDto) {
  const user = await this.userRepo.save({ id, ...data });
  await this.cacheManager.set(`user:${id}`, user, 3600);
  return user;
}
```

**3. Write-Behind (Write-Back)**

```typescript
// Write to cache immediately, async write to DB
```

## Database Query Optimization

### Select Only Required Fields

```typescript
// Don't fetch unnecessary data
const users = await this.userRepo
  .createQueryBuilder('user')
  .select(['user.id', 'user.name', 'user.email'])
  .getMany();
```

### Use Connection Pooling

```typescript
TypeOrmModule.forRoot({
  type: 'postgres',
  // Connection pool settings
  extra: {
    max: 20, // Maximum pool size
    min: 5, // Minimum pool size
    idleTimeoutMillis: 30000,
  },
});
```

### Database Indexes

```typescript
@Entity()
export class User {
  // Single field index
  @Index()
  @Column()
  email: string;

  // Composite index for common queries
  @Index(['status', 'createdAt'])
  @Column()
  status: string;

  @Column()
  createdAt: Date;
}
```

## Response Optimization

### Use Compression

```typescript
import * as compression from 'compression';

app.use(compression());
```

### Pagination for Large Datasets

```typescript
@Get()
async findAll(
  @Query('page') page = 1,
  @Query('limit') limit = 10,
) {
  const [items, total] = await this.userRepo.findAndCount({
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    items,
    total,
    page,
    lastPage: Math.ceil(total / limit),
  };
}
```

### Stream Large Responses

```typescript
@Get('export')
async exportUsers(@Res() res: Response) {
  const stream = await this.userRepo
    .createQueryBuilder('user')
    .stream();

  res.setHeader('Content-Type', 'application/json');
  stream.pipe(res);
}
```

## Memory Management

### Avoid Memory Leaks

**BAD:**

```typescript
// Global array keeps growing
const cache = [];
cache.push(data); // Never cleaned up
```

**GOOD:**

```typescript
// Use proper cache with TTL and size limits
await this.cacheManager.set(key, data, ttl);
```

### Monitor Memory Usage

```typescript
import { Logger } from '@nestjs/common';

const logger = new Logger('MemoryMonitor');

setInterval(() => {
  const used = process.memoryUsage();
  logger.log({
    rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
  });
}, 60000); // Every minute
```

## Performance Monitoring

### Add Performance Logging

```typescript
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        console.log(`${request.method} ${request.url} - ${duration}ms`);
      }),
    );
  }
}
```

## Load Testing

Before deploying, test application under load:

```bash
# Using Artillery
artillery quick --count 100 --num 10 http://localhost:3000/api/users

# Using Apache Bench
ab -n 1000 -c 100 http://localhost:3000/api/users
```
