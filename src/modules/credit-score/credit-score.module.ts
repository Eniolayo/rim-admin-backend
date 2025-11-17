import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Loan } from '../../entities/loan.entity';
import { Transaction } from '../../entities/transaction.entity';
import { CreditScoreHistory } from '../../entities/credit-score-history.entity';
import { CreditScoreService } from './services/credit-score.service';
import { CreditScoreHistoryRepository } from './repositories/credit-score-history.repository';
import { CreditScoreQueueService } from './services/credit-score-queue.service';
import { CreditScoreAwardProcessor } from './processors/credit-score-award.processor';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Loan, Transaction, CreditScoreHistory]),
    SystemConfigModule,
    BullModule.registerQueue({ name: 'credit-score-award' }),
  ],
  providers: [CreditScoreService, CreditScoreHistoryRepository, CreditScoreQueueService, CreditScoreAwardProcessor],
  exports: [CreditScoreService, CreditScoreHistoryRepository, CreditScoreQueueService],
})
export class CreditScoreModule {}
