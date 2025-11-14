import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { AdminRole } from './admin-role.entity';

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

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Exclude()
  refreshToken: string | null;

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
}
