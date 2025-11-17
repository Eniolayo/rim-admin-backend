import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { Transaction } from '../../entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Loan, User, Transaction]),
    UsersModule,
    CreditScoreModule,
    SystemConfigModule,
  ],
  controllers: [LoansController],
  providers: [LoansService, LoanRepository, LoansCacheService, UserRepository],
  exports: [LoansService, LoanRepository],
})
export class LoansModule {}
