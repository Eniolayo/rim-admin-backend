import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ChatMessage } from '../../../entities/chat-message.entity'

@Injectable()
export class MessageRepository {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly repository: Repository<ChatMessage>,
  ) {}

  async findByTicketId(ticketId: string): Promise<ChatMessage[]> {
    return this.repository.find({ where: { ticketId }, order: { createdAt: 'ASC' } })
  }

  async save(message: ChatMessage): Promise<ChatMessage> {
    return this.repository.save(message)
  }
}

