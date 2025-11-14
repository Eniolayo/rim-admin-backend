import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm'
import { User } from './user.entity'
import { AdminUser } from './admin-user.entity'

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in-progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  ESCALATED = 'escalated',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TicketCategory {
  TECHNICAL = 'technical',
  BILLING = 'billing',
  ACCOUNT = 'account',
  LOAN = 'loan',
  GENERAL = 'general',
  TRANSACTION = 'transaction',
}

@Entity('SUPPORT_TICKETS')
@Index(['ticketNumber'], { unique: true })
@Index(['customerId'])
@Index(['status'])
@Index(['priority'])
@Index(['category'])
@Index(['assignedTo'])
@Index(['createdAt'])
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255, unique: true })
  ticketNumber: string

  @Column({ type: 'uuid' })
  customerId: string

  @Column({ type: 'varchar', length: 255 })
  customerName: string

  @Column({ type: 'varchar', length: 255 })
  customerPhone: string

  @Column({ type: 'varchar', length: 255 })
  customerEmail: string

  @Column({ type: 'varchar', length: 255 })
  subject: string

  @Column({ type: 'text' })
  description: string

  @Column({ type: 'enum', enum: TicketCategory })
  category: TicketCategory

  @Column({ type: 'enum', enum: TicketPriority })
  priority: TicketPriority

  @Column({ type: 'enum', enum: TicketStatus })
  status: TicketStatus

  @Column({ type: 'varchar', length: 255, nullable: true })
  assignedTo: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  assignedToName: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  department: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  escalatedTo: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  escalatedToName: string | null

  @Column({ type: 'text', nullable: true })
  resolution: string | null

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string | null

  @Column({ type: 'timestamp', nullable: true })
  lastMessageAt: Date | null

  @Column({ type: 'integer', default: 0 })
  messageCount: number

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[] | null

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'customerId' })
  customer: User

  @ManyToOne(() => AdminUser, { eager: false, nullable: true })
  @JoinColumn({ name: 'resolvedBy' })
  resolver: AdminUser | null
}

