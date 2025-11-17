import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Logger } from 'nestjs-pino'
import { CreditScoreService } from './credit-score.service'
import { CreditScoreHistoryRepository } from '../repositories/credit-score-history.repository'
import { SystemConfigService } from '../../system-config/services/system-config.service'
import { User } from '../../../entities/user.entity'
import { Loan } from '../../../entities/loan.entity'
import { Transaction } from '../../../entities/transaction.entity'

describe('CreditScoreService calculation', () => {
  let service: CreditScoreService
  const mockUserRepo = { findOne: jest.fn(), save: jest.fn() } as unknown as Repository<User>
  const mockLoanRepo = { findOne: jest.fn(), save: jest.fn() } as unknown as Repository<Loan>
  const mockTxRepo = { findOne: jest.fn() } as unknown as Repository<Transaction>
  const mockHistoryRepo = { create: jest.fn(), findByUserId: jest.fn(), findByLoanId: jest.fn(), findByTransactionId: jest.fn() } as unknown as CreditScoreHistoryRepository
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
      fullRepaymentBonus: 1.2,
      fullRepaymentFixedBonus: 25,
    }),
  }

  beforeEach(async () => {
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

  it('calculates points for full fast large repayment', async () => {
    const disbursedAt = new Date(Date.now() - 5 * 86400000)
    const repaidAt = new Date()
    const result = await service.calculatePointsForRepayment(10000, 10000, disbursedAt, repaidAt, true)
    expect(result.points).toBeGreaterThan(0)
    expect(result.points).toBeLessThanOrEqual(500)
    expect(result.metadata).toBeDefined()
    expect(result.metadata.amountMultiplier).toBe(1.5)
    expect(result.metadata.durationMultiplier).toBe(2.0)
  })

  it('calculates points for partial medium speed', async () => {
    const disbursedAt = new Date(Date.now() - 20 * 86400000)
    const repaidAt = new Date()
    const result = await service.calculatePointsForRepayment(5000, 10000, disbursedAt, repaidAt, false)
    expect(result.points).toBe(Math.round(50 * 1.0 * 1.0 * 0.5))
    expect(result.metadata.isPartialRepayment).toBe(true)
    expect(result.metadata.repaymentPercentage).toBe(0.5)
  })

  it('returns 0 for tiny slow partial below threshold', async () => {
    const disbursedAt = new Date(Date.now() - 45 * 86400000)
    const repaidAt = new Date()
    const result = await service.calculatePointsForRepayment(500, 10000, disbursedAt, repaidAt, false)
    expect(result.points).toBe(0)
    expect(result.metadata.reason).toBe('below_minimum_threshold')
  })

  it('uses infinity tier when amount and days exceed maxima', async () => {
    const disbursedAt = new Date(Date.now() - 1200 * 86400000)
    const repaidAt = new Date()
    const result = await service.calculatePointsForRepayment(2000000, 4000000, disbursedAt, repaidAt, false)
    expect(result.points).toBeGreaterThan(0)
    // Should use last tier multiplier (0.5 for duration, 2.0 for amount)
    expect(result.metadata.amountMultiplier).toBe(2.0)
    expect(result.metadata.durationMultiplier).toBe(0.5)
  })
})
