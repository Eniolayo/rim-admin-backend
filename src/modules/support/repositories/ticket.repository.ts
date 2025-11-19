import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { SupportTicket, TicketStatus, TicketPriority, TicketCategory } from '../../../entities/support-ticket.entity'

@Injectable()
export class TicketRepository {
  private readonly logger = new Logger(TicketRepository.name)

  constructor(
    @InjectRepository(SupportTicket)
    private readonly repository: Repository<SupportTicket>,
  ) {}

  async findById(id: string): Promise<SupportTicket | null> {
    this.logger.log(`Finding ticket by id ${id}`)
    const ticket = await this.repository.findOne({ where: { id } })
    if (ticket) {
      this.logger.log(`Ticket found with id ${id} and ticket number ${ticket.ticketNumber}`)
    } else {
      this.logger.log(`Ticket not found with id ${id}`)
    }
    return ticket
  }

  async findAll(filters: {
    status?: TicketStatus[]
    priority?: TicketPriority[]
    category?: TicketCategory[]
    assignedTo?: string
    department?: string
    search?: string
    dateFrom?: Date
    dateTo?: Date
    customerId?: string
    escalatedTo?: string
  }): Promise<SupportTicket[]> {
    this.logger.log(`Finding all tickets with filters: status ${filters.status}, priority ${filters.priority}, category ${filters.category}, assignedTo ${filters.assignedTo}, department ${filters.department}, search ${filters.search}, dateFrom ${filters.dateFrom}, dateTo ${filters.dateTo}, customerId ${filters.customerId}, escalatedTo ${filters.escalatedTo}`)
    const qb = this.repository.createQueryBuilder('t')
    if (filters.status && filters.status.length) qb.andWhere('t.status IN (:...status)', { status: filters.status })
    if (filters.priority && filters.priority.length) qb.andWhere('t.priority IN (:...priority)', { priority: filters.priority })
    if (filters.category && filters.category.length) qb.andWhere('t.category IN (:...category)', { category: filters.category })
    if (filters.assignedTo) qb.andWhere('t.assignedTo = :assignedTo', { assignedTo: filters.assignedTo })
    if (filters.department) qb.andWhere('t.department = :dept', { dept: filters.department })
    if (filters.customerId) qb.andWhere('t.customerId = :customerId', { customerId: filters.customerId })
    if (filters.escalatedTo) qb.andWhere('t.escalatedTo = :escalatedTo', { escalatedTo: filters.escalatedTo })
    if (filters.search) {
      qb.andWhere(
        '(t.ticketNumber LIKE :s OR t.subject LIKE :s OR t.customerName LIKE :s OR t.customerEmail LIKE :s)',
        { s: `%${filters.search}%` },
      )
    }
    if (filters.dateFrom && filters.dateTo) qb.andWhere('t.createdAt BETWEEN :from AND :to', { from: filters.dateFrom, to: filters.dateTo })
    const tickets = await qb.orderBy('t.updatedAt', 'DESC').getMany()
    this.logger.log(`Found ${tickets.length} tickets matching filters`)
    return tickets
  }

  async save(entity: SupportTicket): Promise<SupportTicket> {
    this.logger.log(`Saving ticket with ticket number ${entity.ticketNumber} and id ${entity.id} and customer id ${entity.customerId} and customer name ${entity.customerName} and customer email ${entity.customerEmail} and customer phone ${entity.customerPhone} and status ${entity.status} and priority ${entity.priority} and category ${entity.category}`)
    const saved = await this.repository.save(entity)
    this.logger.log(`Ticket saved successfully with id ${saved.id} and ticket number ${saved.ticketNumber}`)
    return saved
  }

  async update(id: string, patch: Partial<SupportTicket>): Promise<void> {
    this.logger.log(`Updating ticket with id ${id} with patch ${JSON.stringify(patch)}`)
    await this.repository.update(id, patch as any)
    this.logger.log(`Ticket updated successfully with id ${id}`)
  }

  async bulkUpdate(ids: string[], patch: Partial<SupportTicket>): Promise<void> {
    this.logger.log(`Bulk updating ${ids.length} tickets with ids ${ids.join(', ')} with patch ${JSON.stringify(patch)}`)
    const items = await this.repository.find({ where: { id: In(ids) } })
    const updated = items.map(i => ({ ...i, ...patch }))
    await this.repository.save(updated)
    this.logger.log(`Bulk update completed successfully for ${updated.length} tickets`)
  }

  async generateTicketNumber(): Promise<string> {
    const year = new Date().getFullYear()
    const count = await this.repository.createQueryBuilder('t').where('t.ticketNumber LIKE :p', { p: `TKT-${year}-%` }).getCount()
    const seq = String(count + 1).padStart(3, '0')
    const ticketNumber = `TKT-${year}-${seq}`
    this.logger.log(`Generated ticket number ${ticketNumber} for year ${year} with sequence ${seq} and count ${count}`)
    return ticketNumber
  }

  async stats(): Promise<{
    totalTickets: number
    openTickets: number
    inProgressTickets: number
    resolvedTickets: number
    escalatedTickets: number
    avgResolutionTime: number
    ticketsToday: number
    ticketsThisWeek: number
    ticketsByPriority: { urgent: number; high: number; medium: number; low: number }
    ticketsByCategory: { technical: number; billing: number; account: number; loan: number; general: number; transaction: number }
  }> {
    this.logger.log(`Calculating ticket statistics`)
    const tickets = await this.repository.find()
    const now = new Date()
    const today = new Date(now.setHours(0, 0, 0, 0))
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const resolved = tickets.filter(t => t.status === TicketStatus.RESOLVED)
    const avgResolutionTime = resolved.length
      ? resolved.reduce((sum, t) => {
          if (!t.resolvedAt) return sum
          const diff = (t.resolvedAt.getTime() - t.createdAt.getTime()) / 3600000
          return sum + diff
        }, 0) / resolved.length
      : 0
    const stats = {
      totalTickets: tickets.length,
      openTickets: tickets.filter(t => t.status === TicketStatus.OPEN).length,
      inProgressTickets: tickets.filter(t => t.status === TicketStatus.IN_PROGRESS).length,
      resolvedTickets: resolved.length,
      escalatedTickets: tickets.filter(t => t.status === TicketStatus.ESCALATED).length,
      avgResolutionTime,
      ticketsToday: tickets.filter(t => t.createdAt >= today).length,
      ticketsThisWeek: tickets.filter(t => t.createdAt >= weekAgo).length,
      ticketsByPriority: {
        urgent: tickets.filter(t => t.priority === TicketPriority.URGENT).length,
        high: tickets.filter(t => t.priority === TicketPriority.HIGH).length,
        medium: tickets.filter(t => t.priority === TicketPriority.MEDIUM).length,
        low: tickets.filter(t => t.priority === TicketPriority.LOW).length,
      },
      ticketsByCategory: {
        technical: tickets.filter(t => t.category === TicketCategory.TECHNICAL).length,
        billing: tickets.filter(t => t.category === TicketCategory.BILLING).length,
        account: tickets.filter(t => t.category === TicketCategory.ACCOUNT).length,
        loan: tickets.filter(t => t.category === TicketCategory.LOAN).length,
        general: tickets.filter(t => t.category === TicketCategory.GENERAL).length,
        transaction: tickets.filter(t => t.category === TicketCategory.TRANSACTION).length,
      },
    }
    this.logger.log(`Ticket statistics calculated: total ${stats.totalTickets}, open ${stats.openTickets}, in progress ${stats.inProgressTickets}, resolved ${stats.resolvedTickets}, escalated ${stats.escalatedTickets}, avg resolution time ${stats.avgResolutionTime} hours, today ${stats.ticketsToday}, this week ${stats.ticketsThisWeek}`)
    return stats
  }
}

