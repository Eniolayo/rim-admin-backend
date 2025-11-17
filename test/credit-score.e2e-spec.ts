import request from 'supertest'
import { initTestApp, closeTestApp } from './utils/test-app'
import { loginSeedAdmin, getAuthHeaders } from './utils/auth'
import { DataSource } from 'typeorm'
import { SystemConfig } from '../src/entities/system-config.entity'
import { Transaction, TransactionStatus, TransactionType, PaymentMethod } from '../src/entities/transaction.entity'

describe('Credit score repayment awarding (e2e)', () => {
  let testApp: Awaited<ReturnType<typeof initTestApp>>
  let dataSource: DataSource
  let token: string

  beforeAll(async () => {
    testApp = await initTestApp()
    dataSource = testApp.dataSource
    const admin = await loginSeedAdmin(testApp.httpServer)
    token = admin.token
    const repo = dataSource.getRepository(SystemConfig)
    const exists = await repo.findOne({ where: { category: 'credit_score', key: 'repayment_scoring' } })
    if (!exists) {
      const value = {
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
      }
      const cfg = repo.create({ category: 'credit_score', key: 'repayment_scoring', value })
      await repo.save(cfg)
    }
  })

  afterAll(async () => {
    await closeTestApp(testApp)
  })

  it('awards points on partial repayment reconcile', async () => {
    const createUserRes = await request(testApp.httpServer)
      .post('/users')
      .set(getAuthHeaders(token))
      .send({ phone: '08030000001', email: 'u1@example.com', status: 'active' })
      .expect(201)
    const user = createUserRes.body

    const createLoanRes = await request(testApp.httpServer)
      .post('/loans/create')
      .set(getAuthHeaders(token))
      .send({ userId: user.userId, amount: 10000, network: 'MTN' })
      .expect(201)
    const loan = createLoanRes.body

    await request(testApp.httpServer)
      .post('/loans/approve')
      .set(getAuthHeaders(token))
      .send({ loanId: loan.loanId })
      .expect(201)

    const disburseRes = await request(testApp.httpServer)
      .post(`/loans/${loan.id}/disburse`)
      .set(getAuthHeaders(token))
      .expect(201)
    const disbursedLoan = disburseRes.body

    const txRepo = dataSource.getRepository(Transaction)
    const tx = txRepo.create({
      transactionId: 'TX-TEST-001',
      userId: user.id,
      userPhone: user.phone,
      userEmail: user.email,
      type: TransactionType.REPAYMENT,
      amount: 5000,
      status: TransactionStatus.PENDING,
      paymentMethod: PaymentMethod.CASH,
      description: 'Test repayment',
      reference: 'REF-001',
      provider: 'TEST',
      network: disbursedLoan.network,
      loanId: disbursedLoan.id,
    })
    const savedTx = await txRepo.save(tx)

    await request(testApp.httpServer)
      .post('/transactions/reconcile')
      .set(getAuthHeaders(token))
      .send({ transactionId: savedTx.transactionId, status: TransactionStatus.COMPLETED, amount: 5000 })
      .expect(201)

    // Wait for BullMQ job to process (with retries)
    let history: any[] = []
    let attempts = 0
    const maxAttempts = 10
    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 500))
      const historyRes = await request(testApp.httpServer)
        .get(`/users/${user.id}/credit-score/history`)
        .set(getAuthHeaders(token))
        .expect(200)
      history = historyRes.body as any[]
      if (history.length > 0 && history[0].transactionId === savedTx.id) {
        break
      }
      attempts++
    }

    expect(history.length).toBeGreaterThan(0)
    const latest = history[0]
    expect(latest.reason === 'partial_repayment' || latest.reason === 'loan_completed').toBeTruthy()
    expect(latest.transactionId).toBe(savedTx.id)
    expect(latest.pointsAwarded).toBeGreaterThan(0)
    // Check metadata if available
    if (latest.metadata) {
      expect(latest.metadata.repaymentAmount).toBe(5000)
      expect(latest.metadata.isPartialRepayment).toBe(true)
    }
  })
})

