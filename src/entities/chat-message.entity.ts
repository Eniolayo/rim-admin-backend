import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm'
import { SupportTicket } from './support-ticket.entity'

export enum MessageSenderType {
  CUSTOMER = 'customer',
  AGENT = 'agent',
  SYSTEM = 'system',
}

@Entity('CHAT_MESSAGES')
@Index(['ticketId'])
@Index(['senderId'])
@Index(['createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  ticketId: string

  @Column({ type: 'varchar', length: 255 })
  senderId: string

  @Column({ type: 'varchar', length: 255 })
  senderName: string

  @Column({ type: 'enum', enum: MessageSenderType })
  senderType: MessageSenderType

  @Column({ type: 'text' })
  message: string

  @Column({ type: 'jsonb', nullable: true })
  attachments: Array<{ id: string; name: string; url: string; size: number; type: string }> | null

  @Column({ type: 'boolean', default: false })
  isRead: boolean

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date

  @ManyToOne(() => SupportTicket, { eager: false })
  @JoinColumn({ name: 'ticketId' })
  ticket: SupportTicket
}

