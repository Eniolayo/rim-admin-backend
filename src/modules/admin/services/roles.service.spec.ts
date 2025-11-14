import { Test, TestingModule } from '@nestjs/testing'
import { RolesService } from './roles.service'
import { AdminRoleRepository } from '../repositories/role.repository'
import { AdminMgmtUserRepository } from '../repositories/user.repository'

describe('RolesService', () => {
  let service: RolesService
  const rolesRepo = {
    findAll: jest.fn(),
    findById: jest.fn(),
    isNameTaken: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as AdminRoleRepository
  const usersRepo = {
    countByRole: jest.fn(),
  } as unknown as AdminMgmtUserRepository

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AdminRoleRepository, useValue: rolesRepo },
        { provide: AdminMgmtUserRepository, useValue: usersRepo },
        RolesService,
      ],
    }).compile()
    service = module.get(RolesService)
    jest.clearAllMocks()
  })

  it('creates role when name is unique', async () => {
    ;(rolesRepo.isNameTaken as any).mockResolvedValue(false)
    ;(rolesRepo.save as any).mockResolvedValue({ id: 'r1', name: 'Role', description: 'd', permissions: [], userCount: 0, createdAt: new Date(), updatedAt: new Date() })
    const res = await service.create({ name: 'Role', description: 'd', permissions: [] })
    expect(res.name).toBe('Role')
  })

  it('updates role and recalculates userCount', async () => {
    const role = { id: 'r1', name: 'Role', description: 'd', permissions: [], userCount: 0, createdAt: new Date(), updatedAt: new Date() }
    ;(rolesRepo.findById as any).mockResolvedValue(role)
    ;(rolesRepo.isNameTaken as any).mockResolvedValue(false)
    ;(rolesRepo.update as any).mockResolvedValue(null)
    ;(rolesRepo.findById as any).mockResolvedValue(role)
    ;(usersRepo.countByRole as any).mockResolvedValue(3)
    ;(rolesRepo.save as any).mockResolvedValue({ ...role, userCount: 3 })
    const res = await service.update('r1', { description: 'x' })
    expect(res.userCount).toBe(3)
  })
})

