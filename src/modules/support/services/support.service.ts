import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketRepository } from '../repositories/ticket.repository';
import { MessageRepository } from '../repositories/message.repository';
import { HistoryRepository } from '../repositories/history.repository';
import { AgentRepository } from '../repositories/agent.repository';
import { DepartmentRepository } from '../repositories/department.repository';
import {
  CreateTicketDto,
  UpdateTicketDto,
  AssignTicketDto,
  EscalateTicketDto,
  SendMessageDto,
  TicketFiltersDto,
  BulkAssignDto,
  BulkResolveDto,
  BulkStatusDto,
  BulkNotifyDto,
  BulkEscalateDto,
} from '../dto/ticket.dto';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from '../dto/department.dto';
import { Department } from '../../../entities/department.entity';
import { AdminRole } from '../../../entities/admin-role.entity';
import {
  ChatMessage,
  MessageSenderType,
} from '../../../entities/chat-message.entity';
import {
  SupportTicket,
  TicketStatus,
} from '../../../entities/support-ticket.entity';
import { TicketHistory } from '../../../entities/ticket-history.entity';
import { AdminUser } from '../../../entities/admin-user.entity';
import { SupportAgent } from '../../../entities/support-agent.entity';
import { EmailService } from '../../email/email.service';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);
  private systemAdminIdCache: string | null = null;

  constructor(
    private readonly tickets: TicketRepository,
    private readonly messages: MessageRepository,
    private readonly history: HistoryRepository,
    private readonly agents: AgentRepository,
    private readonly departments: DepartmentRepository,
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    @InjectRepository(AdminRole)
    private readonly adminRoleRepository: Repository<AdminRole>,
    private readonly emailService: EmailService,
  ) {}

  async getTickets(filters: TicketFiltersDto): Promise<SupportTicket[]> {
    this.logger.log(
      `Getting tickets with filters: status ${filters.status}, priority ${filters.priority}, category ${filters.category}, assignedTo ${filters.assignedTo}, department ${filters.department}, search ${filters.search}, dateFrom ${filters.dateFrom}, dateTo ${filters.dateTo}, customerId ${filters.customerId}, escalatedTo ${filters.escalatedTo}`,
    );
    const df = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
    const dt = filters.dateTo ? new Date(filters.dateTo) : undefined;
    const tickets = await this.tickets.findAll({
      status: filters.status,
      priority: filters.priority,
      category: filters.category,
      assignedTo: filters.assignedTo,
      department: filters.department,
      search: filters.search,
      dateFrom: df,
      dateTo: dt,
      customerId: filters.customerId,
      escalatedTo: filters.escalatedTo,
    });
    this.logger.log(`Retrieved ${tickets.length} tickets matching filters`);
    return tickets;
  }

  async getTicketById(id: string): Promise<SupportTicket> {
    this.logger.log(`Getting ticket by id ${id}`);
    const t = await this.tickets.findById(id);
    if (!t) {
      this.logger.log(`Ticket not found with id ${id}`);
      throw new NotFoundException('Ticket not found');
    }
    this.logger.log(
      `Ticket retrieved successfully with id ${id} and ticket number ${t.ticketNumber}`,
    );
    return t;
  }

  async createTicket(
    dto: CreateTicketDto,
    user?: AdminUser,
  ): Promise<SupportTicket> {
    this.logger.log(
      `Creating ticket for customer id ${dto.customerId ?? 'null'} and customer name ${dto.customerName ?? 'null'} and customer email ${dto.customerEmail ?? 'null'} and customer phone ${dto.customerPhone ?? 'null'} with subject ${dto.subject} and category ${dto.category} and priority ${dto.priority}${dto.assignedTo ? ` assigned to ${dto.assignedTo}` : ''} by user id ${user?.id ?? 'null'} and user username ${user?.username ?? 'null'}`,
    );
    const number = await this.tickets.generateTicketNumber();

    // Determine assignment details if assignedTo is provided
    let assignedToName: string | null = null;
    let initialStatus = TicketStatus.OPEN;

    if (dto.assignedTo) {
      // Try to find as agent first
      const agent = await this.agents.findById(dto.assignedTo);
      if (agent) {
        assignedToName = agent.name;
        agent.activeTickets = (agent.activeTickets || 0) + 1;
        await this.agents.save(agent);
        initialStatus = TicketStatus.IN_PROGRESS;
      } else {
        // Try to find as admin
        const admin = await this.adminUserRepository.findOne({
          where: { id: dto.assignedTo },
        });
        if (admin) {
          assignedToName = admin.username;
          initialStatus = TicketStatus.IN_PROGRESS;
        }
      }
    }

    const ticket: SupportTicket = Object.assign(new SupportTicket(), {
      ticketNumber: number,
      customerId: dto.customerId ?? null,
      customerName: dto.customerName ?? null,
      customerPhone: dto.customerPhone ?? null,
      customerEmail: dto.customerEmail ?? null,
      subject: dto.subject,
      description: dto.description,
      category: dto.category,
      priority: dto.priority,
      status: initialStatus,
      messageCount: 0,
      tags: dto.tags ?? null,
      department: dto.department ?? null,
      assignedTo: dto.assignedTo ?? null,
      assignedToName: assignedToName,
    });
    const saved = await this.tickets.save(ticket);
    const performedBy = user?.id ?? (await this.getSystemAdminId());
    const performedByName = user?.username ?? 'System';
    await this.history.save(
      Object.assign(new TicketHistory(), {
        ticketId: saved.id,
        action: 'ticket_created',
        performedBy,
        performedByName,
      }),
    );

    // If ticket was assigned during creation, add assignment history and send email
    if (dto.assignedTo && assignedToName) {
      await this.history.save(
        Object.assign(new TicketHistory(), {
          ticketId: saved.id,
          action: 'ticket_assigned',
          performedBy,
          performedByName,
          details: `Assigned to ${assignedToName}`,
        }),
      );

      // Send assignment notification email
      try {
        await this.sendAssignmentNotificationEmail(saved, dto.assignedTo);
      } catch (error) {
        this.logger.error(
          `Failed to send assignment notification email for ticket ${saved.id}: ${error.message}`,
        );
        // Don't fail ticket creation if email fails
      }
    }

    this.logger.log(
      `Ticket created successfully with id ${saved.id} and ticket number ${saved.ticketNumber} for customer id ${saved.customerId ?? 'null'} and customer name ${saved.customerName ?? 'null'} and customer email ${saved.customerEmail ?? 'null'} and customer phone ${saved.customerPhone ?? 'null'}${saved.assignedTo ? ` assigned to ${saved.assignedToName}` : ''}`,
    );
    return saved;
  }

  private async getSystemAdminId(): Promise<string> {
    if (this.systemAdminIdCache) {
      return this.systemAdminIdCache;
    }
    const firstAdmin = await this.adminUserRepository.findOne({
      order: { createdAt: 'ASC' },
    });
    if (!firstAdmin) {
      throw new Error(
        'No admin user found in database. Cannot create ticket history.',
      );
    }
    this.systemAdminIdCache = firstAdmin.id;
    return firstAdmin.id;
  }

  async updateTicket(
    id: string,
    dto: UpdateTicketDto,
    user?: AdminUser,
  ): Promise<SupportTicket> {
    this.logger.log(
      `Updating ticket with id ${id} by user id ${user?.id} and user username ${user?.username} with dto ${JSON.stringify(dto)}`,
    );
    const t = await this.getTicketById(id);
    const prevStatus = t.status;
    const prevPriority = t.priority;
    const patch: Partial<SupportTicket> = { ...dto };
    if (dto.status === TicketStatus.RESOLVED && !t.resolvedAt) {
      patch.resolvedAt = new Date();
      patch.resolvedBy = user?.id ?? t.resolvedBy ?? null;
    }
    await this.tickets.update(id, patch);
    const updated = await this.getTicketById(id);
    if (dto.status && dto.status !== prevStatus) {
      const performedBy = user?.id ?? (await this.getSystemAdminId());
      await this.history.save(
        Object.assign(new TicketHistory(), {
          ticketId: updated.id,
          action:
            dto.status === TicketStatus.RESOLVED
              ? 'ticket_resolved'
              : dto.status === TicketStatus.CLOSED
                ? 'ticket_closed'
                : 'status_changed',
          performedBy,
          performedByName: user?.username ?? 'System',
        }),
      );
      if (
        (dto.status === TicketStatus.RESOLVED ||
          dto.status === TicketStatus.CLOSED) &&
        t.assignedTo
      ) {
        const a = await this.agents.findById(t.assignedTo);
        if (a) {
          a.activeTickets = Math.max(0, (a.activeTickets || 0) - 1);
          await this.agents.save(a);
        }
      }
      this.logger.log(
        `Ticket status changed from ${prevStatus} to ${dto.status} for ticket id ${id} by user id ${user?.id} and user username ${user?.username}`,
      );
    }
    if (dto.priority && dto.priority !== prevPriority) {
      const performedBy = user?.id ?? (await this.getSystemAdminId());
      await this.history.save(
        Object.assign(new TicketHistory(), {
          ticketId: updated.id,
          action: 'priority_changed',
          performedBy,
          performedByName: user?.username ?? 'System',
          details: `Priority changed to ${dto.priority}`,
        }),
      );
      this.logger.log(
        `Ticket priority changed from ${prevPriority} to ${dto.priority} for ticket id ${id} by user id ${user?.id} and user username ${user?.username}`,
      );
    }
    this.logger.log(
      `Ticket updated successfully with id ${id} and ticket number ${updated.ticketNumber}`,
    );
    return updated;
  }

  async assignTicket(
    dto: AssignTicketDto,
    user?: AdminUser,
  ): Promise<SupportTicket> {
    this.logger.log(
      `Assigning ticket with id ${dto.ticketId} to agent/admin id ${dto.agentId} by user id ${user?.id ?? 'null'} and user username ${user?.username ?? 'null'}`,
    );
    const t = await this.getTicketById(dto.ticketId);

    // Try to find as agent first
    let assignedToName: string | null = null;
    const agent = await this.agents.findById(dto.agentId);
    if (agent) {
      assignedToName = agent.name;
      agent.activeTickets = (agent.activeTickets || 0) + 1;
      await this.agents.save(agent);
    } else {
      // Try to find as admin
      const admin = await this.adminUserRepository.findOne({
        where: { id: dto.agentId },
      });
      if (admin) {
        assignedToName = admin.username;
      }
    }

    const patch: Partial<SupportTicket> = {
      assignedTo: dto.agentId,
      assignedToName: assignedToName,
      status:
        t.status === TicketStatus.OPEN ? TicketStatus.IN_PROGRESS : t.status,
    };
    await this.tickets.update(t.id, patch);
    const updated = await this.getTicketById(t.id);
    const performedBy = user?.id ?? (await this.getSystemAdminId());
    await this.history.save(
      Object.assign(new TicketHistory(), {
        ticketId: updated.id,
        action: 'ticket_assigned',
        performedBy,
        performedByName: user?.username ?? 'System',
        details: `Assigned to ${updated.assignedToName}`,
      }),
    );

    // Send assignment notification email
    try {
      await this.sendAssignmentNotificationEmail(updated, dto.agentId);
    } catch (error) {
      this.logger.error(
        `Failed to send assignment notification email for ticket ${updated.id}: ${error.message}`,
      );
      // Don't fail assignment if email fails
    }

    this.logger.log(
      `Ticket assigned successfully with ticket id ${updated.id} and ticket number ${updated.ticketNumber} to agent/admin id ${dto.agentId} and name ${updated.assignedToName}`,
    );
    return updated;
  }

  async escalateTicket(
    dto: EscalateTicketDto,
    user?: AdminUser,
  ): Promise<SupportTicket> {
    this.logger.log(
      `Escalating ticket with id ${dto.ticketId} to agent id ${dto.agentId} and admin id ${dto.adminId} with reason ${dto.reason} by user id ${user?.id ?? 'null'} and user username ${user?.username ?? 'null'}`,
    );
    const t = await this.getTicketById(dto.ticketId);
    let escalatedName: string | null = null;
    let newAgent: SupportAgent | null = null;
    let escalatedToId: string | null = null;

    if (dto.agentId) {
      const a = await this.agents.findById(dto.agentId);
      newAgent = a;
      escalatedName = a?.name ?? null;
      escalatedToId = dto.agentId;
    } else if (dto.adminId) {
      const admin = await this.adminUserRepository.findOne({
        where: { id: dto.adminId },
      });
      if (!admin) {
        throw new NotFoundException(`Admin with id ${dto.adminId} not found`);
      }
      escalatedName = admin.username ?? null;
      escalatedToId = dto.adminId;
    }

    const patch: Partial<SupportTicket> = {
      status: TicketStatus.ESCALATED,
      escalatedTo: escalatedToId,
      escalatedToName: escalatedName,
      department: t.department ?? null,
    };
    await this.tickets.update(t.id, patch);
    if (t.assignedTo) {
      const prevAgent = await this.agents.findById(t.assignedTo);
      if (prevAgent) {
        prevAgent.activeTickets = Math.max(
          0,
          (prevAgent.activeTickets || 0) - 1,
        );
        await this.agents.save(prevAgent);
      }
    }
    if (newAgent) {
      newAgent.activeTickets = (newAgent.activeTickets || 0) + 1;
      await this.agents.save(newAgent);
    }
    const updated = await this.getTicketById(t.id);
    const performedBy = user?.id ?? (await this.getSystemAdminId());
    await this.history.save(
      Object.assign(new TicketHistory(), {
        ticketId: updated.id,
        action: 'ticket_escalated',
        performedBy,
        performedByName: user?.username ?? 'System',
        details: dto.reason,
      }),
    );
    this.logger.log(
      `Ticket escalated successfully with ticket id ${updated.id} and ticket number ${updated.ticketNumber} to ${dto.agentId ? 'agent' : 'admin'} id ${escalatedToId} and name ${escalatedName}`,
    );
    return updated;
  }

  async getMessages(ticketId: string) {
    this.logger.log(`Getting messages for ticket id ${ticketId}`);
    const messages = await this.messages.findByTicketId(ticketId);
    this.logger.log(
      `Retrieved ${messages.length} messages for ticket id ${ticketId}`,
    );
    return messages;
  }

  async sendMessage(
    dto: SendMessageDto,
    user?: AdminUser,
  ): Promise<ChatMessage> {
    this.logger.log(
      `Sending message for ticket id ${dto.ticketId} by user id ${user?.id} and user username ${user?.username}`,
    );
    const t = await this.getTicketById(dto.ticketId);
    const senderId = user?.id ?? (await this.getSystemAdminId());
    const senderName = user?.username ?? 'System';
    const msg = Object.assign(new ChatMessage(), {
      ticketId: dto.ticketId,
      senderId,
      senderName,
      senderType: MessageSenderType.AGENT,
      message: dto.message,
      isRead: false,
    });
    const saved = await this.messages.save(msg);
    await this.tickets.update(t.id, {
      messageCount: t.messageCount + 1,
      lastMessageAt: new Date(),
    });
    await this.history.save(
      Object.assign(new TicketHistory(), {
        ticketId: t.id,
        action: 'message_sent',
        performedBy: senderId,
        performedByName: senderName,
      }),
    );
    this.logger.log(
      `Message sent successfully with id ${saved.id} for ticket id ${dto.ticketId} and ticket number ${t.ticketNumber} by user id ${user?.id} and user username ${user?.username}`,
    );
    return saved;
  }

  async getAgents() {
    this.logger.log(`Getting all support agents`);
    const agents = await this.agents.findAll();
    this.logger.log(`Retrieved ${agents.length} support agents`);
    return agents;
  }

  async getDepartments() {
    this.logger.log(`Getting all departments`);
    const allDepartments = await this.departments.findAll();
    const allAgents = await this.agents.findAll();
    const allAdminUsers = await this.adminUserRepository.find({
      relations: ['roleEntity'],
    });

    // Recalculate agentCount for all departments to ensure accuracy
    const departmentsWithCounts = await Promise.all(
      allDepartments.map(async (department) => {
        // Count SupportAgents by department name
        const supportAgentCount = allAgents.filter(
          (agent) => agent.department === department.name,
        ).length;

        // Count AdminUsers whose roles are assigned to this department
        const adminUserCount = allAdminUsers.filter(
          (user) => user.roleEntity?.departmentId === department.id,
        ).length;

        // Total count is the sum of both
        const totalCount = supportAgentCount + adminUserCount;
        department.agentCount = totalCount;
        // Update the database to keep it in sync
        await this.departments.save(department);
        return department;
      }),
    );

    this.logger.log(
      `Retrieved ${departmentsWithCounts.length} departments with recalculated agent counts`,
    );
    return departmentsWithCounts;
  }

  async getDepartmentById(id: string): Promise<Department> {
    this.logger.log(`Getting department by id ${id}`);
    const department = await this.departments.findById(id);
    if (!department) {
      this.logger.log(`Department not found with id ${id}`);
      throw new NotFoundException('Department not found');
    }
    // Recalculate agentCount to ensure accuracy
    const allAgents = await this.agents.findAll();
    const allAdminUsers = await this.adminUserRepository.find({
      relations: ['roleEntity'],
    });

    // Count SupportAgents by department name
    const supportAgentCount = allAgents.filter(
      (agent) => agent.department === department.name,
    ).length;

    // Count AdminUsers whose roles are assigned to this department
    const adminUserCount = allAdminUsers.filter(
      (user) => user.roleEntity?.departmentId === department.id,
    ).length;

    // Total count is the sum of both
    const totalCount = supportAgentCount + adminUserCount;
    department.agentCount = totalCount;
    // Update the database to keep it in sync
    await this.departments.save(department);
    this.logger.log(
      `Department retrieved successfully with id ${id} and name ${department.name} with ${totalCount} agents (${supportAgentCount} support agents, ${adminUserCount} admin users)`,
    );
    return department;
  }

  async createDepartment(dto: CreateDepartmentDto): Promise<Department> {
    this.logger.log(
      `Creating department with name ${dto.name} and description ${dto.description} and tier ${dto.tier}`,
    );
    const department: Department = Object.assign(new Department(), {
      name: dto.name,
      description: dto.description,
      tier: dto.tier,
      agentCount: 0,
    });
    const saved = await this.departments.save(department);
    this.logger.log(
      `Department created successfully with id ${saved.id} and name ${saved.name}`,
    );
    return saved;
  }

  async updateDepartment(
    id: string,
    dto: UpdateDepartmentDto,
  ): Promise<Department> {
    this.logger.log(
      `Updating department with id ${id} with dto ${JSON.stringify(dto)}`,
    );
    const department = await this.getDepartmentById(id);
    const patch: Partial<Department> = { ...dto };
    await this.departments.update(id, patch);
    const updated = await this.getDepartmentById(id);
    this.logger.log(
      `Department updated successfully with id ${id} and name ${updated.name}`,
    );
    return updated;
  }

  async deleteDepartment(id: string): Promise<void> {
    this.logger.log(`Deleting department with id ${id}`);
    const department = await this.getDepartmentById(id);

    // Check if department is assigned to any AdminRole
    const rolesWithDepartment = await this.adminRoleRepository.find({
      where: { departmentId: id },
    });
    if (rolesWithDepartment.length > 0) {
      this.logger.warn(
        `Cannot delete department ${id} - it is assigned to ${rolesWithDepartment.length} role(s)`,
      );
      throw new NotFoundException(
        `Cannot delete department: It is assigned to ${rolesWithDepartment.length} role(s). Please remove the department from all roles first.`,
      );
    }

    // Check if department has any SupportAgents
    const agents = await this.agents.findAll();
    const agentsInDepartment = agents.filter(
      (agent) => agent.department === department.name,
    );
    if (agentsInDepartment.length > 0) {
      this.logger.warn(
        `Cannot delete department ${id} - it has ${agentsInDepartment.length} agent(s)`,
      );
      throw new NotFoundException(
        `Cannot delete department: It has ${agentsInDepartment.length} agent(s). Please reassign or remove agents first.`,
      );
    }

    await this.departments.delete(id);
    this.logger.log(`Department deleted successfully with id ${id}`);
  }

  async getTicketStats() {
    this.logger.log(`Getting ticket statistics`);
    const stats = await this.tickets.stats();
    this.logger.log(
      `Ticket statistics retrieved: total ${stats.totalTickets}, open ${stats.openTickets}, in progress ${stats.inProgressTickets}, resolved ${stats.resolvedTickets}, escalated ${stats.escalatedTickets}`,
    );
    return stats;
  }

  async getTicketHistory(ticketId: string) {
    this.logger.log(`Getting ticket history for ticket id ${ticketId}`);
    const history = await this.history.findByTicketId(ticketId);
    this.logger.log(
      `Retrieved ${history.length} history entries for ticket id ${ticketId}`,
    );
    return history;
  }

  async sendNotification(ticketId: string, type: 'email' | 'sms') {
    this.logger.log(`Sending ${type} notification for ticket id ${ticketId}`);
    return true;
  }

  private async sendAssignmentNotificationEmail(
    ticket: SupportTicket,
    assignedToId: string,
  ): Promise<void> {
    if (!ticket.assignedToName) {
      this.logger.warn(
        `Cannot send assignment email: ticket ${ticket.id} has no assignedToName`,
      );
      return;
    }

    // Try to find as agent first
    const agent = await this.agents.findById(assignedToId);
    let recipientEmail: string | null = null;
    let recipientName: string = ticket.assignedToName;

    if (agent) {
      recipientEmail = agent.email;
    } else {
      // Try to find as admin
      const admin = await this.adminUserRepository.findOne({
        where: { id: assignedToId },
      });
      if (admin) {
        recipientEmail = admin.email;
      }
    }

    if (!recipientEmail) {
      this.logger.warn(
        `Cannot send assignment email: no email found for assigned user/agent ${assignedToId}`,
      );
      return;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const ticketUrl = `${frontendUrl}/support/tickets/${ticket.id}`;
    const priorityColors: Record<string, string> = {
      low: '#95a5a6',
      medium: '#3498db',
      high: '#f39c12',
      urgent: '#e74c3c',
    };
    const priorityColor = priorityColors[ticket.priority] || '#95a5a6';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ticket Assignment - RIM</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h2 style="color: #2c3e50; margin-top: 0;">New Ticket Assignment</h2>
            <p>Hello ${recipientName},</p>
            <p>You have been assigned a new support ticket:</p>
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${priorityColor};">
              <h3 style="margin-top: 0; color: #2c3e50;">${ticket.subject}</h3>
              <p style="margin: 10px 0;"><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
              <p style="margin: 10px 0;"><strong>Priority:</strong> <span style="color: ${priorityColor}; font-weight: bold; text-transform: capitalize;">${ticket.priority}</span></p>
              <p style="margin: 10px 0;"><strong>Category:</strong> <span style="text-transform: capitalize;">${ticket.category}</span></p>
              ${ticket.customerName ? `<p style="margin: 10px 0;"><strong>Customer:</strong> ${ticket.customerName}</p>` : ''}
              ${ticket.customerEmail ? `<p style="margin: 10px 0;"><strong>Customer Email:</strong> ${ticket.customerEmail}</p>` : ''}
            </div>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${ticketUrl}" 
                 style="background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Ticket
              </a>
            </p>
            <p style="font-size: 14px; color: #666;">
              Or copy and paste this link into your browser:<br>
              <a href="${ticketUrl}" style="color: #3498db; word-break: break-all;">${ticketUrl}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">
              This is an automated message from RIM Admin Portal. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
New Ticket Assignment

Hello ${recipientName},

You have been assigned a new support ticket:

Ticket Number: ${ticket.ticketNumber}
Subject: ${ticket.subject}
Priority: ${ticket.priority}
Category: ${ticket.category}
${ticket.customerName ? `Customer: ${ticket.customerName}` : ''}
${ticket.customerEmail ? `Customer Email: ${ticket.customerEmail}` : ''}

View the ticket at: ${ticketUrl}

This is an automated message from RIM Admin Portal. Please do not reply to this email.
    `;

    await this.emailService.sendEmail({
      to: recipientEmail,
      subject: `New Ticket Assignment: ${ticket.ticketNumber} - ${ticket.subject}`,
      html,
      text,
    });

    this.logger.log(
      `Assignment notification email sent to ${recipientEmail} for ticket ${ticket.ticketNumber}`,
    );
  }

  async bulkAssign(dto: BulkAssignDto) {
    this.logger.log(
      `Bulk assigning ${dto.ticketIds.length} tickets with ids ${dto.ticketIds.join(', ')} to agent id ${dto.agentId}`,
    );
    const agent = await this.agents.findById(dto.agentId);
    await this.tickets.bulkUpdate(dto.ticketIds, {
      assignedTo: dto.agentId,
      assignedToName: agent?.name ?? null,
      status: TicketStatus.IN_PROGRESS,
    });
    const updated = await Promise.all(
      dto.ticketIds.map((id) => this.getTicketById(id)),
    );
    this.logger.log(
      `Bulk assign completed successfully for ${updated.length} tickets to agent id ${dto.agentId} and agent name ${agent?.name}`,
    );
    return updated;
  }

  async bulkResolve(dto: BulkResolveDto) {
    this.logger.log(
      `Bulk resolving ${dto.ticketIds.length} tickets with ids ${dto.ticketIds.join(', ')} with resolution ${dto.resolution ?? 'Bulk resolved.'}`,
    );
    await this.tickets.bulkUpdate(dto.ticketIds, {
      status: TicketStatus.RESOLVED,
      resolution: dto.resolution ?? 'Bulk resolved.',
      resolvedAt: new Date(),
    });
    const updated = await Promise.all(
      dto.ticketIds.map((id) => this.getTicketById(id)),
    );
    this.logger.log(
      `Bulk resolve completed successfully for ${updated.length} tickets`,
    );
    return updated;
  }

  async bulkStatus(dto: BulkStatusDto) {
    this.logger.log(
      `Bulk updating status to ${dto.status} for ${dto.ticketIds.length} tickets with ids ${dto.ticketIds.join(', ')}`,
    );
    await this.tickets.bulkUpdate(dto.ticketIds, { status: dto.status });
    const updated = await Promise.all(
      dto.ticketIds.map((id) => this.getTicketById(id)),
    );
    this.logger.log(
      `Bulk status update completed successfully for ${updated.length} tickets to status ${dto.status}`,
    );
    return updated;
  }

  async bulkNotify(dto: BulkNotifyDto) {
    this.logger.log(
      `Bulk notifying ${dto.ticketIds.length} tickets with ids ${dto.ticketIds.join(', ')} with type ${dto.type}`,
    );
    return true;
  }

  async bulkEscalate(dto: BulkEscalateDto) {
    this.logger.log(
      `Bulk escalating ${dto.ticketIds.length} tickets with ids ${dto.ticketIds.join(', ')} to agent id ${dto.agentId} and admin id ${dto.adminId}`,
    );
    let escalatedName: string | null = null;
    let escalatedToId: string | null = null;

    if (dto.agentId) {
      const a = await this.agents.findById(dto.agentId);
      escalatedName = a?.name ?? null;
      escalatedToId = dto.agentId;
    } else if (dto.adminId) {
      const admin = await this.adminUserRepository.findOne({
        where: { id: dto.adminId },
      });
      if (!admin) {
        throw new NotFoundException(`Admin with id ${dto.adminId} not found`);
      }
      escalatedName = admin.username ?? null;
      escalatedToId = dto.adminId;
    }

    await this.tickets.bulkUpdate(dto.ticketIds, {
      status: TicketStatus.ESCALATED,
      escalatedTo: escalatedToId,
      escalatedToName: escalatedName,
    });
    const updated = await Promise.all(
      dto.ticketIds.map((id) => this.getTicketById(id)),
    );
    this.logger.log(
      `Bulk escalate completed successfully for ${updated.length} tickets to ${dto.agentId ? 'agent' : 'admin'} id ${escalatedToId} and name ${escalatedName}`,
    );
    return updated;
  }
}
