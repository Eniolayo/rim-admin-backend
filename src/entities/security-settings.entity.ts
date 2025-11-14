import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { AdminUser } from './admin-user.entity'

export enum TwoFactorMethod {
  SMS = 'sms',
  EMAIL = 'email',
  APP = 'app',
}

@Entity('SECURITY_SETTINGS')
export class SecuritySettings {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'boolean', default: true })
  enabled: boolean

  @Column({ type: 'boolean', default: false })
  requiredForAdmins: boolean

  @Column({ type: 'enum', enum: TwoFactorMethod, default: TwoFactorMethod.SMS })
  method: TwoFactorMethod

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null

  @ManyToOne(() => AdminUser, { nullable: true })
  @JoinColumn({ name: 'updatedBy' })
  updater: AdminUser | null
}

