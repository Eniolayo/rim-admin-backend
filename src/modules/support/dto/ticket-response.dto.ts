import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { TicketStatus, TicketPriority, TicketCategory } from '../../../entities/support-ticket.entity'
import { MessageSenderType } from '../../../entities/chat-message.entity'

export class TicketResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  ticketNumber: string

  @ApiProperty()
  customerId: string

  @ApiProperty()
  customerName: string

  @ApiProperty()
  customerPhone: string

  @ApiProperty()
  customerEmail: string

  @ApiProperty()
  subject: string

  @ApiProperty()
  description: string

  @ApiProperty({ enum: TicketCategory })
  category: TicketCategory

  @ApiProperty({ enum: TicketPriority })
  priority: TicketPriority

  @ApiProperty({ enum: TicketStatus })
  status: TicketStatus

  @ApiPropertyOptional()
  assignedTo: string | null

  @ApiPropertyOptional()
  assignedToName: string | null

  @ApiPropertyOptional()
  department: string | null

  @ApiPropertyOptional()
  escalatedTo: string | null

  @ApiPropertyOptional()
  escalatedToName: string | null

  @ApiPropertyOptional()
  resolution: string | null

  @ApiPropertyOptional()
  resolvedAt: Date | null

  @ApiPropertyOptional()
  resolvedBy: string | null

  @ApiPropertyOptional()
  lastMessageAt: Date | null

  @ApiProperty()
  messageCount: number

  @ApiPropertyOptional({ type: [String] })
  tags: string[] | null

  @ApiProperty()
  createdAt: Date

  @ApiProperty()
  updatedAt: Date
}

export class ChatMessageDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  ticketId: string

  @ApiProperty()
  senderId: string

  @ApiProperty()
  senderName: string

  @ApiProperty({ enum: MessageSenderType })
  senderType: MessageSenderType

  @ApiProperty()
  message: string

  @ApiPropertyOptional({ type: 'object' })
  attachments: Array<{ id: string; name: string; url: string; size: number; type: string }> | null

  @ApiProperty()
  isRead: boolean

  @ApiProperty()
  createdAt: Date
}

export class TicketStatsDto {
  @ApiProperty()
  totalTickets: number

  @ApiProperty()
  openTickets: number

  @ApiProperty()
  inProgressTickets: number

  @ApiProperty()
  resolvedTickets: number

  @ApiProperty()
  escalatedTickets: number

  @ApiProperty()
  avgResolutionTime: number

  @ApiProperty()
  ticketsToday: number

  @ApiProperty()
  ticketsThisWeek: number

  @ApiProperty({ type: 'object' })
  ticketsByPriority: { urgent: number; high: number; medium: number; low: number }

  @ApiProperty({ type: 'object' })
  ticketsByCategory: { technical: number; billing: number; account: number; loan: number; general: number; transaction: number }
}

export class TicketHistoryDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  ticketId: string

  @ApiProperty()
  action: string

  @ApiProperty()
  performedBy: string

  @ApiProperty()
  performedByName: string

  @ApiPropertyOptional()
  details: string | null

  @ApiProperty()
  timestamp: Date
}

export class SupportAgentDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  name: string

  @ApiProperty()
  email: string

  @ApiProperty()
  phone: string

  @ApiProperty()
  department: string

  @ApiProperty()
  tier: number

  @ApiProperty()
  activeTickets: number

  @ApiProperty()
  status: string
}

export class DepartmentDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  name: string

  @ApiProperty()
  description: string

  @ApiProperty()
  tier: number

  @ApiProperty()
  agentCount: number
}

