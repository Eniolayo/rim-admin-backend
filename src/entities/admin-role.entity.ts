import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AdminUser } from './admin-user.entity';
import { Department } from './department.entity';

export interface Permission {
  resource: string;
  actions: ('read' | 'write' | 'delete')[];
}

@Entity('ADMIN_ROLES')
@Index(['name'], { unique: true })
export class AdminRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb' })
  permissions: Permission[];

  @Column({ type: 'int', default: 0 })
  userCount: number;

  @Column({ type: 'uuid', nullable: true })
  departmentId: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => AdminUser, (adminUser) => adminUser.role)
  adminUsers: AdminUser[];

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'departmentId' })
  department: Department | null;
}
