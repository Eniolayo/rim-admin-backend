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
@Index(['apiKey'], { unique: true })
@Index(['email'], { unique: true })
@Index(['status'])
@Index(['createdBy'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Exclude()
  apiKey: string; // Hashed API key

  @Column({ type: 'varchar', length: 255 })
  @Exclude()
  apiKeyHash: string; // Bcrypt hash of the API key

  @Column({ type: 'varchar', length: 255 })
  @Exclude()
  apiSecret: string; // Bcrypt hash of the API secret

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

