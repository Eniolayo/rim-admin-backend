import request from 'supertest'
import { initTestApp, closeTestApp, TestApp } from './utils/test-app'
import { loginSeedAdmin, getAuthHeaders } from './utils/auth'

describe('Auth (e2e)', () => {
  let testApp: TestApp
  let token: string
  let refreshToken: string

  beforeAll(async () => {
    testApp = await initTestApp()
    const auth = await loginSeedAdmin(testApp.httpServer)
    token = auth.token
    refreshToken = auth.refreshToken
  }, 30000)

  afterAll(async () => {
    await closeTestApp(testApp)
  }, 30000)

  it('GET /auth/me returns current user', async () => {
    const res = await request(testApp.httpServer)
      .get('/auth/me')
      .set(getAuthHeaders(token))
      .expect(200)

    expect(res.body).toHaveProperty('id')
    expect(res.body).toHaveProperty('email')
    expect(res.body).toHaveProperty('name')
    expect(res.body).toHaveProperty('role')
  })

  it('POST /auth/refresh returns new tokens', async () => {
    const res = await request(testApp.httpServer)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200)

    expect(res.body).toHaveProperty('token')
    expect(res.body).toHaveProperty('refreshToken')
    expect(res.body).toHaveProperty('expiresIn')
  })

  it('GET /auth/me without auth returns 401', async () => {
    await request(testApp.httpServer).get('/auth/me').expect(401)
  })
})
