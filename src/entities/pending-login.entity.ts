import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AdminUser } from './admin-user.entity';

export type PendingLoginType = 'mfa' | 'setup';

@Entity('PENDING_LOGINS')
@Index(['adminUserId', 'type', 'used'])
export class PendingLogin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  adminUserId: string;

  @Column({ type: 'varchar', length: 255 })
  hash: string;

  @Column({ type: 'varchar', length: 16 })
  type: PendingLoginType;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'boolean', default: false })
  used: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  secret: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => AdminUser)
  @JoinColumn({ name: 'adminUserId' })
  user: AdminUser;
}
