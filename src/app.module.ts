import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { LoggerModule } from './common/logger/logger.module';
import databaseConfig, { DatabaseConfig } from './config/database.config';
import jwtConfig from './config/jwt.config';
import appConfig from './config/app.config';
import {
  AdminUser,
  AdminRole,
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
} from './entities';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { AdminTwoFactorGuard } from './modules/auth/guards/admin-2fa.guard';
import { UsersModule } from './modules/users/users.module';
import { AdminModule } from './modules/admin/admin.module';
import { LoansModule } from './modules/loans/loans.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { SupportModule } from './modules/support/support.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [databaseConfig, jwtConfig, appConfig],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test', 'staging')
          .default('development'),
        PORT: Joi.number().port().default(3000),
        // Make DB variables optional if DATABASE_URL is provided
        DATABASE_URL: Joi.string().optional(),
        DB_HOST: Joi.string().when('DATABASE_URL', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required(),
        }),
        DB_PORT: Joi.number().port().when('DATABASE_URL', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required(),
        }),
        DB_USERNAME: Joi.string().when('DATABASE_URL', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required(),
        }),
        DB_PASSWORD: Joi.string().when('DATABASE_URL', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required(),
        }),
        DB_NAME: Joi.string().when('DATABASE_URL', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required(),
        }),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRATION: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_EXPIRATION: Joi.string().required(),
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
          ],
          synchronize: false,
          logging: configService.get('NODE_ENV') === 'development',
        };
      },
    }),
    LoggerModule,
    AuthModule,
    UsersModule,
    LoansModule,
    TransactionsModule,
    SupportModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
  ],
})
export class AppModule {}
