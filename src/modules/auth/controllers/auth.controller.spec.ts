import { Test, TestingModule } from '@nestjs/testing'
import { AuthController } from './auth.controller'
import { AuthService } from '../services/auth.service'

describe('AuthController', () => {
  let controller: AuthController
  const service = {
    login: jest.fn(),
    start2faSetup: jest.fn(),
    verify2faSetup: jest.fn(),
    regenerateBackupCodes: jest.fn(),
    consumeBackupCode: jest.fn(),
  } as unknown as AuthService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile()

    controller = module.get<AuthController>(AuthController)
    jest.clearAllMocks()
  })

  it('login returns MFA_SETUP_REQUIRED when 2FA disabled', async () => {
    ;(service.login as any).mockResolvedValue({
      status: 'MFA_SETUP_REQUIRED',
      sessionToken: 'sess',
      expiresAt: new Date(),
      user: { id: 'u', email: 'e', name: 'n', role: 'r' },
    })
    const res = await controller.login({ email: 'e', password: 'p' })
    expect(res.status).toBe('MFA_SETUP_REQUIRED')
    expect(res.sessionToken).toBe('sess')
  })

  it('login returns MFA_REQUIRED when 2FA enabled', async () => {
    ;(service.login as any).mockResolvedValue({
      status: 'MFA_REQUIRED',
      temporaryHash: 'th',
      expiresAt: new Date(),
      user: { id: 'u', email: 'e', name: 'n', role: 'r' },
    })
    const res = await controller.login({ email: 'e', password: 'p' })
    expect(res.status).toBe('MFA_REQUIRED')
    expect(res.temporaryHash).toBe('th')
  })

  it('start setup returns otpauthUrl and backup codes', async () => {
    ;(service.start2faSetup as any).mockResolvedValue({
      otpauthUrl: 'otpauth://',
      backupCodes: ['a', 'b'],
    })
    const res = await controller.startSetup({ sessionToken: 'sess' })
    expect(res.otpauthUrl).toContain('otpauth://')
    expect(res.backupCodes.length).toBeGreaterThan(0)
  })

  it('verify setup returns MFA_ENABLED with temporary hash', async () => {
    ;(service.verify2faSetup as any).mockResolvedValue({
      status: 'MFA_ENABLED',
      temporaryHash: 'th',
      expiresAt: new Date(),
    })
    const res = await controller.verifySetup({ sessionToken: 'sess', code: '123456' })
    expect(res.status).toBe('MFA_ENABLED')
    expect(res.temporaryHash).toBe('th')
  })

  it('regenerate backup codes returns codes array', async () => {
    ;(service.regenerateBackupCodes as any).mockResolvedValue(['x', 'y'])
    const res = await controller.regenerateBackupCodes({ id: 'u', email: 'e', username: 'n', role: 'r' } as any)
    expect(res.codes.length).toBe(2)
  })

  it('consume backup code returns token', async () => {
    ;(service.consumeBackupCode as any).mockResolvedValue({ token: 't', expiresIn: '1h' })
    const res = await controller.consumeBackupCode({ temporaryHash: 'th', code: 'code' })
    expect(res.token).toBe('t')
  })
})

