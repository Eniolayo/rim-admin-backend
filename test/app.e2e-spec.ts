import request from 'supertest'
import { initTestApp, closeTestApp, TestApp } from './utils/test-app'

describe('AppController (e2e)', () => {
  let testApp: TestApp

  beforeAll(async () => {
    testApp = await initTestApp()
  }, 30000)

  afterAll(async () => {
    await closeTestApp(testApp)
  }, 30000)

  it('/ (GET)', async () => {
    await request(testApp.httpServer).get('/').expect(200)
  })
})
