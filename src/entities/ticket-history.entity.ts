import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm'
import { SupportTicket } from './support-ticket.entity'
import { AdminUser } from './admin-user.entity'

@Entity('TICKET_HISTORY')
@Index(['ticketId'])
@Index(['performedBy'])
@Index(['timestamp'])
export class TicketHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  ticketId: string

  @Column({ type: 'varchar', length: 255 })
  action: string

  @Column({ type: 'uuid' })
  performedBy: string

  @Column({ type: 'varchar', length: 255 })
  performedByName: string

  @Column({ type: 'text', nullable: true })
  details: string | null

  @CreateDateColumn({ type: 'timestamp' })
  timestamp: Date

  @ManyToOne(() => SupportTicket, { eager: false })
  @JoinColumn({ name: 'ticketId' })
  ticket: SupportTicket

  @ManyToOne(() => AdminUser, { eager: false })
  @JoinColumn({ name: 'performedBy' })
  performer: AdminUser
}

