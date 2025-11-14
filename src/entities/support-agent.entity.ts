import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm'

export enum AgentStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  AWAY = 'away',
}

@Entity('SUPPORT_AGENTS')
@Index(['email'], { unique: true })
@Index(['department'])
@Index(['status'])
export class SupportAgent {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 255, unique: true })
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
}

