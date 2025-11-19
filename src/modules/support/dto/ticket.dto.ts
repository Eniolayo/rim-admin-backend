import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsEnum, IsNotEmpty, IsArray, IsUUID, IsDateString, IsNumber, Min } from 'class-validator'
import { TicketCategory, TicketPriority, TicketStatus } from '../../../entities/support-ticket.entity'

export class CreateTicketDto {
  @ApiPropertyOptional({ description: 'Customer ID (UUID)' })
  @IsOptional()
  @IsUUID()
  customerId?: string

  @ApiPropertyOptional({ description: 'Customer full name' })
  @IsOptional()
  @IsString()
  customerName?: string

  @ApiPropertyOptional({ description: 'Customer phone number' })
  @IsOptional()
  @IsString()
  customerPhone?: string

  @ApiPropertyOptional({ description: 'Customer email address' })
  @IsOptional()
  @IsString()
  customerEmail?: string

  @ApiProperty({ description: 'Ticket subject' })
  @IsString()
  @IsNotEmpty()
  subject: string

  @ApiProperty({ description: 'Ticket description' })
  @IsString()
  @IsNotEmpty()
  description: string

  @ApiProperty({ enum: TicketCategory, description: 'Ticket category' })
  @IsEnum(TicketCategory)
  @IsNotEmpty()
  category: TicketCategory

  @ApiProperty({ enum: TicketPriority, description: 'Ticket priority' })
  @IsEnum(TicketPriority)
  @IsNotEmpty()
  priority: TicketPriority

  @ApiPropertyOptional({ type: [String], description: 'Optional tags for categorization' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @ApiPropertyOptional({ description: 'Department to assign ticket to' })
  @IsOptional()
  @IsString()
  department?: string
}

export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: TicketStatus, description: 'Ticket status' })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus

  @ApiPropertyOptional({ enum: TicketPriority, description: 'Ticket priority' })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority

  @ApiPropertyOptional({ description: 'Agent ID to assign ticket to (UUID)' })
  @IsOptional()
  @IsUUID()
  assignedTo?: string

  @ApiPropertyOptional({ description: 'Department name' })
  @IsOptional()
  @IsString()
  department?: string

  @ApiPropertyOptional({ description: 'Agent ID to escalate ticket to (UUID)' })
  @IsOptional()
  @IsUUID()
  escalatedTo?: string

  @ApiPropertyOptional({ description: 'Resolution text' })
  @IsOptional()
  @IsString()
  resolution?: string

  @ApiPropertyOptional({ description: 'Customer ID (UUID)' })
  @IsOptional()
  @IsUUID()
  customerId?: string

  @ApiPropertyOptional({ description: 'Customer full name' })
  @IsOptional()
  @IsString()
  customerName?: string

  @ApiPropertyOptional({ description: 'Customer phone number' })
  @IsOptional()
  @IsString()
  customerPhone?: string

  @ApiPropertyOptional({ description: 'Customer email address' })
  @IsOptional()
  @IsString()
  customerEmail?: string

  @ApiPropertyOptional({ description: 'Ticket subject' })
  @IsOptional()
  @IsString()
  subject?: string

  @ApiPropertyOptional({ description: 'Ticket description' })
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({ enum: TicketCategory, description: 'Ticket category' })
  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory

  @ApiPropertyOptional({ type: [String], description: 'Optional tags for categorization' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]
}

export class AssignTicketDto {
  @ApiProperty({ description: 'Ticket ID (UUID)' })
  @IsUUID()
  @IsNotEmpty()
  ticketId: string

  @ApiProperty({ description: 'Agent ID to assign ticket to (UUID)' })
  @IsUUID()
  @IsNotEmpty()
  agentId: string
}

export class EscalateTicketDto {
  @ApiProperty({ description: 'Ticket ID (UUID)' })
  @IsUUID()
  @IsNotEmpty()
  ticketId: string

  @ApiPropertyOptional({ description: 'Admin ID to escalate ticket to (UUID)' })
  @IsOptional()
  @IsUUID()
  adminId?: string

  @ApiPropertyOptional({ description: 'Agent ID to escalate ticket to (UUID)' })
  @IsOptional()
  @IsUUID()
  agentId?: string

  @ApiProperty({ description: 'Reason for escalation' })
  @IsString()
  @IsNotEmpty()
  reason: string
}

export class SendMessageBodyDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  message: string
}

export class SendMessageDto {
  @ApiProperty({ description: 'Ticket ID (UUID)' })
  @IsUUID()
  @IsNotEmpty()
  ticketId: string

  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  message: string
}

export class TicketFiltersDto {
  @ApiPropertyOptional({ type: [String], enum: TicketStatus, description: 'Filter by ticket status(es)' })
  @IsOptional()
  @IsArray()
  @IsEnum(TicketStatus, { each: true })
  status?: TicketStatus[]

  @ApiPropertyOptional({ type: [String], enum: TicketPriority, description: 'Filter by ticket priority(ies)' })
  @IsOptional()
  @IsArray()
  @IsEnum(TicketPriority, { each: true })
  priority?: TicketPriority[]

  @ApiPropertyOptional({ type: [String], enum: TicketCategory, description: 'Filter by ticket category(ies)' })
  @IsOptional()
  @IsArray()
  @IsEnum(TicketCategory, { each: true })
  category?: TicketCategory[]

  @ApiPropertyOptional({ description: 'Filter by assigned agent ID (UUID)' })
  @IsOptional()
  @IsUUID()
  assignedTo?: string

  @ApiPropertyOptional({ description: 'Filter by department name' })
  @IsOptional()
  @IsString()
  department?: string

  @ApiPropertyOptional({ description: 'Search in ticket number, subject, customer name, or email' })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({ description: 'Filter tickets created from this date (ISO date string)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @ApiPropertyOptional({ description: 'Filter tickets created until this date (ISO date string)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string

  @ApiPropertyOptional({ description: 'Filter by customer ID (UUID)' })
  @IsOptional()
  @IsUUID()
  customerId?: string

  @ApiPropertyOptional({ description: 'Filter by escalated agent ID (UUID)' })
  @IsOptional()
  @IsUUID()
  escalatedTo?: string
}

export class BulkStatusDto {
  @ApiProperty({ type: [String], description: 'Array of ticket IDs (UUIDs)' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsNotEmpty()
  ticketIds: string[]

  @ApiProperty({ enum: TicketStatus, description: 'Status to set for all tickets' })
  @IsEnum(TicketStatus)
  @IsNotEmpty()
  status: TicketStatus
}

export class BulkAssignDto {
  @ApiProperty({ type: [String], description: 'Array of ticket IDs (UUIDs)' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsNotEmpty()
  ticketIds: string[]

  @ApiProperty({ description: 'Agent ID to assign tickets to (UUID)' })
  @IsUUID()
  @IsNotEmpty()
  agentId: string
}

export class BulkResolveDto {
  @ApiProperty({ type: [String], description: 'Array of ticket IDs (UUIDs)' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsNotEmpty()
  ticketIds: string[]

  @ApiPropertyOptional({ description: 'Resolution text for all tickets' })
  @IsOptional()
  @IsString()
  resolution?: string
}

export class BulkNotifyDto {
  @ApiProperty({ type: [String], description: 'Array of ticket IDs (UUIDs)' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsNotEmpty()
  ticketIds: string[]

  @ApiProperty({ enum: ['email', 'sms'], description: 'Notification type' })
  @IsEnum(['email', 'sms'])
  @IsNotEmpty()
  type: 'email' | 'sms'
}

export class BulkEscalateDto {
  @ApiProperty({ type: [String], description: 'Array of ticket IDs (UUIDs)' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsNotEmpty()
  ticketIds: string[]

  @ApiPropertyOptional({ description: 'Admin ID to escalate tickets to (UUID)' })
  @IsOptional()
  @IsUUID()
  adminId?: string

  @ApiPropertyOptional({ description: 'Agent ID to escalate tickets to (UUID)' })
  @IsOptional()
  @IsUUID()
  agentId?: string

  @ApiProperty({ description: 'Reason for escalation' })
  @IsString()
  @IsNotEmpty()
  reason: string
}
