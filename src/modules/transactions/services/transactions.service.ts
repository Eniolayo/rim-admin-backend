import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { Logger } from 'nestjs-pino'
import { TransactionRepository } from '../repositories/transaction.repository'
import { CreateReconciliationDto } from '../dto/reconcile.dto'
import { TransactionQueryDto } from '../dto/transaction-query.dto'
import { Transaction, TransactionType, TransactionStatus } from '../../../entities/transaction.entity'
import { TransactionsCacheService } from './transactions-cache.service'
import { TransactionStatsDto, TransactionResponseDto } from '../dto/transaction-response.dto'
import { PaginatedResponseDto } from '../../users/dto/paginated-response.dto'
import { CreditScoreService } from '../../credit-score/services/credit-score.service'

@Injectable()
export class TransactionsService {
  constructor(
    private readonly repo: TransactionRepository,
    private readonly cacheService: TransactionsCacheService,
    private readonly creditScoreService: CreditScoreService,
    private readonly logger: Logger,
  ) {}

  async findAll(query: TransactionQueryDto): Promise<PaginatedResponseDto<TransactionResponseDto>> {
    this.logger.debug('Finding all transactions')

    try {
      // Validate query parameters
      if (query.page !== undefined && query.page < 1) {
        throw new BadRequestException('Page number must be at least 1')
      }
      if (query.limit !== undefined && (query.limit < 1 || query.limit > 100)) {
        throw new BadRequestException('Limit must be between 1 and 100')
      }

      // Try to get from cache
      try {
        const cached = await this.cacheService.getTransactionList(query)
        if (cached) {
          return cached
        }
      } catch (error) {
        // Cache error - fallback to database
        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'Cache error, falling back to database',
        )
      }

      const page = query.page ?? 1
      const limit = query.limit ?? 10
      const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined
      const dateTo = query.dateTo ? new Date(query.dateTo) : undefined

      const [transactions, total] = await this.repo.findAllWithFilters({
        search: query.search,
        type: query.type,
        status: query.status,
        paymentMethod: query.paymentMethod,
        network: query.network,
        dateFrom,
        dateTo,
        amountMin: query.amountMin,
        amountMax: query.amountMax,
        page,
        limit,
      })

      const result = {
        data: transactions.map((tx) => this.mapToResponse(tx)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }

      // Cache the result
      try {
        await this.cacheService.setTransactionList(query, result)
      } catch (error) {
        // Cache error - continue without caching
        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'Error caching transaction list',
        )
      }

      return result
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }

      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined },
        'Error finding transactions',
      )
      throw new BadRequestException('Error retrieving transactions')
    }
  }

  async findOne(id: string): Promise<Transaction> {
    try {
      // Check cache first
      const cached = await this.cacheService.getTransaction(id)
      if (cached) {
        return cached
      }
    } catch (error) {
      // Cache error - fallback to database
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Cache error, falling back to database',
      )
    }

    // Cache miss - fetch from database
    const tx = await this.repo.findById(id)
    if (!tx) throw new NotFoundException('Transaction not found')

    // Store in cache
    try {
      await this.cacheService.setTransaction(id, tx)
    } catch (error) {
      // Cache error - log but don't fail
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Error setting transaction in cache',
      )
    }

    return tx
  }

  async stats(): Promise<TransactionStatsDto> {
    try {
      // Check cache first
      const cached = await this.cacheService.getTransactionStats()
      if (cached) {
        return cached
      }
    } catch (error) {
      // Cache error - fallback to database
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Cache error, falling back to database',
      )
    }

    // Cache miss - fetch from database
    const stats = await this.repo.stats()

    // Store in cache
    try {
      await this.cacheService.setTransactionStats(stats)
    } catch (error) {
      // Cache error - log but don't fail
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Error setting transaction stats in cache',
      )
    }

    return stats
  }

  async reconcile(payload: CreateReconciliationDto, adminId: string): Promise<Transaction> {
    this.logger.log(
      {
        transactionId: payload.transactionId,
        adminId,
        status: payload.status,
        amount: payload.amount,
      },
      'Starting transaction reconciliation',
    )

    const tx = await this.repo.findByTransactionId(payload.transactionId)
    if (!tx) {
      this.logger.error(
        { transactionId: payload.transactionId },
        'Transaction not found during reconciliation',
      )
      throw new NotFoundException('Transaction not found')
    }

    this.logger.debug(
      {
        transactionId: tx.id,
        currentStatus: tx.status,
        type: tx.type,
        loanId: tx.loanId,
        amount: tx.amount,
      },
      'Retrieved transaction for reconciliation',
    )

    const newStatus = payload.status ?? tx.status
    const wasCompleted = tx.status === TransactionStatus.COMPLETED
    const isNowCompleted = newStatus === TransactionStatus.COMPLETED

    this.logger.debug(
      {
        transactionId: tx.id,
        previousStatus: tx.status,
        newStatus,
        wasCompleted,
        isNowCompleted,
        statusChanged: tx.status !== newStatus,
      },
      'Transaction status change analysis',
    )

    const patch: Partial<Transaction> = {
      amount: payload.amount ?? tx.amount,
      status: newStatus,
      notes: payload.notes ?? tx.notes ?? null,
      reconciledAt: new Date(),
      reconciledBy: adminId,
    }

    this.logger.debug(
      {
        transactionId: tx.id,
        patch: {
          amount: patch.amount,
          status: patch.status,
          hasNotes: !!patch.notes,
          reconciledAt: patch.reconciledAt,
          reconciledBy: patch.reconciledBy,
        },
      },
      'Applying transaction patch',
    )

    await this.repo.update(tx.id, patch)
    const updated = await this.repo.findById(tx.id)
    if (!updated) {
      this.logger.error(
        { transactionId: tx.id },
        'Transaction not found after update',
      )
      throw new NotFoundException('Transaction not found')
    }

    this.logger.log(
      {
        transactionId: updated.id,
        status: updated.status,
        amount: updated.amount,
        reconciledAt: updated.reconciledAt,
      },
      'Transaction reconciliation completed successfully',
    )

    // Award credit score directly if repayment transaction is being marked as completed
    if (
      updated.type === TransactionType.REPAYMENT &&
      !wasCompleted &&
      isNowCompleted &&
      updated.loanId
    ) {
      this.logger.log(
        {
          transactionId: updated.id,
          loanId: updated.loanId,
          userPhone: updated.userPhone,
          userId: updated.userId,
          repaymentAmount: updated.amount,
          type: updated.type,
          status: updated.status,
        },
        'Repayment transaction marked as completed - processing credit score award',
      )

      try {
        const creditScoreResult = await this.creditScoreService.awardPointsForRepayment(
          updated.id,
          updated.loanId,
          updated.userPhone,
        )

        this.logger.log(
          {
            transactionId: updated.id,
            loanId: updated.loanId,
            userId: updated.userId,
            pointsAwarded: creditScoreResult.pointsAwarded,
            previousScore: creditScoreResult.newScore - creditScoreResult.pointsAwarded,
            newScore: creditScoreResult.newScore,
            repaymentAmount: updated.amount,
          },
          'Credit score awarded successfully for repayment transaction',
        )

        if (creditScoreResult.pointsAwarded === 0) {
          this.logger.warn(
            {
              transactionId: updated.id,
              loanId: updated.loanId,
              reason: 'No points awarded - may be below minimum threshold or already processed',
            },
            'Credit score award resulted in zero points',
          )
        }
      } catch (error) {
        this.logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            transactionId: updated.id,
            loanId: updated.loanId,
            userId: updated.userId,
            userPhone: updated.userPhone,
            repaymentAmount: updated.amount,
          },
          'Error awarding credit score for repayment transaction',
        )
        // Don't throw - allow transaction reconciliation to complete even if credit score award fails
        // This ensures transaction status is updated even if scoring has issues
      }
    } else {
      if (updated.type !== TransactionType.REPAYMENT) {
        this.logger.debug(
          {
            transactionId: updated.id,
            type: updated.type,
          },
          'Skipping credit score award - not a repayment transaction',
        )
      } else if (wasCompleted) {
        this.logger.debug(
          {
            transactionId: updated.id,
            loanId: updated.loanId,
          },
          'Skipping credit score award - transaction was already completed',
        )
      } else if (!isNowCompleted) {
        this.logger.debug(
          {
            transactionId: updated.id,
            loanId: updated.loanId,
            newStatus,
          },
          'Skipping credit score award - transaction not marked as completed',
        )
      } else if (!updated.loanId) {
        this.logger.debug(
          {
            transactionId: updated.id,
          },
          'Skipping credit score award - no loan ID associated with transaction',
        )
      }
    }

    // Invalidate cache - transaction, list and stats changed
    try {
      this.logger.debug(
        { transactionId: tx.id },
        'Invalidating transaction-related caches',
      )

      await Promise.all([
        this.cacheService.invalidateTransaction(tx.id),
        this.cacheService.invalidateTransactionList(),
        this.cacheService.invalidateTransactionStats(),
      ])

      this.logger.debug(
        { transactionId: tx.id },
        'Successfully invalidated transaction-related caches',
      )
    } catch (error) {
      // Cache invalidation error - log but don't fail
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          transactionId: tx.id,
        },
        'Error invalidating cache after transaction reconciliation',
      )
    }

    this.logger.log(
      {
        transactionId: updated.id,
        status: updated.status,
        type: updated.type,
        loanId: updated.loanId,
      },
      'Transaction reconciliation process completed',
    )

    return updated
  }

  private mapToResponse(transaction: Transaction): TransactionResponseDto {
    return {
      id: transaction.id,
      transactionId: transaction.transactionId,
      userId: transaction.userId,
      userPhone: transaction.userPhone,
      userEmail: transaction.userEmail,
      type: transaction.type,
      amount: Number(transaction.amount),
      status: transaction.status,
      paymentMethod: transaction.paymentMethod,
      description: transaction.description,
      reference: transaction.reference,
      provider: transaction.provider,
      network: transaction.network,
      reconciledAt: transaction.reconciledAt,
      reconciledBy: transaction.reconciledBy,
      notes: transaction.notes,
      metadata: transaction.metadata,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    }
  }
}
