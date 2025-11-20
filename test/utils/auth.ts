import request from 'supertest'
import { authenticator } from 'otplib'

export interface AuthResult {
  token: string
  refreshToken: string
  user: { id: string; email: string; name: string; role: string }
}

export async function loginSeedAdmin(httpServer: any): Promise<AuthResult> {
  const email = 'superadmin33@test33.com'
  const password = process.env.SEED_ADMIN_PASSWORD || 'Password123!'

  const loginRes = await request(httpServer)
    .post('/auth/login')
    .send({ email, password })
    .expect(200)

  const loginBody = loginRes.body

  if (loginBody.token && loginBody.refreshToken) {
    return { token: loginBody.token, refreshToken: loginBody.refreshToken, user: loginBody.user }
  }

  if (loginBody.status === 'MFA_SETUP_REQUIRED' && loginBody.sessionToken) {
    const setupRes = await request(httpServer)
      .post('/auth/2fa/setup')
      .send({ sessionToken: loginBody.sessionToken })
      .expect(200)

    const { manualKey, backupCodes } = setupRes.body

    const verifyRes = await request(httpServer)
      .post('/auth/2fa/verify-setup')
      .send({ sessionToken: loginBody.sessionToken, code: authenticator.generate(manualKey) })
      .expect(200)

    const tokens = verifyRes.body
    return { token: tokens.token, refreshToken: tokens.refreshToken, user: loginBody.user }
  }

  if (loginBody.status === 'MFA_REQUIRED' && loginBody.temporaryHash) {
    throw new Error('Seeded admin has MFA enabled; cannot complete without backup code. Please reset or seed a fresh admin.')
  }

  throw new Error('Unexpected login flow response')
}

export function getAuthHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}
