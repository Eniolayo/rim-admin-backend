import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Loan } from './loan.entity';
import { Transaction } from './transaction.entity';

@Entity('CREDIT_SCORE_HISTORY')
@Index(['userId'])
@Index(['loanId'])
@Index(['transactionId'])
@Index(['createdAt'])
export class CreditScoreHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'integer' })
  previousScore: number;

  @Column({ type: 'integer' })
  newScore: number;

  @Column({ type: 'integer' })
  pointsAwarded: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  loanId: string | null;

  @Column({ type: 'uuid', nullable: true })
  transactionId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Loan, { eager: false, nullable: true })
  @JoinColumn({ name: 'loanId' })
  loan: Loan | null;

  @ManyToOne(() => Transaction, { eager: false, nullable: true })
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction | null;
}
