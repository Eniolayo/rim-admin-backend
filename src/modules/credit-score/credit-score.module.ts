import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Loan } from '../../entities/loan.entity';
import { Transaction } from '../../entities/transaction.entity';
import { CreditScoreHistory } from '../../entities/credit-score-history.entity';
import { CreditScoreService } from './services/credit-score.service';
import { ProfilingFeedService } from './services/profiling-feed.service';
import { CreditFeedFetcherService } from './services/credit-feed-fetcher.service';
import { CreditFeedParserService } from './services/credit-feed-parser.service';
import { CreditFeedBulkUpdateService } from './services/credit-feed-bulk-update.service';
import { CreditScoreHistoryRepository } from './repositories/credit-score-history.repository';
import { ProfilingFeedProcessor } from './processors/profiling-feed.processor';
import { SystemConfigModule } from '../system-config/system-config.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Loan, Transaction, CreditScoreHistory]),
    SystemConfigModule,
    forwardRef(() => UsersModule),
    BullModule.registerQueue({ name: 'profiling-feed' }),
  ],
  providers: [
    CreditScoreService,
    ProfilingFeedService,
    CreditFeedFetcherService,
    CreditFeedParserService,
    CreditFeedBulkUpdateService,
    CreditScoreHistoryRepository,
    ProfilingFeedProcessor,
  ],
  exports: [CreditScoreService, CreditScoreHistoryRepository],
})
export class CreditScoreModule {}
