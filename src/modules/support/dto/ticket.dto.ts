import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsEnum, IsNotEmpty, IsArray } from 'class-validator'
import { TicketCategory, TicketPriority, TicketStatus } from '../../../entities/support-ticket.entity'

export class CreateTicketDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  customerId: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  customerName: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  customerPhone: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  customerEmail: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subject: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string

  @ApiProperty({ enum: TicketCategory })
  @IsEnum(TicketCategory)
  category: TicketCategory

  @ApiProperty({ enum: TicketPriority })
  @IsEnum(TicketPriority)
  priority: TicketPriority

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[]
}

export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  escalatedTo?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolution?: string
}

export class AssignTicketDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ticketId: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  agentId: string
}

export class EscalateTicketDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ticketId: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agentId?: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string
}

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ticketId: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string
}

export class TicketFiltersDto {
  @ApiPropertyOptional({ type: [String], enum: TicketStatus })
  @IsOptional()
  status?: TicketStatus[]

  @ApiPropertyOptional({ type: [String], enum: TicketPriority })
  @IsOptional()
  priority?: TicketPriority[]

  @ApiPropertyOptional({ type: [String], enum: TicketCategory })
  @IsOptional()
  category?: TicketCategory[]

  @ApiPropertyOptional()
  @IsOptional()
  assignedTo?: string

  @ApiPropertyOptional()
  @IsOptional()
  department?: string

  @ApiPropertyOptional()
  @IsOptional()
  search?: string

  @ApiPropertyOptional()
  @IsOptional()
  dateFrom?: string

  @ApiPropertyOptional()
  @IsOptional()
  dateTo?: string
}

export class BulkStatusDto {
  @ApiProperty()
  @IsNotEmpty()
  ticketIds: string[]

  @ApiProperty({ enum: TicketStatus })
  @IsEnum(TicketStatus)
  status: TicketStatus
}

export class BulkAssignDto {
  @ApiProperty()
  @IsNotEmpty()
  ticketIds: string[]

  @ApiProperty()
  @IsString()
  agentId: string
}

export class BulkResolveDto {
  @ApiProperty()
  @IsNotEmpty()
  ticketIds: string[]
}

export class BulkNotifyDto {
  @ApiProperty()
  @IsNotEmpty()
  ticketIds: string[]

  @ApiProperty()
  @IsString()
  type: 'email' | 'sms'
}

export class BulkEscalateDto {
  @ApiProperty()
  @IsNotEmpty()
  ticketIds: string[]

  @ApiPropertyOptional()
  @IsOptional()
  department?: string

  @ApiPropertyOptional()
  @IsOptional()
  agentId?: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string
}

