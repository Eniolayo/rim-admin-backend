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
import { Exclude } from 'class-transformer';
import { AdminUser } from './admin-user.entity';

export enum ApiKeyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  REVOKED = 'revoked',
}

@Entity('API_KEYS')
@Index(['tokenPrefix'], { unique: true })
@Index(['email'], { unique: true })
@Index(['status'])
@Index(['createdBy'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 8, unique: true })
  @Exclude()
  tokenPrefix: string; // First 8 characters for O(1) lookup

  @Column({ type: 'varchar', length: 255 })
  @Exclude()
  tokenHash: string; // Bcrypt hash of the full 96-character token

  @Column({ type: 'varchar', length: 255 })
  name: string; // External user's name

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string; // External user's email (unique constraint ensures 1 key per email)

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: ApiKeyStatus,
    default: ApiKeyStatus.ACTIVE,
  })
  status: ApiKeyStatus;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'timestamp' })
  expiresAt: Date; // Auto-calculated to 30 days from creation

  @Column({ type: 'uuid' })
  createdBy: string; // SuperAdmin who created it

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => AdminUser, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  creator: AdminUser | null;
}

