import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { SupportService } from '../services/support.service'
import { TicketResponseDto, ChatMessageDto, TicketStatsDto, TicketHistoryDto, SupportAgentDto, DepartmentDto } from '../dto/ticket-response.dto'
import { CreateTicketDto, UpdateTicketDto, AssignTicketDto, EscalateTicketDto, SendMessageDto, TicketFiltersDto, BulkAssignDto, BulkResolveDto, BulkStatusDto, BulkNotifyDto, BulkEscalateDto } from '../dto/ticket.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'

@ApiTags('support')
@Controller('support')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SupportController {
  constructor(private readonly service: SupportService) {}

  @Get('tickets')
  @ApiOperation({ summary: 'List tickets' })
  @ApiResponse({ status: 200, type: [TicketResponseDto] })
  getTickets(@Query() filters: TicketFiltersDto): Promise<TicketResponseDto[]> {
    return this.service.getTickets(filters) as any
  }

  @Post('tickets')
  @ApiOperation({ summary: 'Create ticket' })
  @ApiResponse({ status: 201, type: TicketResponseDto })
  createTicket(@Body() dto: CreateTicketDto): Promise<TicketResponseDto> {
    return this.service.createTicket(dto) as any
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get ticket by id' })
  @ApiResponse({ status: 200, type: TicketResponseDto })
  getTicket(@Param('id') id: string): Promise<TicketResponseDto> {
    return this.service.getTicketById(id) as any
  }

  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Update ticket' })
  @ApiResponse({ status: 200, type: TicketResponseDto })
  updateTicket(@Param('id') id: string, @Body() dto: UpdateTicketDto): Promise<TicketResponseDto> {
    return this.service.updateTicket(id, dto) as any
  }

  @Post('tickets/assign')
  @ApiOperation({ summary: 'Assign ticket' })
  @ApiResponse({ status: 200, type: TicketResponseDto })
  assignTicket(@Body() dto: AssignTicketDto): Promise<TicketResponseDto> {
    return this.service.assignTicket(dto) as any
  }

  @Post('tickets/escalate')
  @ApiOperation({ summary: 'Escalate ticket' })
  @ApiResponse({ status: 200, type: TicketResponseDto })
  escalateTicket(@Body() dto: EscalateTicketDto): Promise<TicketResponseDto> {
    return this.service.escalateTicket(dto) as any
  }

  @Get('tickets/:id/messages')
  @ApiOperation({ summary: 'List messages' })
  @ApiResponse({ status: 200, type: [ChatMessageDto] })
  getMessages(@Param('id') id: string): Promise<ChatMessageDto[]> {
    return this.service.getMessages(id) as any
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Send message' })
  @ApiResponse({ status: 201, type: ChatMessageDto })
  sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto): Promise<ChatMessageDto> {
    return this.service.sendMessage({ ...dto, ticketId: id }) as any
  }

  @Get('agents')
  @ApiOperation({ summary: 'List agents' })
  @ApiResponse({ status: 200, type: [SupportAgentDto] })
  getAgents(): Promise<SupportAgentDto[]> {
    return this.service.getAgents() as any
  }

  @Get('departments')
  @ApiOperation({ summary: 'List departments' })
  @ApiResponse({ status: 200, type: [DepartmentDto] })
  getDepartments(): Promise<DepartmentDto[]> {
    return this.service.getDepartments() as any
  }

  @Get('tickets/stats')
  @ApiOperation({ summary: 'Ticket stats' })
  @ApiResponse({ status: 200, type: TicketStatsDto })
  stats(): Promise<TicketStatsDto> {
    return this.service.getTicketStats() as any
  }

  @Get('tickets/:id/history')
  @ApiOperation({ summary: 'Ticket history' })
  @ApiResponse({ status: 200, type: [TicketHistoryDto] })
  history(@Param('id') id: string): Promise<TicketHistoryDto[]> {
    return this.service.getTicketHistory(id) as any
  }

  @Post('tickets/:id/notify')
  @ApiOperation({ summary: 'Send ticket notification' })
  notify(@Param('id') id: string, @Body() body: { type: 'email' | 'sms' }) {
    return this.service.sendNotification(id, body.type)
  }

  @Post('tickets/bulk/assign')
  @ApiOperation({ summary: 'Bulk assign tickets' })
  bulkAssign(@Body() dto: BulkAssignDto) {
    return this.service.bulkAssign(dto)
  }

  @Post('tickets/bulk/resolve')
  @ApiOperation({ summary: 'Bulk resolve tickets' })
  bulkResolve(@Body() dto: BulkResolveDto) {
    return this.service.bulkResolve(dto)
  }

  @Post('tickets/bulk/status')
  @ApiOperation({ summary: 'Bulk update status' })
  bulkStatus(@Body() dto: BulkStatusDto) {
    return this.service.bulkStatus(dto)
  }

  @Post('tickets/bulk/notify')
  @ApiOperation({ summary: 'Bulk notify tickets' })
  bulkNotify(@Body() dto: BulkNotifyDto) {
    return this.service.bulkNotify(dto)
  }

  @Post('tickets/bulk/escalate')
  @ApiOperation({ summary: 'Bulk escalate tickets' })
  bulkEscalate(@Body() dto: BulkEscalateDto) {
    return this.service.bulkEscalate(dto)
  }
}

