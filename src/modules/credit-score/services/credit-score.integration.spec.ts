import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Logger } from 'nestjs-pino'
import { CreditScoreService } from './credit-score.service'
import { CreditScoreHistoryRepository } from '../repositories/credit-score-history.repository'
import { SystemConfigService } from '../../system-config/services/system-config.service'
import { User } from '../../../entities/user.entity'
import { Loan, LoanStatus } from '../../../entities/loan.entity'
import { Transaction, TransactionStatus, TransactionType } from '../../../entities/transaction.entity'

describe('CreditScoreService award integration', () => {
  let service: CreditScoreService
  const user: Partial<User> = { id: 'u1', creditScore: 0 }
  const loan: Partial<Loan> = { id: 'l1', amountDue: 10000, amountPaid: 0, status: LoanStatus.DISBURSED, createdAt: new Date(), disbursedAt: new Date(Date.now() - 20 * 86400000) }
  const tx: Partial<Transaction> = { id: 't1', userId: 'u1', amount: 5000, type: TransactionType.REPAYMENT, status: TransactionStatus.COMPLETED, updatedAt: new Date(), reconciledAt: new Date() }
  const mockUserRepo = { findOne: jest.fn().mockResolvedValue(user), save: jest.fn().mockImplementation((u) => u) } as unknown as Repository<User>
  const mockLoanRepo = { findOne: jest.fn().mockResolvedValue(loan), save: jest.fn().mockImplementation((l) => l) } as unknown as Repository<Loan>
  const mockTxRepo = { findOne: jest.fn().mockResolvedValue(tx) } as unknown as Repository<Transaction>
  const histories: any[] = []
  const mockHistoryRepo: Partial<CreditScoreHistoryRepository> = {
    create: jest.fn().mockImplementation((h) => { histories.unshift(h); return h }),
    findByUserId: jest.fn().mockResolvedValue([]),
    findByLoanId: jest.fn().mockResolvedValue([]),
    findByTransactionId: jest.fn().mockResolvedValue([]),
  }
  const mockConfigService: Partial<SystemConfigService> = {
    getValue: jest.fn().mockResolvedValue({
      basePoints: 50,
      amountMultipliers: [
        { minAmount: 0, maxAmount: 1000, multiplier: 0.5 },
        { minAmount: 1001, maxAmount: 5000, multiplier: 1.0 },
        { minAmount: 5001, maxAmount: 10000, multiplier: 1.5 },
        { minAmount: 10001, maxAmount: 999999, multiplier: 2.0 },
      ],
      durationMultipliers: [
        { minDays: 0, maxDays: 7, multiplier: 2.0 },
        { minDays: 8, maxDays: 14, multiplier: 1.5 },
        { minDays: 15, maxDays: 30, multiplier: 1.0 },
        { minDays: 31, maxDays: 60, multiplier: 0.75 },
        { minDays: 61, maxDays: 999, multiplier: 0.5 },
      ],
      maxPointsPerTransaction: 500,
      enablePartialRepayments: true,
      minPointsForPartialRepayment: 5,
    }),
  }

  beforeEach(async () => {
    histories.splice(0, histories.length)
    const module = await Test.createTestingModule({
      providers: [
        CreditScoreService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Loan), useValue: mockLoanRepo },
        { provide: getRepositoryToken(Transaction), useValue: mockTxRepo },
        { provide: CreditScoreHistoryRepository, useValue: mockHistoryRepo },
        { provide: SystemConfigService, useValue: mockConfigService },
        { provide: Logger, useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } },
      ],
    }).compile()
    service = module.get(CreditScoreService)
    jest.clearAllMocks()
  })

  it('awards partial repayment and creates history', async () => {
    const res = await service.awardPointsForRepayment('t1', 'l1')
    expect(res.pointsAwarded).toBeGreaterThan(0)
    expect(histories[0].reason).toBe('partial_repayment')
    expect(histories[0].metadata).toBeDefined()
    expect(histories[0].metadata?.isPartialRepayment).toBe(true)
  })

  it('does not double award for same transaction', async () => {
    await service.awardPointsForRepayment('t1', 'l1')
    ;(mockHistoryRepo.findByTransactionId as any) = jest.fn().mockResolvedValue([histories[0]])
    const res = await service.awardPointsForRepayment('t1', 'l1')
    expect(res.pointsAwarded).toBe(histories[0].pointsAwarded)
  })
})
