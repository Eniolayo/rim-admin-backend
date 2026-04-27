import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { APP_GUARD, APP_PIPE, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { LoggerModule } from './common/logger/logger.module';
import databaseConfig, { DatabaseConfig } from './config/database.config';
import jwtConfig from './config/jwt.config';
import appConfig from './config/app.config';
import redisConfig from './config/redis.config';
import throttleConfig from './config/throttle.config';
import emailConfig from './config/email.config';
import {
  AdminUser,
  AdminRole,
  AdminInvitation,
  User,
  Loan,
  PendingLogin,
  BackupCode,
  Transaction,
  SupportTicket,
  ChatMessage,
  TicketHistory,
  SupportAgent,
  Department,
  AdminActivityLog,
  SecuritySettings,
  SystemConfig,
  CreditScoreHistory,
  Notification,
  ApiKey,
} from './entities';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { AdminTwoFactorGuard } from './modules/auth/guards/admin-2fa.guard';
import { ActivityLogInterceptor } from './modules/admin/interceptors/activity-log.interceptor';
import { UsersModule } from './modules/users/users.module';
import { AdminModule } from './modules/admin/admin.module';
import { LoansModule } from './modules/loans/loans.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { SupportModule } from './modules/support/support.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { RedisModule } from './common/redis/redis.module';
import { CommonModule } from './common/common.module';
import { SystemConfigModule } from './modules/system-config/system-config.module';
import { CreditScoreModule } from './modules/credit-score/credit-score.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MnoModule } from './modules/mno/mno.module';
import { MarkdownDocsService } from './common/services/markdown-docs.service';
import { PerformanceInterceptor } from './common/interceptors/performance.interceptor';
import {
  CsdpSubscriber,
  CsdpEligibilityLog,
  CsdpEligibilityOutcome,
  CsdpLoan,
  CsdpRecovery,
  CsdpRecoveryLoanItem,
  CsdpWebhookInboundLog,
  CsdpFeatureFlag,
  CsdpIngestBatch,
  CsdpIngestRow,
  CsdpCdrRefill,
  CsdpCdrSdp,
} from './entities/csdp';
import { CsdpModule } from './modules/csdp/csdp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [
        databaseConfig,
        jwtConfig,
        appConfig,
        redisConfig,
        throttleConfig,
        emailConfig,
      ],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test', 'staging')
          .default('development'),
        PORT: Joi.number().port().default(3000),
        DB_HOST: Joi.string().when('NODE_ENV', {
          is: 'test',
          then: Joi.string().default('localhost'),
          otherwise: Joi.string().required(),
        }),
        DB_PORT: Joi.number()
          .port()
          .when('NODE_ENV', {
            is: 'test',
            then: Joi.number().port().default(5432),
            otherwise: Joi.number().port().required(),
          }),
        DB_USERNAME: Joi.string().when('NODE_ENV', {
          is: 'test',
          then: Joi.string().default('postgres'),
          otherwise: Joi.string().required(),
        }),
        DB_PASSWORD: Joi.string().when('NODE_ENV', {
          is: 'test',
          then: Joi.string().default('postgres'),
          otherwise: Joi.string().required(),
        }),
        DB_NAME: Joi.string().when('NODE_ENV', {
          is: 'test',
          then: Joi.string().default('rim_db_test'),
          otherwise: Joi.string().required(),
        }),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRATION: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_EXPIRATION: Joi.string().required(),
        // Redis: URL for production, or host/port for development
        REDIS_URL: Joi.string().uri().optional(),
        REDIS_HOST: Joi.string().when('REDIS_URL', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.string().default('localhost'),
        }),
        REDIS_PORT: Joi.number()
          .port()
          .when('REDIS_URL', {
            is: Joi.exist(),
            then: Joi.optional(),
            otherwise: Joi.number().port().default(6379),
          }),
        REDIS_PASSWORD: Joi.string().optional(),
        REDIS_USERNAME: Joi.string().optional(),
        REDIS_TTL: Joi.number().optional().default(3600),
        // Email configuration
        EMAIL_HOST: Joi.string().optional().default('smtp.zeptomail.com'),
        EMAIL_PORT: Joi.number().port().optional().default(587),
        EMAIL_USER: Joi.string().optional().default('emailapikey'),
        EMAIL_PASS: Joi.string().optional(),
        EMAIL_FROM: Joi.string().email().optional().default('noreply@rim.ng'),
        EMAIL_FROM_NAME: Joi.string().optional().default('RIM Team'),
        FRONTEND_URL: Joi.string()
          .uri()
          .optional()
          .default('http://localhost:5173'),
        // CSDP Phase 0 — all optional, fall back to default DB envs
        DATABASE_HOT_URL: Joi.string().optional(),
        DATABASE_BATCH_URL: Joi.string().optional(),
        DATABASE_DIRECT_URL: Joi.string().optional(),
        CSDP_HOT_POOL_MAX: Joi.number().integer().min(1).optional(),
        CSDP_BATCH_POOL_MAX: Joi.number().integer().min(1).optional(),
        CSDP_DB_IDLE_TIMEOUT_MS: Joi.number().integer().min(0).optional(),
        BATCH_PORT: Joi.number().port().optional().default(3001),
        // CSDP Phase 1 — Teamwee adapter config (all optional)
        TEAMWEE_BASE_URL: Joi.string().uri().optional(),
        TEAMWEE_API_KEY: Joi.string().optional(),
        TEAMWEE_TIMEOUT_MS: Joi.number().optional().default(800),
        TEAMWEE_CB_THRESHOLD: Joi.number().optional().default(5),
        TEAMWEE_CB_RESET_MS: Joi.number().optional().default(30000),
        // CSDP API-key auth (shared secret for Airtel integration)
        CSDP_API_KEY: Joi.string().optional(),
        CSDP_API_KEY_SCOPES: Joi.string().optional(),
        // CSDP Step 8 — ingest file storage
        CSDP_INGEST_STORAGE_DIR: Joi.string().optional(),
        CSDP_INGEST_TMP_DIR: Joi.string().optional(),
        CSDP_INGEST_MAX_BYTES: Joi.number().integer().min(1).optional(),
      }),
      validationOptions: {
        abortEarly: false,
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get<DatabaseConfig>('database');
        if (!dbConfig) {
          throw new Error('Database configuration is missing');
        }
        return {
          type: 'postgres',
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
          entities: [
            AdminUser,
            AdminRole,
            AdminInvitation,
            User,
            Loan,
            PendingLogin,
            BackupCode,
            Transaction,
            SupportTicket,
            ChatMessage,
            TicketHistory,
            SupportAgent,
            Department,
            AdminActivityLog,
            SecuritySettings,
            SystemConfig,
            CreditScoreHistory,
            Notification,
            ApiKey,
          ],
          synchronize: false,
          logging: configService.get('NODE_ENV') === 'development',
        };
      },
    }),
    // CSDP named connections — Phase 1 entities registered
    TypeOrmModule.forRootAsync({
      name: 'csdpHot',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const hotUrl = configService.get<string>('DATABASE_HOT_URL');
        const isLogging = configService.get<string>('NODE_ENV') === 'development';
        const poolMax = parseInt(
          configService.get<string>('CSDP_HOT_POOL_MAX') ?? '20',
          10,
        );
        const idleTimeoutMs = parseInt(
          configService.get<string>('CSDP_DB_IDLE_TIMEOUT_MS') ?? '10000',
          10,
        );
        const base = {
          type: 'postgres' as const,
          name: 'csdpHot',
          entities: [
            CsdpSubscriber,
            CsdpEligibilityLog,
            CsdpEligibilityOutcome,
            CsdpLoan,
            CsdpRecovery,
            CsdpRecoveryLoanItem,
            CsdpWebhookInboundLog,
            CsdpFeatureFlag,
            CsdpIngestBatch,
            CsdpIngestRow,
            CsdpCdrRefill,
            CsdpCdrSdp,
          ],
          synchronize: false,
          logging: isLogging,
          extra: {
            max: poolMax,
            idleTimeoutMillis: idleTimeoutMs,
            statement_cache_size: 0,
          },
        };
        if (hotUrl) {
          return { ...base, url: hotUrl };
        }
        // Fall back to default DB envs so dev works without pgbouncer
        return {
          ...base,
          host: configService.get<string>('DB_HOST') || 'localhost',
          port: parseInt(configService.get<string>('DB_PORT') ?? '5432', 10),
          username: configService.get<string>('DB_USERNAME') || 'postgres',
          password: configService.get<string>('DB_PASSWORD') || 'postgres',
          database: configService.get<string>('DB_NAME') || 'rim_db',
        };
      },
    }),
    TypeOrmModule.forRootAsync({
      name: 'csdpBatch',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const batchUrl = configService.get<string>('DATABASE_BATCH_URL');
        const isLogging = configService.get<string>('NODE_ENV') === 'development';
        const poolMax = parseInt(
          configService.get<string>('CSDP_BATCH_POOL_MAX') ?? '3',
          10,
        );
        const idleTimeoutMs = parseInt(
          configService.get<string>('CSDP_DB_IDLE_TIMEOUT_MS') ?? '10000',
          10,
        );
        const base = {
          type: 'postgres' as const,
          name: 'csdpBatch',
          entities: [
            CsdpSubscriber,
            CsdpEligibilityLog,
            CsdpEligibilityOutcome,
            CsdpLoan,
            CsdpRecovery,
            CsdpRecoveryLoanItem,
            CsdpWebhookInboundLog,
            CsdpFeatureFlag,
            CsdpIngestBatch,
            CsdpIngestRow,
            CsdpCdrRefill,
            CsdpCdrSdp,
          ],
          synchronize: false,
          logging: isLogging,
          extra: {
            max: poolMax,
            idleTimeoutMillis: idleTimeoutMs,
            statement_cache_size: 0,
          },
        };
        if (batchUrl) {
          return { ...base, url: batchUrl };
        }
        return {
          ...base,
          host: configService.get<string>('DB_HOST') || 'localhost',
          port: parseInt(configService.get<string>('DB_PORT') ?? '5432', 10),
          username: configService.get<string>('DB_USERNAME') || 'postgres',
          password: configService.get<string>('DB_PASSWORD') || 'postgres',
          database: configService.get<string>('DB_NAME') || 'rim_db',
        };
      },
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redis = configService.get('redis');
        return {
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password,
            username: redis.username,
          },
        };
      },
    }),
    PrometheusModule.register({
      path: '/metrics',
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const throttle = configService.get('throttle');
        return [
          {
            ttl: throttle.ttl,
            limit: throttle.limit,
          },
        ];
      },
    }),
    LoggerModule,
    RedisModule,
    CommonModule,
    AuthModule,
    UsersModule,
    LoansModule,
    TransactionsModule,
    SupportModule,
    AdminModule,
    DashboardModule,
    SystemConfigModule,
    CreditScoreModule,
    NotificationsModule,
    MnoModule,
    CsdpModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    MarkdownDocsService,
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: {
            enableImplicitConversion: true,
          },
        }),
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AdminTwoFactorGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLogInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
  ],
})
export class AppModule {}
