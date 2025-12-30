import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MnoController } from './controllers/mno.controller';
import { MnoService } from './services/mno.service';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { User } from '../../entities/user.entity';
import { Loan } from '../../entities/loan.entity';
import { Transaction } from '../../entities/transaction.entity';
import { CreditScoreModule } from '../credit-score/credit-score.module';
import { UsersModule } from '../users/users.module';
import { LoansModule } from '../loans/loans.module';
import { ApiKeyModule } from '../auth/api-key.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Loan, Transaction]),
    CreditScoreModule,
    UsersModule,
    LoansModule,
    ApiKeyModule,
  ],
  controllers: [MnoController],
  providers: [
    MnoService,
    makeCounterProvider({
      name: 'mno_api_calls_total',
      help: 'Total number of MNO API calls',
      labelNames: ['method'],
    }),
  ],
  exports: [MnoService],
})
export class MnoModule {}
