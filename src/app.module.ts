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
import { SystemConfigModule } from './modules/system-config/system-config.module';
import { CreditScoreModule } from './modules/credit-score/credit-score.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MnoModule } from './modules/mno/mno.module';
import { MarkdownDocsService } from './common/services/markdown-docs.service';

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
  ],
})
export class AppModule {}
