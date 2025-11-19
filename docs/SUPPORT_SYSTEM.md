# Support System Documentation

## Overview

The Support System is a comprehensive ticket management solution designed to help track, manage, and resolve user support requests. It provides a structured workflow for handling customer inquiries through tickets, with real-time chat capabilities, agent assignment, escalation mechanisms, and complete audit trails.

## System Architecture

The support system is built around five core entities that work together to provide a complete support management solution:

1. **SupportTicket** - Core ticket entity tracking customer issues
2. **SupportAgent** - Support staff who handle tickets
3. **Department** - Organizational units for ticket categorization
4. **ChatMessage** - Real-time conversation messages
5. **TicketHistory** - Complete audit trail of ticket actions

---

## Core Entities

### 1. SupportTicket Entity

The `SupportTicket` entity is the central component of the support system. It represents a customer support request from creation to resolution.

#### Key Features:
- **Unique Ticket Numbering**: Each ticket has a unique identifier (e.g., `TKT-2024-001`)
- **Customer Information**: Stores customer ID, name, phone, and email
- **Categorization**: Tickets are categorized by type (technical, billing, account, loan, general, transaction)
- **Priority Levels**: Supports low, medium, high, and urgent priorities
- **Status Tracking**: Tracks ticket lifecycle (open → in-progress → resolved → closed)
- **Assignment System**: Tracks which agent/department is handling the ticket
- **Escalation Support**: Can escalate tickets to higher-tier agents or departments
- **Resolution Tracking**: Records who resolved the ticket and when
- **Message Count**: Tracks conversation activity
- **Tags**: Flexible tagging system for ticket organization

#### Ticket Status Flow:
```
OPEN → IN_PROGRESS → RESOLVED → CLOSED
         ↓
    ESCALATED (can return to IN_PROGRESS)
```

#### Ticket Categories:
- `TECHNICAL` - Technical issues and bugs
- `BILLING` - Payment and billing inquiries
- `ACCOUNT` - Account management issues
- `LOAN` - Loan-related questions
- `GENERAL` - General inquiries
- `TRANSACTION` - Transaction-specific issues

#### Priority Levels:
- `LOW` - Non-urgent issues
- `MEDIUM` - Standard priority
- `HIGH` - Important issues requiring attention
- `URGENT` - Critical issues requiring immediate response

#### Database Structure:
```typescript
- id: UUID (Primary Key)
- ticketNumber: string (Unique)
- customerId: UUID (Foreign Key to User)
- customerName: string
- customerPhone: string
- customerEmail: string
- subject: string
- description: text
- category: enum (TicketCategory)
- priority: enum (TicketPriority)
- status: enum (TicketStatus)
- assignedTo: string | null (Agent ID)
- assignedToName: string | null
- department: string | null
- escalatedTo: string | null
- escalatedToName: string | null
- resolution: text | null
- resolvedAt: timestamp | null
- resolvedBy: UUID | null (Foreign Key to AdminUser)
- lastMessageAt: timestamp | null
- messageCount: integer (default: 0)
- tags: string[] | null
- createdAt: timestamp
- updatedAt: timestamp
```

#### Indexes:
- `ticketNumber` (unique)
- `customerId`
- `status`
- `priority`
- `category`
- `assignedTo`
- `createdAt`

---

### 2. SupportAgent Entity

The `SupportAgent` entity represents support staff members who handle tickets. Agents are organized by departments and have tier levels for escalation purposes.

#### Key Features:
- **Department Assignment**: Each agent belongs to a specific department
- **Tier System**: Agents have tier levels (1, 2, 3) for escalation hierarchy
- **Status Tracking**: Real-time availability status (available, busy, away)
- **Workload Management**: Tracks active ticket count per agent
- **Unique Email**: Ensures no duplicate agent accounts

#### Agent Status:
- `AVAILABLE` - Agent is available to take new tickets
- `BUSY` - Agent is currently handling tickets (at capacity)
- `AWAY` - Agent is temporarily unavailable

#### Tier System:
- **Tier 1**: Entry-level support agents (handle general inquiries)
- **Tier 2**: Specialized agents (handle complex issues)
- **Tier 3**: Senior agents/managers (handle escalations and critical issues)

#### Database Structure:
```typescript
- id: UUID (Primary Key)
- name: string
- email: string (Unique)
- phone: string
- department: string
- tier: integer (1, 2, or 3)
- activeTickets: integer (default: 0)
- status: enum (AgentStatus)
```

#### Indexes:
- `email` (unique)
- `department`
- `status`

#### Agent Assignment Logic:
1. When a ticket is created, it can be automatically assigned to an available agent
2. Assignment considers:
   - Agent availability status
   - Current workload (activeTickets)
   - Department match
   - Tier level (for escalation)
3. When assigned, agent's `activeTickets` count increases
4. When ticket is resolved/closed, agent's `activeTickets` count decreases

---

### 3. Department Entity

The `Department` entity represents organizational units within the support system. Departments help categorize tickets and organize agents.

#### Key Features:
- **Department Organization**: Groups agents by functional area
- **Tier Assignment**: Each department has a tier level
- **Agent Count**: Tracks number of agents in each department

#### Database Structure:
```typescript
- id: UUID (Primary Key)
- name: string
- description: text
- tier: integer
- agentCount: integer (default: 0)
```

#### Common Departments:
- Technical Support
- Billing & Payments
- Account Management
- Loan Services
- General Support

---

### 4. ChatMessage Entity

The `ChatMessage` entity stores all conversation messages between customers and support agents. This enables real-time communication within tickets.

#### Key Features:
- **Real-time Messaging**: Supports instant message exchange
- **Sender Types**: Distinguishes between customer, agent, and system messages
- **Read Status**: Tracks message read/unread status
- **Attachments**: Supports file attachments (stored as JSONB)
- **Message Threading**: All messages linked to a specific ticket

#### Message Sender Types:
- `CUSTOMER` - Messages from the customer
- `AGENT` - Messages from support agents
- `SYSTEM` - Automated system messages (notifications, status updates)

#### Attachment Structure:
```typescript
{
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
}
```

#### Database Structure:
```typescript
- id: UUID (Primary Key)
- ticketId: UUID (Foreign Key to SupportTicket)
- senderId: string
- senderName: string
- senderType: enum (MessageSenderType)
- message: text
- attachments: JSONB | null
- isRead: boolean (default: false)
- createdAt: timestamp
```

#### Indexes:
- `ticketId`
- `senderId`
- `createdAt`

#### Message Flow:
1. Customer or agent sends a message
2. Message is saved to database
3. Ticket's `messageCount` is incremented
4. Ticket's `lastMessageAt` is updated
5. Message is broadcast via WebSocket to all connected clients
6. Recipients receive real-time notification

---

### 5. TicketHistory Entity

The `TicketHistory` entity provides a complete audit trail of all actions performed on a ticket. This ensures accountability and helps track ticket lifecycle.

#### Key Features:
- **Complete Audit Trail**: Records every action on a ticket
- **Action Tracking**: Logs actions like assignment, escalation, status changes, resolution
- **Performer Information**: Records who performed the action
- **Timestamp**: Precise timing of each action
- **Details**: Optional additional context for actions

#### Common Actions Logged:
- `ticket_created` - Ticket was created
- `ticket_assigned` - Ticket assigned to agent
- `ticket_escalated` - Ticket escalated to higher tier
- `status_changed` - Ticket status updated
- `priority_changed` - Ticket priority updated
- `ticket_resolved` - Ticket marked as resolved
- `ticket_closed` - Ticket closed
- `message_sent` - New message added
- `agent_reassigned` - Ticket reassigned to different agent

#### Database Structure:
```typescript
- id: UUID (Primary Key)
- ticketId: UUID (Foreign Key to SupportTicket)
- action: string
- performedBy: UUID (Foreign Key to AdminUser)
- performedByName: string
- details: text | null
- timestamp: timestamp (auto-generated)
```

#### Indexes:
- `ticketId`
- `performedBy`
- `timestamp`

#### History Tracking Example:
```
1. ticket_created - "Ticket created by customer"
2. ticket_assigned - "Assigned to John Doe (Technical Support)"
3. status_changed - "Status changed from OPEN to IN_PROGRESS"
4. message_sent - "Agent sent message: 'We're looking into this issue'"
5. ticket_escalated - "Escalated to Tier 2 agent (Jane Smith)"
6. ticket_resolved - "Resolved: Issue fixed in latest update"
7. ticket_closed - "Ticket closed by customer"
```

---

## Entity Relationships

### Relationship Diagram:

```
AdminUser (resolves tickets)
    ↓
SupportTicket ←→ ChatMessage (1-to-many)
    ↓
SupportAgent (assigned to tickets)
    ↓
Department (organizes agents)

TicketHistory → SupportTicket (many-to-one)
TicketHistory → AdminUser (many-to-one)
```

### Key Relationships:

1. **SupportTicket ↔ User**: Many-to-one (many tickets per customer)
2. **SupportTicket ↔ SupportAgent**: Many-to-one (many tickets per agent)
3. **SupportTicket ↔ ChatMessage**: One-to-many (many messages per ticket)
4. **SupportTicket ↔ TicketHistory**: One-to-many (many history entries per ticket)
5. **SupportTicket ↔ AdminUser**: Many-to-one (resolved by admin)
6. **TicketHistory ↔ AdminUser**: Many-to-one (actions performed by admin)
7. **SupportAgent ↔ Department**: Many-to-one (many agents per department)

---

## Support System Workflow

### 1. Ticket Creation Flow

```
Customer creates ticket
    ↓
System generates unique ticket number
    ↓
Ticket saved with status: OPEN
    ↓
TicketHistory entry: "ticket_created"
    ↓
Optional: Auto-assign to available agent
    ↓
Notification sent to customer
```

### 2. Ticket Assignment Flow

```
Admin/System selects ticket
    ↓
Selects available agent (based on department, tier, workload)
    ↓
Update ticket: assignedTo, assignedToName, status → IN_PROGRESS
    ↓
Increment agent.activeTickets
    ↓
TicketHistory entry: "ticket_assigned"
    ↓
Notification sent to agent
```

### 3. Message Exchange Flow

```
Agent/Customer sends message
    ↓
ChatMessage saved to database
    ↓
Update ticket: messageCount++, lastMessageAt
    ↓
WebSocket broadcast to all connected clients
    ↓
Real-time update in UI
    ↓
TicketHistory entry: "message_sent" (optional)
```

### 4. Ticket Escalation Flow

```
Agent determines ticket needs escalation
    ↓
Select higher-tier agent or department
    ↓
Update ticket: escalatedTo, escalatedToName, status → ESCALATED
    ↓
Decrement original agent.activeTickets
    ↓
Increment new agent.activeTickets
    ↓
TicketHistory entry: "ticket_escalated"
    ↓
Notification sent to new agent
```

### 5. Ticket Resolution Flow

```
Agent resolves issue
    ↓
Update ticket: status → RESOLVED, resolution, resolvedAt, resolvedBy
    ↓
Decrement agent.activeTickets
    ↓
TicketHistory entry: "ticket_resolved"
    ↓
Notification sent to customer
    ↓
Customer confirms resolution
    ↓
Update ticket: status → CLOSED
    ↓
TicketHistory entry: "ticket_closed"
```

---

## Admin Management System Implementation

### Support Dashboard Features

The admin support page provides comprehensive ticket management capabilities:

#### 1. Ticket List View
- **Filtering**: By status, priority, category, assigned agent, department, date range
- **Sorting**: By date, priority, status, last message
- **Search**: By ticket number, customer name, subject
- **Bulk Operations**: Assign, resolve, update status, notify multiple tickets
- **Real-time Updates**: WebSocket updates for new tickets and status changes

#### 2. Ticket Detail View
- **Ticket Information**: Complete ticket details, customer info, assignment
- **Chat Interface**: Real-time conversation with customer
- **Ticket History**: Complete audit trail of all actions
- **Quick Actions**: Assign, escalate, resolve, close, update status/priority
- **Attachments**: View and manage file attachments

#### 3. Agent Management
- **Agent List**: View all support agents with status and workload
- **Agent Details**: View agent's active tickets, performance metrics
- **Status Management**: Update agent availability status
- **Workload Monitoring**: Track active tickets per agent

#### 4. Department Management
- **Department List**: View all departments
- **Department Details**: View agents, ticket distribution
- **Tier Management**: Configure department tiers

#### 5. Statistics & Analytics
- **Ticket Stats**: Open, in-progress, resolved, closed counts
- **Agent Performance**: Tickets handled, average resolution time
- **Department Metrics**: Ticket distribution, resolution rates
- **Response Times**: Average time to first response, resolution time

---

## WebSocket Implementation

### Real-time Features

The support system uses WebSockets to provide real-time updates for:

1. **New Messages**: Instant message delivery in chat interface
2. **Ticket Updates**: Status changes, assignments, escalations
3. **Agent Status**: Real-time agent availability updates
4. **New Tickets**: Instant notification of new ticket creation
5. **Typing Indicators**: Show when agent/customer is typing
6. **Read Receipts**: Real-time read status updates

### WebSocket Gateway Structure

```typescript
@WebSocketGateway({
  namespace: '/support',
  cors: { origin: '*' }
})
export class SupportGateway {
  // Handle client connections
  // Broadcast ticket updates
  // Broadcast new messages
  // Handle typing indicators
  // Manage room subscriptions
}
```

### WebSocket Events

#### Client → Server Events:
- `join_ticket_room` - Join a ticket's chat room
- `leave_ticket_room` - Leave a ticket's chat room
- `send_message` - Send a chat message
- `typing_start` - User started typing
- `typing_stop` - User stopped typing
- `mark_read` - Mark messages as read
- `subscribe_tickets` - Subscribe to ticket list updates

#### Server → Client Events:
- `new_message` - New message received
- `ticket_updated` - Ticket status/details changed
- `ticket_assigned` - Ticket assigned to agent
- `ticket_escalated` - Ticket escalated
- `agent_status_changed` - Agent availability changed
- `new_ticket` - New ticket created
- `typing_indicator` - Someone is typing
- `message_read` - Message read status updated

### WebSocket Room Management

Each ticket has its own WebSocket room:
- Room name: `ticket:{ticketId}`
- Participants: Assigned agent, customer, admins viewing ticket
- Broadcasts: All messages and updates sent to room participants

### Implementation Flow

#### Message Sending:
```
1. Client sends message via HTTP POST /support/tickets/:id/messages
2. Server saves message to database
3. Server updates ticket (messageCount, lastMessageAt)
4. Server broadcasts message via WebSocket to ticket room
5. All connected clients receive real-time update
```

#### Ticket Updates:
```
1. Admin performs action (assign, escalate, resolve)
2. Server updates ticket in database
3. Server creates TicketHistory entry
4. Server broadcasts update via WebSocket
5. All subscribed clients receive update
```

---

## API Endpoints

### Ticket Management
- `GET /support/tickets` - List tickets (with filters)
- `POST /support/tickets` - Create new ticket
- `GET /support/tickets/:id` - Get ticket details
- `PATCH /support/tickets/:id` - Update ticket
- `GET /support/tickets/stats` - Get ticket statistics

### Ticket Actions
- `POST /support/tickets/assign` - Assign ticket to agent
- `POST /support/tickets/escalate` - Escalate ticket
- `GET /support/tickets/:id/history` - Get ticket history
- `POST /support/tickets/:id/notify` - Send notification

### Bulk Operations
- `POST /support/tickets/bulk/assign` - Bulk assign tickets
- `POST /support/tickets/bulk/resolve` - Bulk resolve tickets
- `POST /support/tickets/bulk/status` - Bulk update status
- `POST /support/tickets/bulk/notify` - Bulk notify
- `POST /support/tickets/bulk/escalate` - Bulk escalate

### Messaging
- `GET /support/tickets/:id/messages` - Get ticket messages
- `POST /support/tickets/:id/messages` - Send message

### Agent Management
- `GET /support/agents` - List all agents

### Department Management
- `GET /support/departments` - List all departments

---

## Security Considerations

### Authentication & Authorization
- All endpoints protected by JWT authentication
- Role-based access control for admin operations
- Agents can only access assigned tickets
- Admins have full access

### Data Privacy
- Customer information encrypted at rest
- Secure WebSocket connections (WSS)
- Message content sanitized
- Attachment uploads validated

### Audit Trail
- All actions logged in TicketHistory
- Performer information tracked
- Timestamps for all operations
- Immutable history records

---

## Best Practices

### Ticket Management
1. **Quick Response**: Assign tickets within 15 minutes of creation
2. **Clear Communication**: Use clear, professional language in messages
3. **Regular Updates**: Keep customers informed of progress
4. **Proper Escalation**: Escalate complex issues promptly
5. **Complete Resolution**: Ensure issues are fully resolved before closing

### Agent Management
1. **Workload Balance**: Distribute tickets evenly across agents
2. **Status Updates**: Keep agent status current
3. **Capacity Management**: Don't overload agents (monitor activeTickets)
4. **Department Matching**: Assign tickets to appropriate departments

### Performance Optimization
1. **Indexing**: All foreign keys and frequently queried fields indexed
2. **Pagination**: Use pagination for ticket lists
3. **Caching**: Cache agent and department lists
4. **WebSocket Efficiency**: Only broadcast to relevant rooms

---

## Future Enhancements

### Potential Features
1. **AI-Powered Routing**: Automatic ticket assignment based on content
2. **Sentiment Analysis**: Analyze customer sentiment in messages
3. **Knowledge Base Integration**: Suggest solutions from knowledge base
4. **SLA Tracking**: Track response and resolution times against SLAs
5. **Customer Satisfaction Surveys**: Post-resolution feedback
6. **Multi-language Support**: Support for multiple languages
7. **Video/Audio Calls**: Integrated calling capabilities
8. **Advanced Analytics**: Predictive analytics and reporting
9. **Mobile App**: Native mobile support for agents
10. **Integration APIs**: Connect with external systems (CRM, etc.)

---

## Conclusion

The Support System provides a comprehensive, scalable solution for managing customer support tickets. With real-time chat capabilities, complete audit trails, flexible agent management, and robust escalation mechanisms, it enables efficient and effective customer support operations.

The system is designed to scale with your organization, supporting multiple departments, tiered escalation, and high-volume ticket processing while maintaining data integrity and providing excellent user experience through real-time updates.

