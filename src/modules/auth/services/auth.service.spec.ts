import { Test, TestingModule } from '@nestjs/testing'
import { AuthService } from './auth.service'
import { AdminUserRepository } from '../repositories/admin-user.repository'
import { PendingLoginRepository } from '../repositories/pending-login.repository'
import { BackupCodeRepository } from '../repositories/backup-code.repository'
import { JwtService } from '@nestjs/jwt'
import jwtConfig from '../../../config/jwt.config'
import * as bcrypt from 'bcrypt'
import { authenticator } from 'otplib'

describe('AuthService', () => {
  let service: AuthService
  const adminRepo = {
    findByEmail: jest.fn(),
    save: jest.fn(),
    findById: jest.fn(),
  } as unknown as AdminUserRepository
  const pendingRepo = {
    findActiveByUserAndType: jest.fn(),
    save: jest.fn(),
    markUsed: jest.fn(),
    deleteExpiredForUser: jest.fn(),
    deleteUsedForUser: jest.fn(),
    findActiveByHash: jest.fn(),
  } as unknown as PendingLoginRepository
  const backupRepo = {
    findActiveByUser: jest.fn(),
    saveAll: jest.fn(),
    markUsed: jest.fn(),
    deleteAllForUser: jest.fn(),
  } as unknown as BackupCodeRepository
  const jwt = { signAsync: jest.fn().mockResolvedValue('jwt') } as unknown as JwtService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AdminUserRepository, useValue: adminRepo },
        { provide: PendingLoginRepository, useValue: pendingRepo },
        { provide: BackupCodeRepository, useValue: backupRepo },
        { provide: JwtService, useValue: jwt },
        { provide: jwtConfig.KEY, useValue: { secret: 's', expiresIn: '1h' } },
        AuthService,
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
    jest.clearAllMocks()
  })

  it('login returns setup-required when 2FA disabled', async () => {
    ;(adminRepo.findByEmail as any).mockResolvedValue({ id: 'u', email: 'e', username: 'n', role: 'r', status: 'active', password: await bcrypt.hash('p', 10), twoFactorEnabled: false })
    ;(adminRepo.save as any).mockResolvedValue(null)
    ;(pendingRepo.findActiveByUserAndType as any).mockResolvedValue(null)
    ;(pendingRepo.save as any).mockResolvedValue({ hash: 'sess', expiresAt: new Date() })
    const res = await service.login({ email: 'e', password: 'p' })
    expect(res.status).toBe('MFA_SETUP_REQUIRED')
    expect(res.sessionToken).toBe('sess')
  })

  it('login returns mfa-required when 2FA enabled', async () => {
    ;(adminRepo.findByEmail as any).mockResolvedValue({ id: 'u', email: 'e', username: 'n', role: 'r', status: 'active', password: await bcrypt.hash('p', 10), twoFactorEnabled: true })
    ;(adminRepo.save as any).mockResolvedValue(null)
    ;(pendingRepo.findActiveByUserAndType as any).mockResolvedValue(null)
    ;(pendingRepo.save as any).mockResolvedValue({ hash: 'th', expiresAt: new Date() })
    const res = await service.login({ email: 'e', password: 'p' })
    expect(res.status).toBe('MFA_REQUIRED')
    expect(res.temporaryHash).toBe('th')
  })

  it('start2faSetup returns otpauthUrl and backup codes', async () => {
    ;(pendingRepo.findActiveByHash as any).mockResolvedValue({ id: 's1', type: 'setup', expiresAt: new Date(Date.now() + 60000), adminUserId: 'u' })
    ;(adminRepo.findById as any).mockResolvedValue({ id: 'u', email: 'e' })
    const spyGen = jest.spyOn(authenticator, 'generateSecret').mockReturnValue('secret')
    const spyUri = jest.spyOn(authenticator, 'keyuri').mockReturnValue('otpauth://rim')
    ;(pendingRepo.save as any).mockResolvedValue({})
    ;(backupRepo.deleteAllForUser as any).mockResolvedValue({})
    ;(backupRepo.saveAll as any).mockResolvedValue([])
    const res = await service.start2faSetup('sess')
    expect(res.otpauthUrl).toContain('otpauth://')
    expect(res.backupCodes.length).toBe(10)
    spyGen.mockRestore()
    spyUri.mockRestore()
  })

  it('verify2faSetup enables 2FA and returns next-step temporary hash', async () => {
    ;(pendingRepo.findActiveByHash as any).mockResolvedValue({ id: 's1', type: 'setup', secret: 'secret', expiresAt: new Date(Date.now() + 60000), adminUserId: 'u', attempts: 0 })
    const spyCheck = jest.spyOn(authenticator, 'check').mockReturnValue(true)
    ;(adminRepo.findById as any).mockResolvedValue({ id: 'u', email: 'e', twoFactorEnabled: false })
    ;(adminRepo.save as any).mockResolvedValue({})
    ;(pendingRepo.markUsed as any).mockResolvedValue({})
    ;(pendingRepo.findActiveByUserAndType as any).mockResolvedValue(null)
    ;(pendingRepo.save as any).mockResolvedValue({ hash: 'th', expiresAt: new Date() })
    const res = await service.verify2faSetup('sess', '123456')
    expect(res.status).toBe('MFA_ENABLED')
    expect(res.temporaryHash).toBe('th')
    spyCheck.mockRestore()
  })

  it('completeMfaLogin issues JWT on valid TOTP', async () => {
    ;(pendingRepo.findActiveByHash as any).mockResolvedValue({ id: 'p1', type: 'mfa', expiresAt: new Date(Date.now() + 60000), adminUserId: 'u', attempts: 0 })
    ;(adminRepo.findById as any).mockResolvedValue({ id: 'u', email: 'e', username: 'n', role: 'r', otpSecret: 'secret', twoFactorEnabled: true })
    const spyCheck = jest.spyOn(authenticator, 'check').mockReturnValue(true)
    ;(pendingRepo.markUsed as any).mockResolvedValue({})
    const res = await service.completeMfaLogin('th', '123456')
    expect(res.token).toBe('jwt')
    spyCheck.mockRestore()
  })

  it('consumeBackupCode issues JWT on valid backup code', async () => {
    ;(pendingRepo.findActiveByHash as any).mockResolvedValue({ id: 'p1', type: 'mfa', expiresAt: new Date(Date.now() + 60000), adminUserId: 'u', attempts: 0 })
    ;(adminRepo.findById as any).mockResolvedValue({ id: 'u', email: 'e', username: 'n', role: 'r', twoFactorEnabled: true })
    const code = 'CODE123'
    const hash = await bcrypt.hash(code, 10)
    ;(backupRepo.findActiveByUser as any).mockResolvedValue([{ id: 'b1', codeHash: hash, used: false }])
    const spyCompare = jest.spyOn(bcrypt, 'compare').mockImplementation(async (plain, hashed) => plain === code)
    ;(backupRepo.markUsed as any).mockResolvedValue({})
    ;(pendingRepo.markUsed as any).mockResolvedValue({})
    const res = await service.consumeBackupCode('th', code)
    expect(res.token).toBe('jwt')
    spyCompare.mockRestore()
  })

  it('cleanupExpiredSessions calls repository cleanup methods', async () => {
    ;(pendingRepo.deleteExpiredForUser as any).mockResolvedValue({})
    ;(pendingRepo.deleteUsedForUser as any).mockResolvedValue({})
    await service.cleanupExpiredSessions('u')
    expect((pendingRepo.deleteExpiredForUser as any)).toHaveBeenCalled()
    expect((pendingRepo.deleteUsedForUser as any)).toHaveBeenCalled()
  })
})

