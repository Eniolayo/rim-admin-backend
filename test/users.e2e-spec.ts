import request from 'supertest'
import { initTestApp, closeTestApp, TestApp } from './utils/test-app'
import { loginSeedAdmin, getAuthHeaders } from './utils/auth'
import { UserStatus } from '../src/entities/user.entity'

describe('Users (e2e)', () => {
  let testApp: TestApp
  let token: string
  let createdUserId: string

  beforeAll(async () => {
    testApp = await initTestApp()
    const auth = await loginSeedAdmin(testApp.httpServer)
    token = auth.token
  }, 30000)

  afterAll(async () => {
    await closeTestApp(testApp)
  }, 30000)

  it('POST /users creates a user', async () => {
    const res = await request(testApp.httpServer)
      .post('/users')
      .set(getAuthHeaders(token))
      .send({
        phone: '+2348012345678',
        email: 'e2e.user@example.com',
        creditScore: 720,
        creditLimit: 50000,
        autoLimitEnabled: true,
      })
      .expect(201)

    expect(res.body).toHaveProperty('id')
    expect(res.body).toHaveProperty('phone', '+2348012345678')
    createdUserId = res.body.id
  })

  it('GET /users lists users with pagination', async () => {
    const res = await request(testApp.httpServer)
      .get('/users')
      .query({ page: 1, limit: 10 })
      .set(getAuthHeaders(token))
      .expect(200)

    expect(res.body).toHaveProperty('data')
    expect(res.body).toHaveProperty('total')
    expect(res.body).toHaveProperty('page', 1)
    expect(res.body).toHaveProperty('limit', 10)
  })

  it('GET /users/:id returns the created user', async () => {
    const res = await request(testApp.httpServer)
      .get(`/users/${createdUserId}`)
      .set(getAuthHeaders(token))
      .expect(200)

    expect(res.body).toHaveProperty('id', createdUserId)
    expect(res.body).toHaveProperty('email', 'e2e.user@example.com')
  })

  it('PATCH /users/:id/status updates user status', async () => {
    const res = await request(testApp.httpServer)
      .patch(`/users/${createdUserId}/status`)
      .set(getAuthHeaders(token))
      .send({ status: UserStatus.SUSPENDED })
      .expect(200)

    expect(res.body).toHaveProperty('status', UserStatus.SUSPENDED)
  })
})
