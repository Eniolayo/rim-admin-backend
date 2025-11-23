import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { AdminUser } from './admin-user.entity';

export enum NotificationType {
  TICKET_CREATED = 'ticket_created',
  TICKET_ASSIGNED = 'ticket_assigned',
  TICKET_ESCALATED = 'ticket_escalated',
  LOAN_APPROVED = 'loan_approved',
  LOAN_DISBURSED = 'loan_disbursed',
  HIGH_RISK_TRANSACTION = 'high_risk_transaction',
  TRANSACTION_COMPLETED = 'transaction_completed',
  CREDIT_LIMIT_UPDATED = 'credit_limit_updated',
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
}

export enum RelatedEntityType {
  TICKET = 'ticket',
  LOAN = 'loan',
  TRANSACTION = 'transaction',
  USER = 'user',
}

@Entity('NOTIFICATIONS')
@Index(['recipientId'])
@Index(['type'])
@Index(['status'])
@Index(['createdAt'])
@Index(['relatedEntityType', 'relatedEntityId'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'uuid' })
  recipientId: string;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.UNREAD,
  })
  status: NotificationStatus;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;

  @Column({
    type: 'enum',
    enum: RelatedEntityType,
    nullable: true,
  })
  relatedEntityType: RelatedEntityType | null;

  @Column({ type: 'uuid', nullable: true })
  relatedEntityId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => AdminUser, { eager: false })
  @JoinColumn({ name: 'recipientId' })
  recipient: AdminUser;
}

