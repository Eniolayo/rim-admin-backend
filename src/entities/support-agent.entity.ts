import { Entity, Column, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from 'typeorm'
import { AdminUser } from './admin-user.entity'

export enum AgentStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  AWAY = 'away',
}

@Entity('SUPPORT_AGENTS')
@Index(['department'])
@Index(['status'])
@Index(['adminUserId'])
export class SupportAgent {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 255 })
  email: string

  @Column({ type: 'varchar', length: 255 })
  phone: string

  @Column({ type: 'varchar', length: 255 })
  department: string

  @Column({ type: 'integer' })
  tier: number

  @Column({ type: 'integer', default: 0 })
  activeTickets: number

  @Column({ type: 'enum', enum: AgentStatus })
  status: AgentStatus

  @Column({ type: 'uuid' })
  adminUserId: string

  @ManyToOne(() => AdminUser, { nullable: false })
  @JoinColumn({ name: 'adminUserId' })
  adminUser: AdminUser
}

