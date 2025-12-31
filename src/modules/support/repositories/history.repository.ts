import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { TicketHistory } from '../../../entities/ticket-history.entity'

@Injectable()
export class HistoryRepository {
  constructor(
    @InjectRepository(TicketHistory)
    private readonly repository: Repository<TicketHistory>,
  ) {}

  async findByTicketId(ticketId: string): Promise<TicketHistory[]> {
    return this.repository.find({ where: { ticketId }, order: { timestamp: 'DESC' } })
  }

  async save(entry: TicketHistory): Promise<TicketHistory> {
    // Only allow saving new entries (without id) or entries that don't exist yet
    // This prevents accidental updates to existing history records
    if (entry.id) {
      const existing = await this.repository.findOne({ where: { id: entry.id } })
      if (existing) {
        throw new Error(
          'Updates to ticket history are not allowed for audit integrity. History records are append-only.',
        )
      }
    }
    // Save new entry (TypeORM will generate id if not present)
    return this.repository.save(entry)
  }

  // Protection methods to prevent modifications for audit integrity
  async update(id: string, data: Partial<TicketHistory>): Promise<never> {
    throw new Error(
      'Updates to ticket history are not allowed for audit integrity. History records are append-only.',
    )
  }

  async delete(id: string): Promise<never> {
    throw new Error(
      'Deletes of ticket history are not allowed for audit integrity. History records are append-only.',
    )
  }

  async remove(entity: TicketHistory): Promise<never> {
    throw new Error(
      'Removal of ticket history is not allowed for audit integrity. History records are append-only.',
    )
  }

  async softDelete(id: string): Promise<never> {
    throw new Error(
      'Soft deletes of ticket history are not allowed for audit integrity. History records are append-only.',
    )
  }
}

