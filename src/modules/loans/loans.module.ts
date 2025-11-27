import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoansService } from './services/loans.service';
import { LoansController } from './controllers/loans.controller';
import { LoanRepository } from './repositories/loan.repository';
import { LoansCacheService } from './services/loans-cache.service';
import { Loan } from '../../entities/loan.entity';
import { UsersModule } from '../users/users.module';
import { User } from '../../entities/user.entity';
import { UserRepository } from '../users/repositories/user.repository';
import { CreditScoreModule } from '../credit-score/credit-score.module';
import { SystemConfigModule } from '../system-config/system-config.module';
import { ApiKeyModule } from '../auth/api-key.module';
import { Transaction } from '../../entities/transaction.entity';
import { UssdLoansController } from './controllers/ussd-loans.controller';
import { UssdLoansService } from './services/ussd-loans.service';
import { UssdSessionService } from './services/ussd-session.service';
import { LoanDisburseQueueService } from './services/loan-disburse-queue.service';
import { LoanDisburseProcessor } from './processors/loan-disburse.processor';
import { RedisConfig } from '../../config/redis.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Loan, User, Transaction]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisConfig = configService.get<RedisConfig>('redis');
        if (!redisConfig) {
          throw new Error('Redis configuration is missing');
        }

        // If URL is provided, use it directly (production)
        if (redisConfig.url) {
          return {
            connection: {
              url: redisConfig.url,
            },
          };
        }

        // Otherwise, use individual config (development)
        return {
          connection: {
            host: redisConfig.host || 'localhost',
            port: redisConfig.port || 6379,
            password: redisConfig.password,
            username: redisConfig.username,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: 'loan-disbursement',
    }),
    UsersModule,
    CreditScoreModule,
    SystemConfigModule,
    ApiKeyModule,
  ],
  controllers: [LoansController, UssdLoansController],
  providers: [
    LoansService,
    LoanRepository,
    LoansCacheService,
    UserRepository,
    UssdLoansService,
    UssdSessionService,
    LoanDisburseQueueService,
    LoanDisburseProcessor,
  ],
  exports: [LoansService, LoanRepository, LoanDisburseQueueService],
})
export class LoansModule {}
