import { Injectable, NotFoundException } from '@nestjs/common'
import { TransactionRepository } from '../repositories/transaction.repository'
import { CreateReconciliationDto } from '../dto/reconcile.dto'
import { TransactionQueryDto } from '../dto/transaction-query.dto'
import { Transaction } from '../../../entities/transaction.entity'

@Injectable()
export class TransactionsService {
  constructor(private readonly repo: TransactionRepository) {}

  async findAll(query: TransactionQueryDto): Promise<Transaction[]> {
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined
    return this.repo.findAllWithFilters({
      search: query.search,
      type: query.type,
      status: query.status,
      paymentMethod: query.paymentMethod,
      network: query.network,
      dateFrom,
      dateTo,
      amountMin: query.amountMin,
      amountMax: query.amountMax,
    })
  }

  async findOne(id: string): Promise<Transaction> {
    const tx = await this.repo.findById(id)
    if (!tx) throw new NotFoundException('Transaction not found')
    return tx
  }

  async stats() {
    return this.repo.stats()
  }

  async reconcile(payload: CreateReconciliationDto, adminId: string): Promise<Transaction> {
    const tx = await this.repo.findByTransactionId(payload.transactionId)
    if (!tx) throw new NotFoundException('Transaction not found')
    const patch: Partial<Transaction> = {
      amount: payload.amount ?? tx.amount,
      status: payload.status ?? tx.status,
      notes: payload.notes ?? tx.notes ?? null,
      reconciledAt: new Date(),
      reconciledBy: adminId,
    }
    await this.repo.update(tx.id, patch)
    const updated = await this.repo.findById(tx.id)
    if (!updated) throw new NotFoundException('Transaction not found')
    return updated
  }
}

