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

@Entity('SYSTEM_CONFIG')
@Index(['category'])
@Index(['category', 'key'], { unique: true })
export class SystemConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'varchar', length: 255 })
  key: string;

  @Column({ type: 'jsonb' })
  value: string | number | boolean | object | unknown[];

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => AdminUser, { eager: false, nullable: true })
  @JoinColumn({ name: 'updatedBy' })
  updater: AdminUser | null;
}
