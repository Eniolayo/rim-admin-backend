# RIM Database Schema

This document defines all entities and their relationships based on the frontend implementation of the RIM Admin application.

## Table of Contents

1. [Core Entities](#core-entities)
2. [Loan Management](#loan-management)
3. [Transaction Management](#transaction-management)
4. [Support System](#support-system)
5. [Admin Management](#admin-management)
6. [Notifications](#notifications)
7. [System Configuration](#system-configuration)
8. [Relationships Summary](#relationships-summary)
9. [Key Business Rules](#key-business-rules)

---

## Core Entities

### User

Represents a customer/mobile app user in the system.

**Fields:**
- `id` (string, UUID) - Primary key
- `userId` (string, unique) - Business identifier (e.g., "USR-2024-001")
- `phone` (string) - Phone number
- `email` (string) - Email address
- `creditScore` (number) - User's credit score
- `repaymentStatus` (enum) - "Partial" | "Completed" | "Overdue" | "Pending"
- `totalRepaid` (number) - Total amount repaid across all loans
- `status` (enum) - "active" | "inactive" | "suspended"
- `creditLimit` (number) - Maximum credit limit
- `autoLimitEnabled` (boolean) - Whether automatic limit adjustment is enabled
- `totalLoans` (number, optional) - Count of total loans (computed/denormalized)
- `createdAt` (datetime)
- `updatedAt` (datetime)

**Indexes:**
- `userId` (unique)
- `phone` (indexed for lookups)
- `email` (indexed for lookups)
- `status` (indexed for filtering)

---

## Loan Management

### Loan

Represents a loan application and its lifecycle.

**Fields:**
- `id` (string, UUID) - Primary key
- `loanId` (string, unique) - Business identifier (e.g., "LOAN-2024-001")
- `userId` (string, FK) - Reference to User.id
- `userPhone` (string) - Denormalized from User for quick access
- `userEmail` (string, optional) - Denormalized from User
- `amount` (number) - Loan amount
- `status` (enum) - "pending" | "approved" | "rejected" | "disbursed" | "repaying" | "completed" | "defaulted"
- `network` (enum) - "MTN" | "Airtel" | "Glo" | "9mobile"
- `interestRate` (number) - Interest rate percentage
- `repaymentPeriod` (number) - Repayment period in days
- `dueDate` (datetime) - Loan due date
- `amountDue` (number) - Total amount due (principal + interest)
- `amountPaid` (number) - Amount paid so far
- `outstandingAmount` (number) - Remaining amount to be paid
- `approvedAt` (datetime, optional) - Approval timestamp
- `approvedBy` (string, optional, FK) - Reference to AdminUser.id
- `rejectedAt` (datetime, optional) - Rejection timestamp
- `rejectedBy` (string, optional, FK) - Reference to AdminUser.id
- `rejectionReason` (string, optional) - Reason for rejection
- `disbursedAt` (datetime, optional) - Disbursement timestamp
- `completedAt` (datetime, optional) - Completion timestamp
- `defaultedAt` (datetime, optional) - Default timestamp
- `telcoReference` (string, optional) - Reference from telco API
- `metadata` (json, optional) - Additional metadata:
  - `creditScore` (number, optional)
  - `previousLoans` (number, optional)
  - `autoApproved` (boolean, optional)
  - Other dynamic fields
- `createdAt` (datetime)
- `updatedAt` (datetime)

**Indexes:**
- `loanId` (unique)
- `userId` (indexed for user loan queries)
- `status` (indexed for filtering)
- `network` (indexed for filtering)
- `dueDate` (indexed for overdue queries)
- `createdAt` (indexed for date range queries)

**Relationships:**
- Many-to-One: `User` (userId → User.id)
- Many-to-One: `AdminUser` (approvedBy → AdminUser.id, optional)
- Many-to-One: `AdminUser` (rejectedBy → AdminUser.id, optional)

---

## Transaction Management

### Transaction

Represents financial transactions (airtime purchases, loan repayments).

**Fields:**
- `id` (string, UUID) - Primary key
- `transactionId` (string, unique) - Business identifier
- `userId` (string, FK) - Reference to User.id
- `userPhone` (string) - Denormalized from User
- `userEmail` (string, optional) - Denormalized from User
- `type` (enum) - "airtime" | "repayment"
- `amount` (number) - Transaction amount
- `status` (enum) - "completed" | "pending" | "failed" | "refunded"
- `paymentMethod` (enum, optional) - "bank_transfer" | "card" | "wallet" | "cash"
- `description` (string, optional) - Transaction description
- `reference` (string, optional) - External reference number
- `provider` (string, optional) - Payment provider name
- `network` (string, optional) - "MTN" | "Airtel" | "Glo" | "9mobile"
- `reconciledAt` (datetime, optional) - Reconciliation timestamp
- `reconciledBy` (string, optional, FK) - Reference to AdminUser.id
- `notes` (string, optional) - Admin notes
- `metadata` (json, optional) - Additional metadata:
  - `originalAmount` (number, optional)
  - `fee` (number, optional)
  - `commission` (number, optional)
  - Other dynamic fields
- `createdAt` (datetime)
- `updatedAt` (datetime)

**Indexes:**
- `transactionId` (unique)
- `userId` (indexed for user transaction queries)
- `type` (indexed for filtering)
- `status` (indexed for filtering)
- `createdAt` (indexed for date range queries)
- `reference` (indexed for lookups)

**Relationships:**
- Many-to-One: `User` (userId → User.id)
- Many-to-One: `AdminUser` (reconciledBy → AdminUser.id, optional)

**Note:** Transactions of type "repayment" are logically related to Loans, but this relationship may be implicit through the userId and timestamps rather than a direct foreign key.

---

## Support System

### Ticket

Represents a customer support ticket.

**Fields:**
- `id` (string, UUID) - Primary key
- `ticketNumber` (string, unique) - Business identifier
- `customerId` (string, FK) - Reference to User.id
- `customerName` (string) - Denormalized from User
- `customerPhone` (string) - Denormalized from User
- `customerEmail` (string) - Denormalized from User
- `subject` (string) - Ticket subject
- `description` (string) - Ticket description
- `category` (enum) - "technical" | "billing" | "account" | "loan" | "general" | "transaction"
- `priority` (enum) - "low" | "medium" | "high" | "urgent"
- `status` (enum) - "open" | "in-progress" | "resolved" | "closed" | "escalated"
- `assignedTo` (string, optional, FK) - Reference to AdminUser.id or SupportAgent.id
- `assignedToName` (string, optional) - Denormalized agent name
- `department` (string, optional) - Department identifier
- `escalatedTo` (string, optional, FK) - Reference to AdminUser.id or SupportAgent.id
- `escalatedToName` (string, optional) - Denormalized escalated agent name
- `resolution` (string, optional) - Resolution notes
- `resolvedAt` (datetime, optional) - Resolution timestamp
- `resolvedBy` (string, optional, FK) - Reference to AdminUser.id
- `lastMessageAt` (datetime, optional) - Last message timestamp
- `messageCount` (number) - Count of messages (computed/denormalized)
- `tags` (string[], optional) - Array of tags
- `createdAt` (datetime)
- `updatedAt` (datetime)

**Indexes:**
- `ticketNumber` (unique)
- `customerId` (indexed for user ticket queries)
- `status` (indexed for filtering)
- `priority` (indexed for filtering)
- `category` (indexed for filtering)
- `assignedTo` (indexed for agent queries)
- `createdAt` (indexed for date range queries)

**Relationships:**
- Many-to-One: `User` (customerId → User.id)
- Many-to-One: `AdminUser` or `SupportAgent` (assignedTo, optional)
- Many-to-One: `AdminUser` or `SupportAgent` (escalatedTo, optional)
- Many-to-One: `AdminUser` (resolvedBy, optional)
- One-to-Many: `ChatMessage` (Ticket.id → ChatMessage.ticketId)
- One-to-Many: `TicketHistory` (Ticket.id → TicketHistory.ticketId)

### ChatMessage

Represents a message in a support ticket conversation.

**Fields:**
- `id` (string, UUID) - Primary key
- `ticketId` (string, FK) - Reference to Ticket.id
- `senderId` (string) - Sender identifier (can be User.id, AdminUser.id, or system)
- `senderName` (string) - Denormalized sender name
- `senderType` (enum) - "customer" | "agent" | "system"
- `message` (string) - Message content
- `attachments` (json, optional) - Array of Attachment objects (embedded or referenced)
- `isRead` (boolean) - Read status
- `createdAt` (datetime)

**Indexes:**
- `ticketId` (indexed for ticket message queries)
- `senderId` (indexed for sender queries)
- `createdAt` (indexed for chronological ordering)

**Relationships:**
- Many-to-One: `Ticket` (ticketId → Ticket.id)

### Attachment

Represents a file attachment in a chat message.

**Fields:**
- `id` (string, UUID) - Primary key
- `name` (string) - File name
- `url` (string) - File URL/path
- `size` (number) - File size in bytes
- `type` (string) - MIME type
- `messageId` (string, optional, FK) - Reference to ChatMessage.id (if stored separately)

**Note:** Attachments may be embedded in ChatMessage as JSON or stored as a separate entity with a foreign key relationship.

**Relationships:**
- Many-to-One: `ChatMessage` (messageId → ChatMessage.id, optional)

### TicketHistory

Represents audit trail of ticket actions.

**Fields:**
- `id` (string, UUID) - Primary key
- `ticketId` (string, FK) - Reference to Ticket.id
- `action` (string) - Action performed
- `performedBy` (string, FK) - Reference to AdminUser.id
- `performedByName` (string) - Denormalized performer name
- `details` (string, optional) - Action details
- `timestamp` (datetime) - Action timestamp

**Indexes:**
- `ticketId` (indexed for ticket history queries)
- `performedBy` (indexed for user action queries)
- `timestamp` (indexed for chronological ordering)

**Relationships:**
- Many-to-One: `Ticket` (ticketId → Ticket.id)
- Many-to-One: `AdminUser` (performedBy → AdminUser.id)

### SupportAgent

Represents a support agent (may be a subtype of AdminUser or separate entity).

**Fields:**
- `id` (string, UUID) - Primary key
- `name` (string) - Agent name
- `email` (string) - Agent email
- `phone` (string) - Agent phone
- `department` (string) - Department identifier
- `tier` (number) - Support tier (1, 2, or 3)
- `activeTickets` (number) - Count of active tickets (computed/denormalized)
- `status` (enum) - "available" | "busy" | "away"

**Indexes:**
- `email` (unique, indexed)
- `department` (indexed for filtering)
- `status` (indexed for filtering)

**Relationships:**
- Many-to-One: `Department` (department → Department.id, if Department is a separate entity)

### Department

Represents a support department.

**Fields:**
- `id` (string, UUID) - Primary key
- `name` (string) - Department name
- `description` (string) - Department description
- `tier` (number) - Support tier level
- `agentCount` (number) - Count of agents (computed/denormalized)

**Relationships:**
- One-to-Many: `SupportAgent` (Department.id → SupportAgent.department)

---

## Admin Management

### AdminUser

Represents an admin user of the admin panel.

**Fields:**
- `id` (string, UUID) - Primary key
- `username` (string, unique) - Username
- `email` (string, unique) - Email address
- `role` (string) - Role name (denormalized from AdminRole)
- `roleId` (string, FK) - Reference to AdminRole.id
- `status` (enum) - "active" | "inactive" | "suspended"
- `lastLogin` (datetime, optional) - Last login timestamp
- `twoFactorEnabled` (boolean) - 2FA enabled status
- `createdAt` (datetime)
- `createdBy` (string, optional, FK) - Reference to AdminUser.id (self-referential)

**Indexes:**
- `username` (unique)
- `email` (unique)
- `roleId` (indexed for role queries)
- `status` (indexed for filtering)

**Relationships:**
- Many-to-One: `AdminRole` (roleId → AdminRole.id)
- Many-to-One: `AdminUser` (createdBy → AdminUser.id, optional, self-referential)
- One-to-Many: `Loan` (AdminUser.id → Loan.approvedBy, optional)
- One-to-Many: `Loan` (AdminUser.id → Loan.rejectedBy, optional)
- One-to-Many: `Transaction` (AdminUser.id → Transaction.reconciledBy, optional)
- One-to-Many: `AdminActivityLog` (AdminUser.id → AdminActivityLog.adminId)
- One-to-Many: `AuditLog` (AdminUser.id → AuditLog.userId)
- One-to-Many: `BroadcastMessage` (AdminUser.id → BroadcastMessage.createdBy)
- One-to-Many: `TicketHistory` (AdminUser.id → TicketHistory.performedBy)

### AdminRole

Represents an admin role with permissions.

**Fields:**
- `id` (string, UUID) - Primary key
- `name` (string, unique) - Role name
- `description` (string) - Role description
- `permissions` (json) - Array of Permission objects:
  - `resource` (string) - Resource name
  - `actions` (string[]) - Array of actions: "read" | "write" | "delete"
- `userCount` (number) - Count of users with this role (computed/denormalized)
- `createdAt` (datetime)
- `updatedAt` (datetime)

**Indexes:**
- `name` (unique)

**Relationships:**
- One-to-Many: `AdminUser` (AdminRole.id → AdminUser.roleId)

### Permission

Embedded in AdminRole as JSON. Not a separate entity.

**Structure:**
- `resource` (string) - Resource identifier
- `actions` (string[]) - Array of: "read" | "write" | "delete"

### AdminActivityLog

Represents admin user activity logs.

**Fields:**
- `id` (string, UUID) - Primary key
- `adminId` (string, FK) - Reference to AdminUser.id
- `adminName` (string) - Denormalized admin name
- `action` (string) - Action performed
- `resource` (string) - Resource affected
- `resourceId` (string, optional) - Resource identifier
- `details` (json, optional) - Additional details
- `ipAddress` (string, optional) - IP address
- `timestamp` (datetime) - Action timestamp

**Indexes:**
- `adminId` (indexed for admin activity queries)
- `resource` (indexed for resource queries)
- `timestamp` (indexed for date range queries)

**Relationships:**
- Many-to-One: `AdminUser` (adminId → AdminUser.id)

---

## Notifications

### SystemAlert

Represents a system alert configuration.

**Fields:**
- `id` (string, UUID) - Primary key
- `name` (string) - Alert name
- `type` (enum) - "overdue_loans" | "api_failure" | "payment_gateway" | "user_issue" | "system_error"
- `enabled` (boolean) - Whether alert is enabled
- `threshold` (number) - Alert threshold value
- `channel` (string[]) - Array of: "email" | "sms" | "dashboard"
- `recipients` (string[]) - Array of admin user IDs or role identifiers
- `lastTriggered` (datetime, optional) - Last trigger timestamp
- `triggerCount` (number) - Count of times triggered
- `createdAt` (datetime)
- `updatedAt` (datetime)

**Indexes:**
- `type` (indexed for filtering)
- `enabled` (indexed for active alert queries)

### BroadcastMessage

Represents a broadcast message sent to users.

**Fields:**
- `id` (string, UUID) - Primary key
- `title` (string) - Message title
- `message` (string) - Message content
- `type` (enum) - "sms" | "email" | "both"
- `targetAudience` (enum) - "all" | "active_users" | "inactive_users" | "overdue_users" | "custom"
- `customUserIds` (string[], optional) - Array of User.id for custom audience
- `scheduledFor` (datetime, optional) - Scheduled send time
- `status` (enum) - "draft" | "scheduled" | "sent" | "failed"
- `sentAt` (datetime, optional) - Sent timestamp
- `sentCount` (number, optional) - Count of successful sends
- `failedCount` (number, optional) - Count of failed sends
- `createdAt` (datetime)
- `createdBy` (string, FK) - Reference to AdminUser.id

**Indexes:**
- `status` (indexed for filtering)
- `targetAudience` (indexed for filtering)
- `createdBy` (indexed for creator queries)
- `scheduledFor` (indexed for scheduled message queries)

**Relationships:**
- Many-to-One: `AdminUser` (createdBy → AdminUser.id)

### NotificationHistory

Represents a record of sent notifications.

**Fields:**
- `id` (string, UUID) - Primary key
- `type` (enum) - "alert" | "broadcast" | "scheduled"
- `title` (string) - Notification title
- `message` (string) - Notification message
- `channel` (enum) - "email" | "sms" | "dashboard"
- `recipient` (string) - Recipient identifier (User.id or AdminUser.id)
- `recipientType` (enum) - "user" | "admin"
- `status` (enum) - "sent" | "delivered" | "failed" | "pending"
- `sentAt` (datetime) - Sent timestamp
- `deliveredAt` (datetime, optional) - Delivery timestamp
- `errorMessage` (string, optional) - Error message if failed
- `metadata` (json, optional) - Additional metadata

**Indexes:**
- `recipient` (indexed for recipient queries)
- `recipientType` (indexed for filtering)
- `status` (indexed for filtering)
- `channel` (indexed for filtering)
- `sentAt` (indexed for date range queries)

**Relationships:**
- Many-to-One: `User` (recipient → User.id, when recipientType = "user")
- Many-to-One: `AdminUser` (recipient → AdminUser.id, when recipientType = "admin")

---

## System Configuration

### ApiIntegration

Represents an API integration configuration.

**Fields:**
- `id` (string, UUID) - Primary key
- `name` (string) - Integration name
- `type` (enum) - "telecom" | "payment_gateway" | "sms" | "email"
- `provider` (string) - Provider name
- `status` (enum) - "active" | "inactive" | "error"
- `apiKey` (string, optional, encrypted) - API key
- `apiSecret` (string, optional, encrypted) - API secret
- `baseUrl` (string) - Base URL
- `lastTested` (datetime, optional) - Last test timestamp
- `lastTestResult` (enum, optional) - "success" | "failed"
- `config` (json) - Additional configuration
- `createdAt` (datetime)
- `updatedAt` (datetime)

**Indexes:**
- `type` (indexed for filtering)
- `status` (indexed for filtering)
- `provider` (indexed for filtering)

### SystemConfig

Represents a system configuration key-value pair.

**Fields:**
- `id` (string, UUID) - Primary key
- `category` (string) - Configuration category
- `key` (string) - Configuration key
- `value` (string | number | boolean) - Configuration value
- `description` (string) - Configuration description
- `dataType` (enum) - "string" | "number" | "boolean" | "json"
- `updatedAt` (datetime)
- `updatedBy` (string, optional, FK) - Reference to AdminUser.id

**Indexes:**
- `category` (indexed for filtering)
- `key` (indexed, unique within category)

**Relationships:**
- Many-to-One: `AdminUser` (updatedBy → AdminUser.id, optional)

### AuditLog

Represents system audit logs.

**Fields:**
- `id` (string, UUID) - Primary key
- `action` (string) - Action performed
- `entity` (string) - Entity type
- `entityId` (string) - Entity identifier
- `userId` (string, FK) - Reference to AdminUser.id
- `userName` (string) - Denormalized user name
- `userRole` (string) - Denormalized user role
- `changes` (json, optional) - Object with old and new values:
  - `[field]`: { `old`: value, `new`: value }
- `ipAddress` (string, optional) - IP address
- `userAgent` (string, optional) - User agent string
- `timestamp` (datetime) - Action timestamp

**Indexes:**
- `userId` (indexed for user audit queries)
- `entity` (indexed for entity queries)
- `entityId` (indexed for specific entity queries)
- `timestamp` (indexed for date range queries)
- `action` (indexed for action queries)

**Relationships:**
- Many-to-One: `AdminUser` (userId → AdminUser.id)

### EmailTemplate

Represents an email template.

**Fields:**
- `id` (string, UUID) - Primary key
- `name` (string, unique) - Template name
- `subject` (string) - Email subject
- `body` (string) - Email body (HTML/text)
- `variables` (string[]) - Array of available template variables
- `type` (enum) - "transactional" | "marketing" | "notification"
- `enabled` (boolean) - Whether template is enabled
- `updatedAt` (datetime)

**Indexes:**
- `name` (unique)
- `type` (indexed for filtering)
- `enabled` (indexed for active template queries)

### SmsTemplate

Represents an SMS template.

**Fields:**
- `id` (string, UUID) - Primary key
- `name` (string, unique) - Template name
- `message` (string) - SMS message (max 160 characters)
- `variables` (string[]) - Array of available template variables
- `enabled` (boolean) - Whether template is enabled
- `updatedAt` (datetime)

**Indexes:**
- `name` (unique)
- `enabled` (indexed for active template queries)

### SecuritySettings

Represents security configuration (likely a singleton or single-row table).

**Fields:**
- `id` (string, UUID) - Primary key (or use a single row with fixed ID)
- `passwordMinLength` (number) - Minimum password length
- `passwordRequireUppercase` (boolean) - Require uppercase letters
- `passwordRequireLowercase` (boolean) - Require lowercase letters
- `passwordRequireNumbers` (boolean) - Require numbers
- `passwordRequireSpecialChars` (boolean) - Require special characters
- `sessionTimeout` (number) - Session timeout in minutes
- `maxLoginAttempts` (number) - Maximum login attempts before lockout
- `lockoutDuration` (number) - Lockout duration in minutes
- `twoFactorRequired` (boolean) - Require 2FA
- `twoFactorMethod` (enum) - "sms" | "email" | "app"
- `ipWhitelist` (string[]) - Array of whitelisted IP addresses
- `ipBlacklist` (string[]) - Array of blacklisted IP addresses
- `updatedAt` (datetime)

**Note:** This may be implemented as a single-row table or a JSON configuration in SystemConfig.

### Backup

Represents a system backup record.

**Fields:**
- `id` (string, UUID) - Primary key
- `name` (string) - Backup name
- `type` (enum) - "full" | "incremental"
- `size` (number) - Backup size in bytes
- `status` (enum) - "success" | "failed" | "in_progress"
- `createdAt` (datetime) - Backup start timestamp
- `completedAt` (datetime, optional) - Backup completion timestamp
- `retentionDays` (number) - Retention period in days
- `downloadUrl` (string, optional) - Download URL

**Indexes:**
- `status` (indexed for filtering)
- `createdAt` (indexed for date range queries)

### BackupSettings

Represents backup configuration (likely a singleton).

**Fields:**
- `id` (string, UUID) - Primary key (or use a single row with fixed ID)
- `enabled` (boolean) - Whether backups are enabled
- `frequency` (enum) - "daily" | "weekly" | "monthly"
- `time` (string) - Backup time (HH:mm format)
- `retentionDays` (number) - Retention period in days
- `backupType` (enum) - "full" | "incremental"
- `storageLocation` (enum) - "local" | "cloud"
- `cloudProvider` (string, optional) - Cloud provider name
- `lastBackup` (datetime, optional) - Last backup timestamp
- `nextBackup` (datetime, optional) - Next scheduled backup timestamp
- `updatedAt` (datetime)

**Note:** This may be implemented as a single-row table or a JSON configuration in SystemConfig.

---

## Relationships Summary

### Entity Relationship Diagram (Text Representation)

```
User (1) ──< (*) Loan
User (1) ──< (*) Transaction
User (1) ──< (*) Ticket
User (1) ──< (*) NotificationHistory (when recipientType = "user")

Loan (*) ──> (1) User
Loan (*) ──> (1) AdminUser (approvedBy, optional)
Loan (*) ──> (1) AdminUser (rejectedBy, optional)

Transaction (*) ──> (1) User
Transaction (*) ──> (1) AdminUser (reconciledBy, optional)

Ticket (1) ──< (*) ChatMessage
Ticket (1) ──< (*) TicketHistory
Ticket (*) ──> (1) User (customerId)
Ticket (*) ──> (1) AdminUser/SupportAgent (assignedTo, optional)
Ticket (*) ──> (1) AdminUser/SupportAgent (escalatedTo, optional)
Ticket (*) ──> (1) AdminUser (resolvedBy, optional)

ChatMessage (*) ──> (1) Ticket
ChatMessage (1) ──< (*) Attachment (if stored separately)

TicketHistory (*) ──> (1) Ticket
TicketHistory (*) ──> (1) AdminUser

SupportAgent (*) ──> (1) Department

AdminUser (*) ──> (1) AdminRole
AdminUser (1) ──< (*) AdminUser (createdBy, self-referential)
AdminUser (1) ──< (*) Loan (approvedBy, rejectedBy)
AdminUser (1) ──< (*) Transaction (reconciledBy)
AdminUser (1) ──< (*) AdminActivityLog
AdminUser (1) ──< (*) AuditLog
AdminUser (1) ──< (*) BroadcastMessage (createdBy)
AdminUser (1) ──< (*) TicketHistory (performedBy)
AdminUser (1) ──< (*) NotificationHistory (when recipientType = "admin")

AdminRole (1) ──< (*) AdminUser

BroadcastMessage (*) ──> (1) AdminUser

SystemConfig (*) ──> (1) AdminUser (updatedBy, optional)
```

### Relationship Details

1. **User → Loans**: One user can have many loans
2. **User → Transactions**: One user can have many transactions
3. **User → Tickets**: One user can have many support tickets
4. **Loan → User**: Each loan belongs to one user
5. **Loan → AdminUser**: Loans can be approved/rejected by admins
6. **Transaction → User**: Each transaction belongs to one user
7. **Transaction → AdminUser**: Transactions can be reconciled by admins
8. **Ticket → User**: Each ticket belongs to one customer (user)
9. **Ticket → ChatMessage**: One ticket can have many messages
10. **Ticket → TicketHistory**: One ticket can have many history entries
11. **Ticket → AdminUser/SupportAgent**: Tickets can be assigned/escalated to agents
12. **AdminUser → AdminRole**: Each admin user has one role
13. **AdminUser → AdminUser**: Self-referential for createdBy relationship
14. **BroadcastMessage → AdminUser**: Each broadcast is created by one admin
15. **NotificationHistory → User/AdminUser**: Notifications can be sent to users or admins

---

## Key Business Rules

### User Management
- Users have a credit limit that can be manually set or auto-adjusted
- User status affects loan eligibility
- Credit score influences loan approval decisions

### Loan Management
- Loans go through status transitions: pending → approved → disbursed → repaying → completed/defaulted
- Loans can be rejected at the pending stage
- Loan approval/disbursement can be manual (by admin) or automatic (based on credit score)
- Outstanding amount = amountDue - amountPaid
- Loans are associated with telecom networks (MTN, Airtel, Glo, 9mobile)

### Transaction Management
- Transactions can be of type "airtime" (purchases) or "repayment" (loan repayments)
- Transactions can be reconciled by admins
- Failed transactions can be refunded

### Support System
- Tickets can be assigned to support agents or departments
- Tickets can be escalated to higher-tier agents
- Messages in tickets can have attachments
- Ticket history tracks all actions on tickets

### Admin Management
- Admin users have roles with specific permissions
- Admin activities are logged for audit purposes
- 2FA can be enabled for admin users

### Notifications
- System alerts trigger based on thresholds
- Broadcast messages can target specific user segments
- Notification history tracks all sent notifications

### System Configuration
- API integrations are configured for external services (telecom, payment gateways, SMS, email)
- System configuration is stored as key-value pairs
- Email and SMS templates support variable substitution
- Security settings control password policies and 2FA requirements
- Backup settings control automated backup schedules

---

## Notes

1. **Denormalization**: Some entities store denormalized data (e.g., `userPhone`, `userEmail` in Loan and Transaction) for performance and quick access. This should be kept in sync with the source User entity.

2. **Metadata Fields**: Several entities have `metadata` JSON fields for extensibility. These should be used for additional, non-critical data that doesn't require querying.

3. **Computed Fields**: Some fields like `totalLoans`, `messageCount`, `activeTickets` are computed/denormalized and should be updated when related entities change.

4. **Status Enums**: Most entities have status enums that represent their lifecycle states. These should be strictly enforced.

5. **Timestamps**: All entities should have `createdAt` and `updatedAt` timestamps for audit and tracking purposes.

6. **Soft Deletes**: Consider implementing soft deletes for critical entities (User, Loan, Transaction) to maintain data integrity and audit trails.

7. **Indexes**: The indexes listed are recommendations based on common query patterns. Adjust based on actual usage patterns.

8. **Foreign Keys**: All foreign key relationships should be enforced at the database level for data integrity.

---

## Version History

- **v1.0** (Initial) - Schema based on frontend implementation analysis

