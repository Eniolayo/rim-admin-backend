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
    return this.repository.save(entry)
  }
}

