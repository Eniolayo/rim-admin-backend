# Configuration Management

## Environment Configuration

### Always Use ConfigModule

```typescript
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Make config available everywhere
      envFilePath: ['.env.local', '.env'], // Load in order
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test', 'staging')
          .default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.string().default('1h'),
      }),
      validationOptions: {
        abortEarly: false, // Show all errors
      },
    }),
  ],
})
export class AppModule {}
```

## Never Hardcode Values

**BAD:**

```typescript
const apiKey = 'abc123';
const dbHost = 'localhost';
const jwtSecret = 'my-secret';
```

**GOOD:**

```typescript
constructor(private configService: ConfigService) {}

getApiKey() {
  return this.configService.get<string>('API_KEY');
}

getDatabaseHost() {
  return this.configService.get<string>('DB_HOST');
}

getJwtSecret() {
  return this.configService.getOrThrow<string>('JWT_SECRET');
}
```

## Type-Safe Configuration

### Create Configuration Namespaces

```typescript
// config/database.config.ts
import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export default registerAs(
  'database',
  (): DatabaseConfig => ({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'myapp',
  }),
);
```

```typescript
// config/jwt.config.ts
import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  secret: string;
  expiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
}

export default registerAs(
  'jwt',
  (): JwtConfig => ({
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRATION || '1h',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
  }),
);
```

### Load Configuration Namespaces

```typescript
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [databaseConfig, jwtConfig],
    }),
  ],
})
export class AppModule {}
```

### Use Typed Configuration

```typescript
import { ConfigType } from '@nestjs/config';
import databaseConfig from './config/database.config';

@Injectable()
export class DatabaseService {
  constructor(
    @Inject(databaseConfig.KEY)
    private dbConfig: ConfigType<typeof databaseConfig>,
  ) {}

  connect() {
    const { host, port, username, password, database } = this.dbConfig;
    // TypeScript knows the types!
  }
}
```

## Environment Files

### Multiple Environment Files

```
.env.development
.env.production
.env.staging
.env.test
.env.local (git-ignored, for local overrides)
```

### Load Based on NODE_ENV

```typescript
ConfigModule.forRoot({
  envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
  isGlobal: true,
});
```

## Configuration Validation

### Validate at Startup

```typescript
import * as Joi from 'joi';

ConfigModule.forRoot({
  validationSchema: Joi.object({
    // Application
    NODE_ENV: Joi.string()
      .valid('development', 'production', 'test', 'staging')
      .required(),
    PORT: Joi.number().port().default(3000),

    // Database
    DB_HOST: Joi.string().required(),
    DB_PORT: Joi.number().port().required(),
    DB_USERNAME: Joi.string().required(),
    DB_PASSWORD: Joi.string().required(),
    DB_NAME: Joi.string().required(),

    // JWT
    JWT_SECRET: Joi.string().min(32).required(),
    JWT_EXPIRATION: Joi.string().required(),

    // Redis
    REDIS_HOST: Joi.string().required(),
    REDIS_PORT: Joi.number().port().required(),

    // AWS/Spaces
    AWS_ACCESS_KEY_ID: Joi.string().when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
    }),
    AWS_SECRET_ACCESS_KEY: Joi.string().when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
    }),
  }),
});
```

## Secret Management

### Never Commit Secrets

**Add to `.gitignore`:**

```
.env
.env.local
.env.*.local
*.pem
*.key
```

### Use Environment Variables for Secrets

```bash
# .env (example only - never commit actual values)
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT_SECRET=your-secret-key-here
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Production Secret Management

For production, use:

- AWS Secrets Manager
- HashiCorp Vault
- Kubernetes Secrets
- Docker Secrets

```typescript
// Example: AWS Secrets Manager
import { SecretsManager } from 'aws-sdk';

async function getSecret(secretName: string) {
  const client = new SecretsManager({ region: 'us-east-1' });
  const data = await client.getSecretValue({ SecretId: secretName }).promise();
  return JSON.parse(data.SecretString);
}
```

## Configuration Best Practices

### 1. Default Values

```typescript
const port = this.configService.get<number>('PORT', 3000);
const timeout = this.configService.get<number>('TIMEOUT', 5000);
```

### 2. Required Values

```typescript
// Throws error if not found
const dbUrl = this.configService.getOrThrow<string>('DATABASE_URL');
```

### 3. Type Conversion

```typescript
// String to number
const port = parseInt(process.env.PORT, 10);

// String to boolean
const isEnabled = process.env.FEATURE_ENABLED === 'true';

// String to array
const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [];
```

### 4. Feature Flags

```typescript
export default registerAs('features', () => ({
  enableCache: process.env.ENABLE_CACHE === 'true',
  enableMetrics: process.env.ENABLE_METRICS === 'true',
  maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE, 10) || 5242880, // 5MB
}));
```

## Configuration Testing

```typescript
describe('Configuration', () => {
  it('should load database config', () => {
    const config = databaseConfig();
    expect(config.host).toBeDefined();
    expect(config.port).toBeGreaterThan(0);
  });

  it('should validate required environment variables', () => {
    delete process.env.DATABASE_URL;
    expect(() => {
      ConfigModule.forRoot({ validationSchema });
    }).toThrow();
  });
});
```
