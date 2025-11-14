import { Injectable, NotFoundException } from '@nestjs/common'
import { TicketRepository } from '../repositories/ticket.repository'
import { MessageRepository } from '../repositories/message.repository'
import { HistoryRepository } from '../repositories/history.repository'
import { AgentRepository } from '../repositories/agent.repository'
import { DepartmentRepository } from '../repositories/department.repository'
import { CreateTicketDto, UpdateTicketDto, AssignTicketDto, EscalateTicketDto, SendMessageDto, TicketFiltersDto, BulkAssignDto, BulkResolveDto, BulkStatusDto, BulkNotifyDto, BulkEscalateDto } from '../dto/ticket.dto'
import { ChatMessage, MessageSenderType } from '../../../entities/chat-message.entity'
import { SupportTicket, TicketStatus } from '../../../entities/support-ticket.entity'
import { TicketHistory } from '../../../entities/ticket-history.entity'

@Injectable()
export class SupportService {
  constructor(
    private readonly tickets: TicketRepository,
    private readonly messages: MessageRepository,
    private readonly history: HistoryRepository,
    private readonly agents: AgentRepository,
    private readonly departments: DepartmentRepository,
  ) {}

  async getTickets(filters: TicketFiltersDto): Promise<SupportTicket[]> {
    const df = filters.dateFrom ? new Date(filters.dateFrom) : undefined
    const dt = filters.dateTo ? new Date(filters.dateTo) : undefined
    return this.tickets.findAll({
      status: filters.status,
      priority: filters.priority,
      category: filters.category,
      assignedTo: filters.assignedTo,
      department: filters.department,
      search: filters.search,
      dateFrom: df,
      dateTo: dt,
    })
  }

  async getTicketById(id: string): Promise<SupportTicket> {
    const t = await this.tickets.findById(id)
    if (!t) throw new NotFoundException('Ticket not found')
    return t
  }

  async createTicket(dto: CreateTicketDto): Promise<SupportTicket> {
    const number = await this.tickets.generateTicketNumber()
    const ticket: SupportTicket = Object.assign(new SupportTicket(), {
      ticketNumber: number,
      customerId: dto.customerId,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      customerEmail: dto.customerEmail,
      subject: dto.subject,
      description: dto.description,
      category: dto.category,
      priority: dto.priority,
      status: TicketStatus.OPEN,
      messageCount: 0,
      tags: dto.tags ?? null,
    })
    const saved = await this.tickets.save(ticket)
    await this.history.save(Object.assign(new TicketHistory(), { ticketId: saved.id, action: 'ticket_created', performedBy: dto.customerId, performedByName: dto.customerName }))
    return saved
  }

  async updateTicket(id: string, dto: UpdateTicketDto): Promise<SupportTicket> {
    const t = await this.getTicketById(id)
    const patch: Partial<SupportTicket> = { ...dto }
    if (dto.status === TicketStatus.RESOLVED && !t.resolvedAt) {
      patch.resolvedAt = new Date()
    }
    await this.tickets.update(id, patch)
    const updated = await this.getTicketById(id)
    return updated
  }

  async assignTicket(dto: AssignTicketDto): Promise<SupportTicket> {
    const t = await this.getTicketById(dto.ticketId)
    const agent = await this.agents.findById(dto.agentId)
    const patch: Partial<SupportTicket> = {
      assignedTo: dto.agentId,
      assignedToName: agent?.name ?? null,
      status: t.status === TicketStatus.OPEN ? TicketStatus.IN_PROGRESS : t.status,
    }
    await this.tickets.update(t.id, patch)
    const updated = await this.getTicketById(t.id)
    await this.history.save(Object.assign(new TicketHistory(), { ticketId: updated.id, action: 'ticket_assigned', performedBy: dto.agentId, performedByName: updated.assignedToName ?? 'Agent', details: `Assigned to ${updated.assignedToName}` }))
    return updated
  }

  async escalateTicket(dto: EscalateTicketDto): Promise<SupportTicket> {
    const t = await this.getTicketById(dto.ticketId)
    let escalatedName: string | null = null
    if (dto.agentId) {
      const a = await this.agents.findById(dto.agentId)
      escalatedName = a?.name ?? null
    }
    const patch: Partial<SupportTicket> = {
      status: TicketStatus.ESCALATED,
      escalatedTo: dto.agentId ?? null,
      escalatedToName: escalatedName,
      department: dto.department ?? t.department ?? null,
    }
    await this.tickets.update(t.id, patch)
    const updated = await this.getTicketById(t.id)
    await this.history.save(Object.assign(new TicketHistory(), { ticketId: updated.id, action: 'ticket_escalated', performedBy: updated.assignedTo ?? 'system', performedByName: updated.assignedToName ?? 'Agent', details: dto.reason }))
    return updated
  }

  async getMessages(ticketId: string) {
    return this.messages.findByTicketId(ticketId)
  }

  async sendMessage(dto: SendMessageDto): Promise<ChatMessage> {
    const t = await this.getTicketById(dto.ticketId)
    const msg = Object.assign(new ChatMessage(), {
      ticketId: dto.ticketId,
      senderId: 'current-agent',
      senderName: 'Current Agent',
      senderType: MessageSenderType.AGENT,
      message: dto.message,
      isRead: false,
    })
    const saved = await this.messages.save(msg)
    await this.tickets.update(t.id, { messageCount: t.messageCount + 1, lastMessageAt: new Date() })
    return saved
  }

  async getAgents() {
    return this.agents.findAll()
  }

  async getDepartments() {
    return this.departments.findAll()
  }

  async getTicketStats() {
    return this.tickets.stats()
  }

  async getTicketHistory(ticketId: string) {
    return this.history.findByTicketId(ticketId)
  }

  async sendNotification(ticketId: string, type: 'email' | 'sms') {
    return true
  }

  async bulkAssign(dto: BulkAssignDto) {
    const agent = await this.agents.findById(dto.agentId)
    await this.tickets.bulkUpdate(dto.ticketIds, {
      assignedTo: dto.agentId,
      assignedToName: agent?.name ?? null,
      status: TicketStatus.IN_PROGRESS,
    })
    const updated = await Promise.all(dto.ticketIds.map(id => this.getTicketById(id)))
    return updated
  }

  async bulkResolve(dto: BulkResolveDto) {
    await this.tickets.bulkUpdate(dto.ticketIds, {
      status: TicketStatus.RESOLVED,
      resolution: 'Bulk resolved.',
      resolvedAt: new Date(),
    })
    const updated = await Promise.all(dto.ticketIds.map(id => this.getTicketById(id)))
    return updated
  }

  async bulkStatus(dto: BulkStatusDto) {
    await this.tickets.bulkUpdate(dto.ticketIds, { status: dto.status })
    const updated = await Promise.all(dto.ticketIds.map(id => this.getTicketById(id)))
    return updated
  }

  async bulkNotify(dto: BulkNotifyDto) {
    return true
  }

  async bulkEscalate(dto: BulkEscalateDto) {
    let escalatedName: string | null = null
    if (dto.agentId) {
      const a = await this.agents.findById(dto.agentId)
      escalatedName = a?.name ?? null
    }
    await this.tickets.bulkUpdate(dto.ticketIds, {
      status: TicketStatus.ESCALATED,
      escalatedTo: dto.agentId ?? null,
      escalatedToName: escalatedName,
      department: dto.department ?? null,
    })
    const updated = await Promise.all(dto.ticketIds.map(id => this.getTicketById(id)))
    return updated
  }
}
