import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Transaction } from '../../entities/transaction.entity'
import { TransactionsController } from './controllers/transactions.controller'
import { TransactionsService } from './services/transactions.service'
import { TransactionRepository } from './repositories/transaction.repository'

@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionRepository],
  exports: [TransactionsService, TransactionRepository],
})
export class TransactionsModule {}

