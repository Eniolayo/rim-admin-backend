import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Loan } from '../../entities/loan.entity';
import { Transaction } from '../../entities/transaction.entity';
import { CreditScoreHistory } from '../../entities/credit-score-history.entity';
import { CreditScoreService } from './services/credit-score.service';
import { CreditScoreHistoryRepository } from './repositories/credit-score-history.repository';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Loan, Transaction, CreditScoreHistory]),
    SystemConfigModule,
  ],
  providers: [CreditScoreService, CreditScoreHistoryRepository],
  exports: [CreditScoreService, CreditScoreHistoryRepository],
})
export class CreditScoreModule {}
