import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Transaction } from '../../entities/transaction.entity'
import { TransactionsController } from './controllers/transactions.controller'
import { TransactionsService } from './services/transactions.service'
import { TransactionRepository } from './repositories/transaction.repository'
import { TransactionsCacheService } from './services/transactions-cache.service'

@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionRepository, TransactionsCacheService],
  exports: [TransactionsService, TransactionRepository],
})
export class TransactionsModule {}

