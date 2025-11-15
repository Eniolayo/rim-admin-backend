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

export enum AdminInvitationRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

export enum AdminInvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
}

@Entity('ADMIN_INVITATIONS')
@Index(['inviteToken'], { unique: true })
@Index(['email'])
@Index(['status'])
@Index(['expiresAt'])
export class AdminInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({
    type: 'enum',
    enum: AdminInvitationRole,
  })
  role: AdminInvitationRole;

  @Column({ type: 'varchar', length: 255, unique: true })
  inviteToken: string;

  @Column({ type: 'uuid' })
  invitedBy: string;

  @Column({ type: 'varchar', length: 255 })
  invitedByName: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt: Date | null;

  @Column({
    type: 'enum',
    enum: AdminInvitationStatus,
    default: AdminInvitationStatus.PENDING,
  })
  status: AdminInvitationStatus;

  @ManyToOne(() => AdminUser, { nullable: false })
  @JoinColumn({ name: 'invitedBy' })
  inviter: AdminUser;
}

