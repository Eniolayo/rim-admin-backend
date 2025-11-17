import { Module, forwardRef } from '@nestjs/common';
// BullMQ queue disabled - credit score updates now happen immediately
// import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Loan } from '../../entities/loan.entity';
import { Transaction } from '../../entities/transaction.entity';
import { CreditScoreHistory } from '../../entities/credit-score-history.entity';
import { CreditScoreService } from './services/credit-score.service';
import { CreditScoreHistoryRepository } from './repositories/credit-score-history.repository';
// Queue service and processor disabled - credit score updates now happen immediately
// import { CreditScoreQueueService } from './services/credit-score-queue.service';
// import { CreditScoreAwardProcessor } from './processors/credit-score-award.processor';
import { SystemConfigModule } from '../system-config/system-config.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Loan, Transaction, CreditScoreHistory]),
    SystemConfigModule,
    forwardRef(() => UsersModule),
    // BullMQ queue disabled - credit score updates now happen immediately
    // BullModule.registerQueue({ name: 'credit-score-award' }),
  ],
  providers: [
    CreditScoreService,
    CreditScoreHistoryRepository,
    // Queue service and processor disabled - credit score updates now happen immediately
    // CreditScoreQueueService,
    // CreditScoreAwardProcessor,
  ],
  exports: [CreditScoreService, CreditScoreHistoryRepository],
})
export class CreditScoreModule {}
