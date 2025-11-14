import { Test, TestingModule } from '@nestjs/testing'
import { SettingsService } from './settings.service'
import { SecuritySettingsRepository } from '../repositories/settings.repository'

describe('SettingsService', () => {
  let service: SettingsService
  const repo = {
    getSingleton: jest.fn(),
    update: jest.fn(),
  } as unknown as SecuritySettingsRepository

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: SecuritySettingsRepository, useValue: repo },
        SettingsService,
      ],
    }).compile()
    service = module.get(SettingsService)
    jest.clearAllMocks()
  })

  it('getTwoFactor returns settings', async () => {
    ;(repo.getSingleton as any).mockResolvedValue({ enabled: true, requiredForAdmins: false, method: 'sms' })
    const res = await service.getTwoFactor()
    expect(res.enabled).toBe(true)
  })

  it('updateTwoFactor updates and returns settings', async () => {
    ;(repo.update as any).mockResolvedValue({ enabled: false, requiredForAdmins: true, method: 'app' })
    const res = await service.updateTwoFactor({ enabled: false, requiredForAdmins: true, method: 'app' } as any, { id: 'admin' } as any)
    expect(res.requiredForAdmins).toBe(true)
  })
})

