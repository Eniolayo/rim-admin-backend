# Security Best Practices

## Authentication & Authorization

### Use Guards for Route Protection

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Get('users')
  @Roles('admin', 'superadmin')
  findAllUsers() {
    // Only admins can access
  }

  @Post('settings')
  @Roles('superadmin')
  updateSettings() {
    // Only superadmins can access
  }
}
```

### JWT Authentication Guard

```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
```

### Roles Guard

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
```

## Input Validation & Sanitization

### Always Validate User Input

```typescript
import { IsString, IsEmail, MinLength, Matches } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase, and number',
  })
  password: string;
}
```

### Sanitize Inputs to Prevent Injection

```typescript
import { Transform } from 'class-transformer';
import * as sanitizeHtml from 'sanitize-html';

export class CreatePostDto {
  @Transform(({ value }) => sanitizeHtml(value))
  @IsString()
  content: string;
}
```

### Prevent SQL Injection

```typescript
// Good - Parameterized queries
const user = await this.userRepo
  .createQueryBuilder('user')
  .where('user.email = :email', { email: userEmail })
  .getOne();

// Bad - String concatenation
const user = await this.userRepo.query(
  `SELECT * FROM users WHERE email = '${userEmail}'`,
);
```

## Password Security

### Hash Passwords Properly

```typescript
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12; // Higher = more secure but slower
    return await bcrypt.hash(password, saltRounds);
  }

  async comparePasswords(plainText: string, hashed: string): Promise<boolean> {
    return await bcrypt.compare(plainText, hashed);
  }
}
```

### Never Log or Expose Passwords

```typescript
import { Exclude } from 'class-transformer';

@Entity()
export class User {
  @Column()
  email: string;

  @Column()
  @Exclude() // Never serialize password
  password: string;
}
```

## Security Headers

### Use Helmet for Security Headers

```typescript
import helmet from '@fastify/helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Apply security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        styleSrc: [`'self'`, `'unsafe-inline'`],
        imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
        scriptSrc: [`'self'`, `https: 'unsafe-inline'`],
      },
    },
  });

  await app.listen(3000);
}
```

## CORS Configuration

### Configure CORS Properly

```typescript
import { NestFactory } from '@nestjs/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(3000);
}
```

## Rate Limiting

### Implement Rate Limiting

```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // Time window (60 seconds)
        limit: 10, // Max requests per ttl
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

### Custom Rate Limiting

```typescript
@Controller('auth')
export class AuthController {
  @Post('login')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 attempts per minute
  async login(@Body() credentials: LoginDto) {
    return this.authService.login(credentials);
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 per hour
  async register(@Body() userData: CreateUserDto) {
    return this.authService.register(userData);
  }
}
```

## API Key Protection

### Implement API Key Guard

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    const validApiKey = this.configService.get('API_KEY');

    if (!apiKey || apiKey !== validApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
```

## File Upload Security

### Validate File Uploads

```typescript
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuid } from 'uuid';

@Post('upload')
@UseInterceptors(
  FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const filename = `${uuid()}-${file.originalname}`;
        cb(null, filename);
      },
    }),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max
    },
    fileFilter: (req, file, cb) => {
      // Only allow images
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
        return cb(new BadRequestException('Only image files allowed'), false);
      }
      cb(null, true);
    },
  }),
)
async uploadFile(@UploadedFile() file: Express.Multer.File) {
  return { filename: file.filename };
}
```

## Data Encryption

### Encrypt Sensitive Data

```typescript
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const password = this.configService.get('ENCRYPTION_KEY');
    this.key = scryptSync(password, 'salt', 32);
  }

  encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(encrypted: string): string {
    const [ivHex, authTagHex, encryptedText] = encrypted.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

## Session Management

### Secure Session Configuration

```typescript
import * as session from 'express-session';
import * as RedisStore from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  host: 'localhost',
  port: 6379,
});

app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true, // Prevent XSS
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      sameSite: 'strict', // CSRF protection
    },
  }),
);
```

## Security Checklist

- [ ] All routes protected with appropriate guards
- [ ] Input validation on all DTOs
- [ ] Passwords hashed with bcrypt
- [ ] JWT tokens have expiration
- [ ] Helmet configured for security headers
- [ ] CORS properly configured
- [ ] Rate limiting implemented
- [ ] File uploads validated and limited
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (input sanitization)
- [ ] CSRF protection enabled
- [ ] Sensitive data encrypted
- [ ] API keys not hardcoded
- [ ] Error messages don't leak sensitive info
- [ ] Logging doesn't include passwords/tokens
- [ ] Dependencies regularly updated
