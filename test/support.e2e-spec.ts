import request from 'supertest'
import { initTestApp, closeTestApp, TestApp } from './utils/test-app'
import { loginSeedAdmin, getAuthHeaders } from './utils/auth'
import { TicketPriority, TicketStatus, TicketCategory } from '../src/entities/support-ticket.entity'

describe('Support (e2e)', () => {
  let testApp: TestApp
  let token: string
  let ticketId: string

  beforeAll(async () => {
    testApp = await initTestApp()
    const auth = await loginSeedAdmin(testApp.httpServer)
    token = auth.token
  }, 30000)

  afterAll(async () => {
    await closeTestApp(testApp)
  }, 30000)

  it('POST /support/tickets creates a ticket', async () => {
    const res = await request(testApp.httpServer)
      .post('/support/tickets')
      .set(getAuthHeaders(token))
      .send({
        customerId: '00000000-0000-0000-0000-000000000001',
        customerName: 'John Doe',
        customerPhone: '+2348012345678',
        customerEmail: 'john.doe@example.com',
        subject: 'Issue with account',
        description: 'Cannot access my dashboard',
        category: TicketCategory.GENERAL,
        priority: TicketPriority.HIGH,
        tags: ['account', 'dashboard'],
      })
      .expect(201)

    expect(res.body).toHaveProperty('id')
    expect(res.body).toHaveProperty('status', TicketStatus.OPEN)
    ticketId = res.body.id
  })

  it('GET /support/tickets lists tickets', async () => {
    const res = await request(testApp.httpServer)
      .get('/support/tickets')
      .set(getAuthHeaders(token))
      .expect(200)

    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /support/tickets/:id returns the ticket', async () => {
    const res = await request(testApp.httpServer)
      .get(`/support/tickets/${ticketId}`)
      .set(getAuthHeaders(token))
      .expect(200)

    expect(res.body).toHaveProperty('id', ticketId)
    expect(res.body).toHaveProperty('subject', 'Issue with account')
  })

  it('PATCH /support/tickets/:id updates ticket status', async () => {
    const res = await request(testApp.httpServer)
      .patch(`/support/tickets/${ticketId}`)
      .set(getAuthHeaders(token))
      .send({ status: TicketStatus.IN_PROGRESS })
      .expect(200)

    expect(res.body).toHaveProperty('status', TicketStatus.IN_PROGRESS)
  })

  it('POST /support/tickets/:id/messages sends a message', async () => {
    const res = await request(testApp.httpServer)
      .post(`/support/tickets/${ticketId}/messages`)
      .set(getAuthHeaders(token))
      .send({ message: 'We are looking into your issue.' })
      .expect(201)

    expect(res.body).toHaveProperty('ticketId', ticketId)
    expect(res.body).toHaveProperty('message')
  })
})
