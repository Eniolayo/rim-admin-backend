import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Transaction, TransactionType, TransactionStatus, PaymentMethod } from '../../../entities/transaction.entity'

@Injectable()
export class TransactionRepository {
  constructor(
    @InjectRepository(Transaction)
    private readonly repository: Repository<Transaction>,
  ) {}

  async findById(id: string): Promise<Transaction | null> {
    return this.repository.findOne({ where: { id }, relations: ['user', 'reconciler'] })
  }

  async findByTransactionId(transactionId: string): Promise<Transaction | null> {
    return this.repository.findOne({ where: { transactionId }, relations: ['user', 'reconciler'] })
  }

  async findAllWithFilters(filters: {
    search?: string
    type?: TransactionType
    status?: TransactionStatus
    paymentMethod?: PaymentMethod
    network?: string
    dateFrom?: Date
    dateTo?: Date
    amountMin?: number
    amountMax?: number
  }): Promise<Transaction[]> {
    const qb = this.repository.createQueryBuilder('t')

    if (filters.type) qb.andWhere('t.type = :type', { type: filters.type })
    if (filters.status) qb.andWhere('t.status = :status', { status: filters.status })
    if (filters.paymentMethod) qb.andWhere('t.paymentMethod = :pm', { pm: filters.paymentMethod })
    if (filters.network) qb.andWhere('t.network = :network', { network: filters.network })
    if (filters.search) {
      qb.andWhere('(t.transactionId LIKE :s OR t.userPhone LIKE :s OR t.userEmail LIKE :s OR t.reference LIKE :s)', {
        s: `%${filters.search}%`,
      })
    }
    if (filters.dateFrom && filters.dateTo) {
      qb.andWhere('t.createdAt BETWEEN :from AND :to', { from: filters.dateFrom, to: filters.dateTo })
    }
    if (filters.amountMin !== undefined && filters.amountMax !== undefined) {
      qb.andWhere('t.amount BETWEEN :min AND :max', { min: filters.amountMin, max: filters.amountMax })
    }

    return qb.leftJoinAndSelect('t.user', 'user').leftJoinAndSelect('t.reconciler', 'reconciler').orderBy('t.createdAt', 'DESC').getMany()
  }

  async save(entity: Transaction): Promise<Transaction> {
    return this.repository.save(entity)
  }

  async update(id: string, patch: Partial<Omit<Transaction, 'user' | 'reconciler'>>): Promise<void> {
    const { metadata, ...rest } = patch
    if (Object.keys(rest).length) await this.repository.update(id, rest as any)
    if (metadata !== undefined) {
      await this.repository.createQueryBuilder().update(Transaction).set({ metadata: metadata as Record<string, unknown> | null } as any).where('id = :id', { id }).execute()
    }
  }

  async stats(): Promise<{
    totalTransactions: number
    totalAmount: number
    airtimeTransactions: number
    repaymentTransactions: number
    completedTransactions: number
    pendingTransactions: number
    failedTransactions: number
    todayTransactions: number
    todayAmount: number
  }> {
    const transactions = await this.repository.find()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const todayTx = transactions.filter(t => t.createdAt >= today && t.createdAt < tomorrow)
    return {
      totalTransactions: transactions.length,
      totalAmount: transactions.reduce((s, t) => s + Number(t.amount), 0),
      airtimeTransactions: transactions.filter(t => t.type === TransactionType.AIRTIME).length,
      repaymentTransactions: transactions.filter(t => t.type === TransactionType.REPAYMENT).length,
      completedTransactions: transactions.filter(t => t.status === TransactionStatus.COMPLETED).length,
      pendingTransactions: transactions.filter(t => t.status === TransactionStatus.PENDING).length,
      failedTransactions: transactions.filter(t => t.status === TransactionStatus.FAILED).length,
      todayTransactions: todayTx.length,
      todayAmount: todayTx.reduce((s, t) => s + Number(t.amount), 0),
    }
  }
}

