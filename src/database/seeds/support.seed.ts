import { DataSource } from 'typeorm'
import dataSource from '../data-source'
import { Department } from '../../entities/department.entity'
import { SupportAgent, AgentStatus } from '../../entities/support-agent.entity'
import { SupportTicket, TicketCategory, TicketPriority, TicketStatus } from '../../entities/support-ticket.entity'
import { ChatMessage, MessageSenderType } from '../../entities/chat-message.entity'
import { TicketHistory } from '../../entities/ticket-history.entity'
import { AdminUser } from '../../entities/admin-user.entity'

interface SeedContext {
  ds: DataSource
  adminResolver: AdminUser | null
}

const departmentsSeed: Array<Partial<Department>> = [
  { name: 'Technical Support', description: 'Technical issues and app problems', tier: 1 },
  { name: 'Billing & Payments', description: 'Billing and payment inquiries', tier: 1 },
  { name: 'Account Management', description: 'Account and profile issues', tier: 1 },
  { name: 'Loan Services', description: 'Loan applications and credit inquiries', tier: 2 },
  { name: 'General Support', description: 'General inquiries', tier: 1 },
  { name: 'Transaction Support', description: 'Transaction-specific issues and refunds', tier: 2 },
]

const agentsSeed: Array<Partial<SupportAgent>> = [
  { name: 'Sarah Johnson', email: 'sarah.johnson@rim.com', phone: '+234 901 111 1111', department: 'Technical Support', tier: 1, status: AgentStatus.AVAILABLE },
  { name: 'Michael Brown', email: 'michael.brown@rim.com', phone: '+234 901 222 2222', department: 'Loan Services', tier: 1, status: AgentStatus.AVAILABLE },
  { name: 'David Wilson', email: 'david.wilson@rim.com', phone: '+234 901 333 3333', department: 'Loan Services', tier: 2, status: AgentStatus.AVAILABLE },
  { name: 'Emma Davis', email: 'emma.davis@rim.com', phone: '+234 901 444 4444', department: 'Technical Support', tier: 1, status: AgentStatus.BUSY },
  { name: 'James Anderson', email: 'james.anderson@rim.com', phone: '+234 901 555 5555', department: 'Transaction Support', tier: 1, status: AgentStatus.AVAILABLE },
  { name: 'Jane Smith', email: 'jane.smith@rim.com', phone: '+234 901 666 6666', department: 'Billing & Payments', tier: 1, status: AgentStatus.AVAILABLE },
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomPriority(): TicketPriority {
  return pick([TicketPriority.LOW, TicketPriority.MEDIUM, TicketPriority.HIGH, TicketPriority.URGENT])
}

function randomCategory(): TicketCategory {
  return pick([TicketCategory.TECHNICAL, TicketCategory.BILLING, TicketCategory.ACCOUNT, TicketCategory.LOAN, TicketCategory.GENERAL, TicketCategory.TRANSACTION])
}

function generateRandomName(index: number): string {
  const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'James', 'Emma', 'Robert', 'Olivia', 'William', 'Sophia', 'Richard', 'Isabella', 'Joseph', 'Ava', 'Thomas', 'Mia', 'Charles', 'Charlotte']
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee']
  return `${pick(firstNames)} ${pick(lastNames)}`
}

function generateRandomPhone(index: number): string {
  const prefixes = ['080', '081', '090', '091', '070', '071']
  const prefix = pick(prefixes)
  const number = String(10000000 + Math.floor(Math.random() * 90000000)).padStart(8, '0')
  return `+234 ${prefix.substring(1)} ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`
}

function generateRandomEmail(name: string, index: number): string {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'example.com', 'mail.com']
  const namePart = name.toLowerCase().replace(/\s+/g, '.')
  return `${namePart}${index}@${pick(domains)}`
}

async function seedDepartments(ctx: SeedContext): Promise<Department[]> {
  const repo = ctx.ds.getRepository(Department)
  const existing = await repo.find()
  if (existing.length) return existing
  const created = await repo.save(departmentsSeed.map(d => repo.create({ ...d, agentCount: 0 })))
  return created
}

async function seedAgents(ctx: SeedContext, departments: Department[]): Promise<SupportAgent[]> {
  const repo = ctx.ds.getRepository(SupportAgent)
  const agents: SupportAgent[] = []
  
  // Find or create the first agent with email yee@gmail.com
  let agent1 = await repo.findOne({ where: { email: 'yee@gmail.com' } })
  if (!agent1) {
    const techDept = departments.find(d => d.name === 'Technical Support')
    agent1 = repo.create({
      name: 'Agent 23',
      email: 'yee@gmail.com',
      phone: '+234 901 000 0000',
      department: techDept?.name || 'Technical Support',
      tier: 1,
      status: AgentStatus.AVAILABLE,
      activeTickets: 0,
    })
    agent1 = await repo.save(agent1)
    
    // Update department agent count
    if (techDept) {
      techDept.agentCount = (techDept.agentCount || 0) + 1
      await ctx.ds.getRepository(Department).save(techDept)
    }
  }
  agents.push(agent1)
  
  // Find or create the second agent with email web370@etics.us
  let agent2 = await repo.findOne({ where: { email: 'web370@etics.us' } })
  if (!agent2) {
    const techDept = departments.find(d => d.name === 'Technical Support')
    agent2 = repo.create({
      name: 'Agent 22',
      email: 'web370@etics.us',
      phone: '+234 901 000 0001',
      department: techDept?.name || 'Technical Support',
      tier: 1,
      status: AgentStatus.AVAILABLE,
      activeTickets: 0,
    })
    agent2 = await repo.save(agent2)
    
    // Update department agent count
    if (techDept) {
      techDept.agentCount = (techDept.agentCount || 0) + 1
      await ctx.ds.getRepository(Department).save(techDept)
    }
  }
  agents.push(agent2)
  
  return agents
}

async function findAdminResolver(ds: DataSource): Promise<AdminUser | null> {
  const repo = ds.getRepository(AdminUser)
  const admin = await repo.findOne({ where: {} })
  return admin || null
}

function makeTicketNumber(year: number, seq: number): string {
  return `TKT-${year}-${String(seq).padStart(3, '0')}`
}

async function seedTickets(ctx: SeedContext, agents: SupportAgent[], departments: Department[]): Promise<SupportTicket[]> {
  const repo = ctx.ds.getRepository(SupportTicket)
  const count = await repo.count()
  const agent1 = agents[0] // First agent (yee@gmail.com)
  const agent2 = agents[1] // Second agent (web370@etics.us)
  
  if (count) {
    // Update existing tickets - assign most to agent1, about 3 to agent2
    const existingTickets = await repo.find()
    const ticketsForAgent2 = 3
    const shuffled = [...existingTickets].sort(() => Math.random() - 0.5) // Shuffle tickets
    
    for (let i = 0; i < shuffled.length; i++) {
      const ticket = shuffled[i]
      const randomDept = pick(departments)
      // Assign first 3 tickets to agent2, rest to agent1
      if (i < ticketsForAgent2) {
        ticket.assignedTo = agent2.id
        ticket.assignedToName = agent2.name
      } else {
        ticket.assignedTo = agent1.id
        ticket.assignedToName = agent1.name
      }
      ticket.department = randomDept.name
      // Mix up statuses for variety
      ticket.status = pick([TicketStatus.IN_PROGRESS, TicketStatus.OPEN, TicketStatus.RESOLVED, TicketStatus.ESCALATED, TicketStatus.CLOSED])
      
      // Update customer info to random outsider info if not already set
      if (!ticket.customerName || !ticket.customerPhone || !ticket.customerEmail) {
        const name = generateRandomName(i)
        ticket.customerId = null // Outsider, not in system
        ticket.customerName = name
        ticket.customerPhone = generateRandomPhone(i)
        ticket.customerEmail = generateRandomEmail(name, i)
      }
    }
    
    await repo.save(shuffled)
    
    // Update agent active tickets count
    agent1.activeTickets = shuffled.filter(tt => 
      tt.assignedTo === agent1.id && 
      (tt.status === TicketStatus.OPEN || tt.status === TicketStatus.IN_PROGRESS || tt.status === TicketStatus.ESCALATED)
    ).length
    agent2.activeTickets = shuffled.filter(tt => 
      tt.assignedTo === agent2.id && 
      (tt.status === TicketStatus.OPEN || tt.status === TicketStatus.IN_PROGRESS || tt.status === TicketStatus.ESCALATED)
    ).length
    await ctx.ds.getRepository(SupportAgent).save([agent1, agent2])
    
    return shuffled
  }
  
  const now = new Date()
  const year = now.getFullYear()
  const tickets: SupportTicket[] = []
  const ticketsForAgent2 = 3 // Assign 3 tickets to agent2
  
  // Create a mix of tickets with different departments from random outsiders
  for (let i = 1; i <= 20; i++) {
    // Pick a random department for each ticket
    const randomDept = pick(departments)
    // Mix up statuses
    const statusPool = [TicketStatus.IN_PROGRESS, TicketStatus.OPEN, TicketStatus.RESOLVED, TicketStatus.ESCALATED, TicketStatus.CLOSED]
    const status = pick(statusPool)
    
    // Assign first 3 tickets to agent2, rest to agent1
    const assignedAgent = i <= ticketsForAgent2 ? agent2 : agent1
    
    // Generate random customer info for outsiders (not in system)
    const customerName = generateRandomName(i)
    const customerPhone = generateRandomPhone(i)
    const customerEmail = generateRandomEmail(customerName, i)
    
    const t = Object.assign(new SupportTicket(), {
      ticketNumber: makeTicketNumber(year, i),
      customerId: null, // Outsider, not registered in system
      customerName: customerName,
      customerPhone: customerPhone,
      customerEmail: customerEmail,
      subject: `Issue ${i} - ${randomDept.name}`,
      description: `Description for issue ${i} related to ${randomDept.description}`,
      category: randomCategory(),
      priority: randomPriority(),
      status,
      assignedTo: assignedAgent.id,
      assignedToName: assignedAgent.name,
      department: randomDept.name, // Mix up departments
      escalatedTo: null,
      escalatedToName: null,
      resolution: null,
      resolvedAt: null,
      resolvedBy: null,
      lastMessageAt: null,
      messageCount: 0,
      tags: null,
    }) as SupportTicket
    
    if (t.status === TicketStatus.RESOLVED && !t.resolvedAt) {
      t.resolvedAt = new Date()
      t.resolvedBy = ctx.adminResolver?.id ?? null
      t.resolution = 'Issue resolved in seed'
    }
    tickets.push(t)
  }
  
  const created = await repo.save(tickets)
  
  // Update agent active tickets count
  agent1.activeTickets = created.filter(tt => 
    tt.assignedTo === agent1.id && 
    (tt.status === TicketStatus.OPEN || tt.status === TicketStatus.IN_PROGRESS || tt.status === TicketStatus.ESCALATED)
  ).length
  agent2.activeTickets = created.filter(tt => 
    tt.assignedTo === agent2.id && 
    (tt.status === TicketStatus.OPEN || tt.status === TicketStatus.IN_PROGRESS || tt.status === TicketStatus.ESCALATED)
  ).length
  await ctx.ds.getRepository(SupportAgent).save([agent1, agent2])
  
  return created
}

async function seedMessagesAndHistory(ctx: SeedContext, tickets: SupportTicket[]): Promise<void> {
  const msgRepo = ctx.ds.getRepository(ChatMessage)
  const histRepo = ctx.ds.getRepository(TicketHistory)
  // Use adminResolver ID for external users, or get first admin if resolver is null
  let systemUserId = ctx.adminResolver?.id || null
  if (!systemUserId) {
    const adminRepo = ctx.ds.getRepository(AdminUser)
    const firstAdmin = await adminRepo.findOne({ where: {} })
    if (firstAdmin) {
      systemUserId = firstAdmin.id
    }
  }
  
  // If still no system user found, we can't create history - skip it
  if (!systemUserId) {
    console.warn('Warning: No admin user found. Skipping ticket history creation.')
    return
  }
  
  for (const t of tickets) {
    // For ticket_created, use systemUserId since performedBy must be AdminUser UUID
    // (customerId is User UUID, not AdminUser UUID, so we use system to represent customer action)
    const createdHist = Object.assign(new TicketHistory(), { 
      ticketId: t.id, 
      action: 'ticket_created', 
      performedBy: systemUserId, 
      performedByName: t.customerName || 'External User' 
    })
    await histRepo.save(createdHist)
    
    if (t.assignedTo) {
      // For assignment, use systemUserId since assignedTo is agent ID (string), not AdminUser UUID
      const assignedHist = Object.assign(new TicketHistory(), { 
        ticketId: t.id, 
        action: 'ticket_assigned', 
        performedBy: systemUserId, 
        performedByName: t.assignedToName ?? 'Agent', 
        details: `Assigned to ${t.assignedToName}` 
      })
      await histRepo.save(assignedHist)
    }
    if (t.status === TicketStatus.ESCALATED) {
      const escalatedHist = Object.assign(new TicketHistory(), { 
        ticketId: t.id, 
        action: 'ticket_escalated', 
        performedBy: systemUserId, 
        performedByName: t.assignedToName ?? 'Agent', 
        details: 'Seed escalation' 
      })
      await histRepo.save(escalatedHist)
    }
    if (t.status === TicketStatus.RESOLVED && t.resolvedAt) {
      const resolvedHist = Object.assign(new TicketHistory(), { 
        ticketId: t.id, 
        action: 'ticket_resolved', 
        performedBy: t.resolvedBy || systemUserId, 
        performedByName: 'Agent', 
        details: t.resolution ?? 'Resolved' 
      })
      await histRepo.save(resolvedHist)
    }
    const m1 = Object.assign(new ChatMessage(), { 
      ticketId: t.id, 
      senderId: t.customerId || 'external', 
      senderName: t.customerName || 'External User', 
      senderType: MessageSenderType.CUSTOMER, 
      message: `Hello, I need help with ticket ${t.ticketNumber}`, 
      isRead: true 
    })
    await msgRepo.save(m1)
    const m2 = Object.assign(new ChatMessage(), { 
      ticketId: t.id, 
      senderId: t.assignedTo || 'agent', 
      senderName: t.assignedToName ?? 'Agent', 
      senderType: MessageSenderType.AGENT, 
      message: 'Acknowledged. We are looking into it.', 
      isRead: true 
    })
    await msgRepo.save(m2)
    await ctx.ds.getRepository(SupportTicket).update(t.id, { messageCount: 2, lastMessageAt: new Date() })
  }
}

async function runSeed(dsParam?: DataSource): Promise<void> {
  const ds = dsParam || dataSource
  if (!ds.isInitialized) await ds.initialize()
  const adminResolver = await findAdminResolver(ds)
  const ctx: SeedContext = { ds, adminResolver }
  const departments = await seedDepartments(ctx)
  const agents = await seedAgents(ctx, departments)
  const tickets = await seedTickets(ctx, agents, departments)
  await seedMessagesAndHistory(ctx, tickets)
  await ds.destroy()
}

if (require.main === module) {
  runSeed()
    .then(() => {
      process.exit(0)
    })
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
}

export { runSeed }
