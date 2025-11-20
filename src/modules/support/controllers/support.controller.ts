import { Body, Controller, Get, Param, Patch, Post, Delete, Query, UseGuards, Logger } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { SupportService } from '../services/support.service'
import { SupportGateway } from '../gateways/support.gateway'
import { TicketResponseDto, ChatMessageDto, TicketStatsDto, TicketHistoryDto, SupportAgentDto, DepartmentDto } from '../dto/ticket-response.dto'
import { CreateTicketDto, UpdateTicketDto, AssignTicketDto, EscalateTicketDto, SendMessageDto, SendMessageBodyDto, TicketFiltersDto, BulkAssignDto, BulkResolveDto, BulkStatusDto, BulkNotifyDto, BulkEscalateDto } from '../dto/ticket.dto'
import { CreateDepartmentDto, UpdateDepartmentDto } from '../dto/department.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../../auth/guards/permissions.guard'
import { TicketAccessGuard } from '../../auth/guards/ticket-access.guard'
import { Permissions } from '../../auth/decorators/permissions.decorator'
import { RequireAdminOnly } from '../../auth/decorators/require-admin-only.decorator'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { AdminUser } from '../../../entities/admin-user.entity'

@ApiTags('support')
@Controller('support')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SupportController {
  private readonly logger = new Logger(SupportController.name)

  constructor(private readonly service: SupportService, private readonly gateway: SupportGateway) {}

  @Get('tickets')
  @ApiOperation({ summary: 'List tickets' })
  @ApiResponse({ status: 200, type: [TicketResponseDto] })
  @Permissions('support', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  getTickets(@Query() filters: TicketFiltersDto): Promise<TicketResponseDto[]> {
    this.logger.log(`GET /support/tickets - Listing tickets with filters: status ${filters.status}, priority ${filters.priority}, category ${filters.category}, assignedTo ${filters.assignedTo}, department ${filters.department}, search ${filters.search}, dateFrom ${filters.dateFrom}, dateTo ${filters.dateTo}, customerId ${filters.customerId}, escalatedTo ${filters.escalatedTo}`)
    return this.service.getTickets(filters) as any
  }

  @Post('tickets')
  @ApiOperation({ summary: 'Create ticket' })
  @ApiResponse({ status: 201, type: TicketResponseDto })
  @Permissions('support', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  createTicket(@Body() dto: CreateTicketDto, @CurrentUser() user: AdminUser): Promise<TicketResponseDto> {
    this.logger.log(`POST /support/tickets - Creating ticket for customer id ${dto.customerId ?? 'null'} and customer name ${dto.customerName ?? 'null'} and customer email ${dto.customerEmail ?? 'null'} and customer phone ${dto.customerPhone ?? 'null'} with subject ${dto.subject} and category ${dto.category} and priority ${dto.priority} by user id ${user.id} and user username ${user.username}`)
    return this.service.createTicket(dto, user) as any
  }

  @Get('tickets/stats')
  @ApiOperation({ summary: 'Ticket stats' })
  @ApiResponse({ status: 200, type: TicketStatsDto })
  @Permissions('support', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  stats(): Promise<TicketStatsDto> {
    this.logger.log(`GET /support/tickets/stats - Getting ticket statistics`)
    return this.service.getTicketStats() as any
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get ticket by id' })
  @ApiResponse({ status: 200, type: TicketResponseDto })
  @Permissions('support', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard, TicketAccessGuard)
  getTicket(@Param('id') id: string): Promise<TicketResponseDto> {
    this.logger.log(`GET /support/tickets/${id} - Getting ticket by id ${id}`)
    return this.service.getTicketById(id) as any
  }

  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Update ticket' })
  @ApiResponse({ status: 200, type: TicketResponseDto })
  @Permissions('support', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard, TicketAccessGuard)
  updateTicket(@Param('id') id: string, @Body() dto: UpdateTicketDto, @CurrentUser() user: AdminUser): Promise<TicketResponseDto> {
    this.logger.log(`PATCH /support/tickets/${id} - Updating ticket with id ${id} by user id ${user.id} and user username ${user.username} with dto ${JSON.stringify(dto)}`)
    return this.service.updateTicket(id, dto, user) as any
  }

  @Post('tickets/assign')
  @ApiOperation({ summary: 'Assign ticket' })
  @ApiResponse({ status: 200, type: TicketResponseDto })
  @Permissions('support', 'write')
  @RequireAdminOnly() // Only Admin and SuperAdmin can assign tickets
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  assignTicket(@Body() dto: AssignTicketDto, @CurrentUser() user: AdminUser): Promise<TicketResponseDto> {
    this.logger.log(`POST /support/tickets/assign - Assigning ticket with id ${dto.ticketId} to agent id ${dto.agentId} by user id ${user.id} and user username ${user.username}`)
    return this.service.assignTicket(dto, user) as any
  }

  @Post('tickets/escalate')
  @ApiOperation({ summary: 'Escalate ticket' })
  @ApiResponse({ status: 200, type: TicketResponseDto })
  @Permissions('support', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  escalateTicket(@Body() dto: EscalateTicketDto, @CurrentUser() user: AdminUser): Promise<TicketResponseDto> {
    this.logger.log(`POST /support/tickets/escalate - Escalating ticket with id ${dto.ticketId} to agent id ${dto.agentId} and admin id ${dto.adminId} with reason ${dto.reason} by user id ${user.id} and user username ${user.username}`)
    return this.service.escalateTicket(dto, user) as any
  }

  @Get('tickets/:id/messages')
  @ApiOperation({ summary: 'List messages' })
  @ApiResponse({ status: 200, type: [ChatMessageDto] })
  @Permissions('support', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard, TicketAccessGuard)
  getMessages(@Param('id') id: string): Promise<ChatMessageDto[]> {
    this.logger.log(`GET /support/tickets/${id}/messages - Getting messages for ticket id ${id}`)
    return this.service.getMessages(id) as any
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Send message' })
  @ApiResponse({ status: 201, type: ChatMessageDto })
  @Permissions('support', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard, TicketAccessGuard)
  sendMessage(@Param('id') id: string, @Body() bodyDto: SendMessageBodyDto, @CurrentUser() user: AdminUser): Promise<ChatMessageDto> {
    this.logger.log(`POST /support/tickets/${id}/messages - Sending message for ticket id ${id} by user id ${user.id} and user username ${user.username}`)
    const dto: SendMessageDto = { ...bodyDto, ticketId: id }
    return this.service.sendMessage(dto, user).then((saved) => {
      try {
        this.gateway.emitMessage(saved as any)
      } catch {}
      return saved as any
    }) as any
  }

  @Get('agents')
  @ApiOperation({ summary: 'List agents' })
  @ApiResponse({ status: 200, type: [SupportAgentDto] })
  @Permissions('support', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  getAgents(): Promise<SupportAgentDto[]> {
    this.logger.log(`GET /support/agents - Getting all support agents`)
    return this.service.getAgents() as any
  }

  @Get('departments')
  @ApiOperation({ summary: 'List departments' })
  @ApiResponse({ status: 200, type: [DepartmentDto] })
  @Permissions('support', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  getDepartments(): Promise<DepartmentDto[]> {
    this.logger.log(`GET /support/departments - Getting all departments`)
    return this.service.getDepartments() as any
  }

  @Get('departments/:id')
  @ApiOperation({ summary: 'Get department by id' })
  @ApiResponse({ status: 200, type: DepartmentDto })
  @Permissions('support', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  getDepartment(@Param('id') id: string): Promise<DepartmentDto> {
    this.logger.log(`GET /support/departments/${id} - Getting department by id ${id}`)
    return this.service.getDepartmentById(id) as any
  }

  @Post('departments')
  @ApiOperation({ summary: 'Create department' })
  @ApiResponse({ status: 201, type: DepartmentDto })
  @Permissions('support', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  createDepartment(@Body() dto: CreateDepartmentDto): Promise<DepartmentDto> {
    this.logger.log(`POST /support/departments - Creating department with name ${dto.name} and description ${dto.description} and tier ${dto.tier}`)
    return this.service.createDepartment(dto) as any
  }

  @Patch('departments/:id')
  @ApiOperation({ summary: 'Update department' })
  @ApiResponse({ status: 200, type: DepartmentDto })
  @Permissions('support', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  updateDepartment(@Param('id') id: string, @Body() dto: UpdateDepartmentDto): Promise<DepartmentDto> {
    this.logger.log(`PATCH /support/departments/${id} - Updating department with id ${id} with dto ${JSON.stringify(dto)}`)
    return this.service.updateDepartment(id, dto) as any
  }

  @Delete('departments/:id')
  @ApiOperation({ summary: 'Delete department' })
  @ApiResponse({ status: 200, description: 'Department deleted successfully' })
  @Permissions('support', 'write')
  @RequireAdminOnly()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  deleteDepartment(@Param('id') id: string): Promise<{ message: string }> {
    this.logger.log(`DELETE /support/departments/${id} - Deleting department with id ${id}`)
    return this.service.deleteDepartment(id).then(() => ({ message: 'Department deleted successfully' })) as any
  }

  @Get('tickets/:id/history')
  @ApiOperation({ summary: 'Ticket history' })
  @ApiResponse({ status: 200, type: [TicketHistoryDto] })
  @Permissions('support', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard, TicketAccessGuard)
  history(@Param('id') id: string): Promise<TicketHistoryDto[]> {
    this.logger.log(`GET /support/tickets/${id}/history - Getting ticket history for ticket id ${id}`)
    return this.service.getTicketHistory(id) as any
  }

  @Post('tickets/:id/notify')
  @ApiOperation({ summary: 'Send ticket notification' })
  @Permissions('support', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  notify(@Param('id') id: string, @Body() body: { type: 'email' | 'sms' }) {
    this.logger.log(`POST /support/tickets/${id}/notify - Sending ${body.type} notification for ticket id ${id}`)
    return this.service.sendNotification(id, body.type)
  }

  @Post('tickets/bulk/assign')
  @ApiOperation({ summary: 'Bulk assign tickets' })
  @Permissions('support', 'write')
  @RequireAdminOnly() // Only Admin and SuperAdmin can bulk assign tickets
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  bulkAssign(@Body() dto: BulkAssignDto) {
    this.logger.log(`POST /support/tickets/bulk/assign - Bulk assigning ${dto.ticketIds.length} tickets with ids ${dto.ticketIds.join(', ')} to agent id ${dto.agentId}`)
    return this.service.bulkAssign(dto)
  }

  @Post('tickets/bulk/resolve')
  @ApiOperation({ summary: 'Bulk resolve tickets' })
  @Permissions('support', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  bulkResolve(@Body() dto: BulkResolveDto) {
    this.logger.log(`POST /support/tickets/bulk/resolve - Bulk resolving ${dto.ticketIds.length} tickets with ids ${dto.ticketIds.join(', ')}`)
    return this.service.bulkResolve(dto)
  }

  @Post('tickets/bulk/status')
  @ApiOperation({ summary: 'Bulk update status' })
  @Permissions('support', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  bulkStatus(@Body() dto: BulkStatusDto) {
    this.logger.log(`POST /support/tickets/bulk/status - Bulk updating status to ${dto.status} for ${dto.ticketIds.length} tickets with ids ${dto.ticketIds.join(', ')}`)
    return this.service.bulkStatus(dto)
  }

  @Post('tickets/bulk/notify')
  @ApiOperation({ summary: 'Bulk notify tickets' })
  @Permissions('support', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  bulkNotify(@Body() dto: BulkNotifyDto) {
    this.logger.log(`POST /support/tickets/bulk/notify - Bulk notifying ${dto.ticketIds.length} tickets with ids ${dto.ticketIds.join(', ')} with type ${dto.type}`)
    return this.service.bulkNotify(dto)
  }

  @Post('tickets/bulk/escalate')
  @ApiOperation({ summary: 'Bulk escalate tickets' })
  @Permissions('support', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  bulkEscalate(@Body() dto: BulkEscalateDto) {
    this.logger.log(`POST /support/tickets/bulk/escalate - Bulk escalating ${dto.ticketIds.length} tickets with ids ${dto.ticketIds.join(', ')} to agent id ${dto.agentId} and admin id ${dto.adminId}`)
    return this.service.bulkEscalate(dto)
  }
}
