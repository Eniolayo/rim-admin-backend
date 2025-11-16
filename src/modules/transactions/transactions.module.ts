import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Transaction } from '../../entities/transaction.entity'
import { TransactionsController } from './controllers/transactions.controller'
import { TransactionsService } from './services/transactions.service'
import { TransactionRepository } from './repositories/transaction.repository'
import { TransactionsCacheService } from './services/transactions-cache.service'
import { CreditScoreModule } from '../credit-score/credit-score.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    CreditScoreModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionRepository, TransactionsCacheService],
  exports: [TransactionsService, TransactionRepository],
})
export class TransactionsModule {}
