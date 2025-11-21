import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { AdminRole } from './admin-role.entity';
import { SupportAgent } from './support-agent.entity';

export enum AdminUserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity('ADMIN_USERS')
@Index(['username'], { unique: true })
@Index(['email'], { unique: true })
@Index(['roleId'])
@Index(['status'])
export class AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  @Exclude()
  password: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  role: string; // Denormalized from AdminRole

  @Column({ type: 'uuid' })
  roleId: string;

  @Column({
    type: 'enum',
    enum: AdminUserStatus,
    default: AdminUserStatus.ACTIVE,
  })
  status: AdminUserStatus;

  @Column({ type: 'timestamp', nullable: true })
  lastLogin: Date | null;

  @Column({ type: 'boolean', default: false })
  twoFactorEnabled: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  otpSecret: string | null;

  @Column({ type: 'text', nullable: true })
  @Exclude()
  refreshToken: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  @Exclude()
  passwordResetTokenHash: string | null;

  @Column({ type: 'timestamp', nullable: true })
  passwordResetTokenExpiresAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  passwordResetTokenUsedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastPasswordChangedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => AdminRole, { eager: true })
  @JoinColumn({ name: 'roleId' })
  roleEntity: AdminRole;

  @ManyToOne(() => AdminUser, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  creator: AdminUser | null;

  @OneToOne(() => SupportAgent, (agent) => agent.adminUser, { nullable: true })
  supportAgent: SupportAgent | null;
}
