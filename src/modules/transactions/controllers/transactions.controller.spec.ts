import { Test, TestingModule } from '@nestjs/testing'
import { TransactionsController } from './transactions.controller'
import { TransactionsService } from '../services/transactions.service'
import { TransactionStatus, TransactionType } from '../../../entities/transaction.entity'

describe('TransactionsController', () => {
  let controller: TransactionsController
  let service: TransactionsService

  const mockService = {
    findAll: jest.fn().mockResolvedValue([
      {
        id: '1',
        transactionId: 'TXN-1',
        userId: 'U1',
        userPhone: '+234...',
        userEmail: null,
        type: TransactionType.AIRTIME,
        amount: 1000,
        status: TransactionStatus.COMPLETED,
        paymentMethod: null,
        description: null,
        reference: null,
        provider: null,
        network: 'MTN',
        reconciledAt: null,
        reconciledBy: null,
        notes: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    stats: jest.fn().mockResolvedValue({
      totalTransactions: 1,
      totalAmount: 1000,
      airtimeTransactions: 1,
      repaymentTransactions: 0,
      completedTransactions: 1,
      pendingTransactions: 0,
      failedTransactions: 0,
      todayTransactions: 1,
      todayAmount: 1000,
    }),
    findOne: jest.fn().mockResolvedValue({ id: '1' }),
    reconcile: jest.fn().mockResolvedValue({ id: '1', transactionId: 'TXN-1' }),
  } as unknown as TransactionsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [{ provide: TransactionsService, useValue: mockService }],
    }).compile()
    controller = module.get<TransactionsController>(TransactionsController)
    service = module.get<TransactionsService>(TransactionsService)
  })

  it('should list transactions', async () => {
    const result = await controller.findAll({})
    expect(result).toHaveLength(1)
    expect(service.findAll).toHaveBeenCalled()
  })

  it('should return stats', async () => {
    const stats = await controller.stats()
    expect(stats.totalTransactions).toBe(1)
    expect(service.stats).toHaveBeenCalled()
  })

  it('should get one transaction', async () => {
    const tx = await controller.findOne('1')
    expect(tx).toEqual({ id: '1' })
    expect(service.findOne).toHaveBeenCalledWith('1')
  })

  it('should reconcile transaction', async () => {
    const res = await controller.reconcile({ transactionId: 'TXN-1' } as any, { id: 'admin-1' } as any)
    expect(res).toEqual({ id: '1', transactionId: 'TXN-1' })
    expect(service.reconcile).toHaveBeenCalled()
  })
})

