import { Test, TestingModule } from '@nestjs/testing'
import { AdminController } from './admin.controller'
import { AuthService } from '../services/auth.service'

describe('AdminController', () => {
  let controller: AdminController
  const service = {
    completeMfaLogin: jest.fn(),
  } as unknown as AuthService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile()

    controller = module.get<AdminController>(AdminController)
    jest.clearAllMocks()
  })

  it('verify returns JWT on valid code', async () => {
    ;(service.completeMfaLogin as any).mockResolvedValue({ token: 't', expiresIn: '1h' })
    const res = await controller.verify('tmp', { code: '123456' })
    expect(res.token).toBe('t')
  })
})

