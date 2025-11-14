import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'
import { AdminUser } from './admin-user.entity'
import { User } from './user.entity'

export enum TransactionType {
  AIRTIME = 'airtime',
  REPAYMENT = 'repayment',
}

export enum TransactionStatus {
  COMPLETED = 'completed',
  PENDING = 'pending',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  BANK_TRANSFER = 'bank_transfer',
  CARD = 'card',
  WALLET = 'wallet',
  CASH = 'cash',
}

@Entity('TRANSACTIONS')
@Index(['transactionId'], { unique: true })
@Index(['userId'])
@Index(['type'])
@Index(['status'])
@Index(['createdAt'])
@Index(['reference'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255, unique: true })
  transactionId: string

  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'varchar', length: 255 })
  userPhone: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  userEmail: string | null

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number

  @Column({ type: 'enum', enum: TransactionStatus })
  status: TransactionStatus

  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod: PaymentMethod | null

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  provider: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  network: string | null

  @Column({ type: 'timestamp', nullable: true })
  reconciledAt: Date | null

  @Column({ type: 'uuid', nullable: true })
  reconciledBy: string | null

  @Column({ type: 'text', nullable: true })
  notes: string | null

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'userId' })
  user: User

  @ManyToOne(() => AdminUser, { eager: false, nullable: true })
  @JoinColumn({ name: 'reconciledBy' })
  reconciler: AdminUser | null
}

