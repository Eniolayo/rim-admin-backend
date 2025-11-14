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

@Entity('BACKUP_CODES')
@Index(['adminUserId', 'used'])
export class BackupCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  adminUserId: string;

  @Column({ type: 'varchar', length: 255 })
  codeHash: string;

  @Column({ type: 'boolean', default: false })
  used: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => AdminUser)
  @JoinColumn({ name: 'adminUserId' })
  user: AdminUser;
}
