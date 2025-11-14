import { Test, TestingModule } from '@nestjs/testing'
import { SupportController } from './support.controller'
import { SupportService } from '../services/support.service'

describe('SupportController', () => {
  let controller: SupportController
  let service: SupportService

  const mockService = {
    getTickets: jest.fn().mockResolvedValue([{ id: '1', ticketNumber: 'TKT-1' }]),
    createTicket: jest.fn().mockResolvedValue({ id: '1', ticketNumber: 'TKT-1' }),
    getTicketById: jest.fn().mockResolvedValue({ id: '1' }),
    updateTicket: jest.fn().mockResolvedValue({ id: '1' }),
    assignTicket: jest.fn().mockResolvedValue({ id: '1' }),
    escalateTicket: jest.fn().mockResolvedValue({ id: '1' }),
    getMessages: jest.fn().mockResolvedValue([{ id: 'm1' }]),
    sendMessage: jest.fn().mockResolvedValue({ id: 'm1' }),
    getAgents: jest.fn().mockResolvedValue([{ id: 'a1' }]),
    getDepartments: jest.fn().mockResolvedValue([{ id: 'd1' }]),
    getTicketStats: jest.fn().mockResolvedValue({ totalTickets: 1 }),
    getTicketHistory: jest.fn().mockResolvedValue([{ id: 'h1' }]),
    sendNotification: jest.fn().mockResolvedValue(true),
    bulkAssign: jest.fn().mockResolvedValue([{ id: '1' }]),
    bulkResolve: jest.fn().mockResolvedValue([{ id: '1' }]),
    bulkStatus: jest.fn().mockResolvedValue([{ id: '1' }]),
    bulkNotify: jest.fn().mockResolvedValue(true),
    bulkEscalate: jest.fn().mockResolvedValue([{ id: '1' }]),
  } as unknown as SupportService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupportController],
      providers: [{ provide: SupportService, useValue: mockService }],
    }).compile()
    controller = module.get<SupportController>(SupportController)
    service = module.get<SupportService>(SupportService)
  })

  it('should list tickets', async () => {
    const tickets = await controller.getTickets({} as any)
    expect(tickets).toHaveLength(1)
    expect(service.getTickets).toHaveBeenCalled()
  })

  it('should create ticket', async () => {
    const ticket = await controller.createTicket({} as any)
    expect(ticket.id).toBe('1')
    expect(service.createTicket).toHaveBeenCalled()
  })
})

