import { Test, TestingModule } from '@nestjs/testing'
import { UsersService } from './users.service'
import { AdminMgmtUserRepository } from '../repositories/user.repository'

describe('UsersService', () => {
  let service: UsersService
  const usersRepo = {
    findWithFilters: jest.fn(),
  } as unknown as AdminMgmtUserRepository

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AdminMgmtUserRepository, useValue: usersRepo },
        UsersService,
      ],
    }).compile()
    service = module.get(UsersService)
    jest.clearAllMocks()
  })

  it('lists users with filters', async () => {
    ;(usersRepo.findWithFilters as any).mockResolvedValue([
      { id: 'a', username: 'u', email: 'e', role: 'r', roleId: 'rid', status: 'active', lastLogin: null, twoFactorEnabled: true, createdAt: new Date(), createdBy: null },
    ])
    const res = await service.list({ role: 'rid', status: 'active', search: 'u' })
    expect(res.length).toBe(1)
    expect(res[0].username).toBe('u')
  })
})

