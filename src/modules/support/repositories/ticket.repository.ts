import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { SupportTicket, TicketStatus, TicketPriority, TicketCategory } from '../../../entities/support-ticket.entity'

@Injectable()
export class TicketRepository {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly repository: Repository<SupportTicket>,
  ) {}

  async findById(id: string): Promise<SupportTicket | null> {
    return this.repository.findOne({ where: { id } })
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
  }): Promise<SupportTicket[]> {
    const qb = this.repository.createQueryBuilder('t')
    if (filters.status && filters.status.length) qb.andWhere('t.status IN (:...status)', { status: filters.status })
    if (filters.priority && filters.priority.length) qb.andWhere('t.priority IN (:...priority)', { priority: filters.priority })
    if (filters.category && filters.category.length) qb.andWhere('t.category IN (:...category)', { category: filters.category })
    if (filters.assignedTo) qb.andWhere('t.assignedTo = :assignedTo', { assignedTo: filters.assignedTo })
    if (filters.department) qb.andWhere('t.department = :dept', { dept: filters.department })
    if (filters.search) {
      qb.andWhere(
        '(t.ticketNumber LIKE :s OR t.subject LIKE :s OR t.customerName LIKE :s OR t.customerEmail LIKE :s)',
        { s: `%${filters.search}%` },
      )
    }
    if (filters.dateFrom && filters.dateTo) qb.andWhere('t.createdAt BETWEEN :from AND :to', { from: filters.dateFrom, to: filters.dateTo })
    return qb.orderBy('t.updatedAt', 'DESC').getMany()
  }

  async save(entity: SupportTicket): Promise<SupportTicket> {
    return this.repository.save(entity)
  }

  async update(id: string, patch: Partial<SupportTicket>): Promise<void> {
    await this.repository.update(id, patch as any)
  }

  async bulkUpdate(ids: string[], patch: Partial<SupportTicket>): Promise<void> {
    const items = await this.repository.find({ where: { id: In(ids) } })
    const updated = items.map(i => ({ ...i, ...patch }))
    await this.repository.save(updated)
  }

  async generateTicketNumber(): Promise<string> {
    const year = new Date().getFullYear()
    const count = await this.repository.createQueryBuilder('t').where('t.ticketNumber LIKE :p', { p: `TKT-${year}-%` }).getCount()
    const seq = String(count + 1).padStart(3, '0')
    return `TKT-${year}-${seq}`
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
    return {
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
  }
}

