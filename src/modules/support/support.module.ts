import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SupportTicket } from '../../entities/support-ticket.entity'
import { ChatMessage } from '../../entities/chat-message.entity'
import { TicketHistory } from '../../entities/ticket-history.entity'
import { SupportAgent } from '../../entities/support-agent.entity'
import { Department } from '../../entities/department.entity'
import { SupportController } from './controllers/support.controller'
import { SupportService } from './services/support.service'
import { TicketRepository } from './repositories/ticket.repository'
import { MessageRepository } from './repositories/message.repository'
import { HistoryRepository } from './repositories/history.repository'
import { AgentRepository } from './repositories/agent.repository'
import { DepartmentRepository } from './repositories/department.repository'

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportTicket, ChatMessage, TicketHistory, SupportAgent, Department]),
  ],
  controllers: [SupportController],
  providers: [SupportService, TicketRepository, MessageRepository, HistoryRepository, AgentRepository, DepartmentRepository],
  exports: [SupportService],
})
export class SupportModule {}

