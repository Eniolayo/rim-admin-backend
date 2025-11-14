import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Loan } from './loan.entity';

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum RepaymentStatus {
  PARTIAL = 'Partial',
  COMPLETED = 'Completed',
  OVERDUE = 'Overdue',
  PENDING = 'Pending',
}

@Entity('USERS')
@Index(['userId'], { unique: true })
@Index(['phone'])
@Index(['email'])
@Index(['status'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'integer', default: 0 })
  creditScore: number;

  @Column({
    type: 'enum',
    enum: RepaymentStatus,
    default: RepaymentStatus.PENDING,
  })
  repaymentStatus: RepaymentStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalRepaid: number;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  creditLimit: number;

  @Column({ type: 'boolean', default: false })
  autoLimitEnabled: boolean;

  @Column({ type: 'integer', nullable: true })
  totalLoans: number | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => Loan, (loan) => loan.user)
  loans: Loan[];
}
