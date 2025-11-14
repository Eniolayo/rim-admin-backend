import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm'
import { AdminUser } from './admin-user.entity'

@Entity('ADMIN_ACTIVITY_LOGS')
@Index(['adminId'])
@Index(['resource'])
@Index(['timestamp'])
export class AdminActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  adminId: string

  @Column({ type: 'varchar', length: 255 })
  adminName: string

  @Column({ type: 'varchar', length: 255 })
  action: string

  @Column({ type: 'varchar', length: 255 })
  resource: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  resourceId: string | null

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  ipAddress: string | null

  @CreateDateColumn({ type: 'timestamp' })
  timestamp: Date

  @ManyToOne(() => AdminUser)
  @JoinColumn({ name: 'adminId' })
  admin: AdminUser
}

