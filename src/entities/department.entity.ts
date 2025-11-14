import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

@Entity('DEPARTMENTS')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text' })
  description: string

  @Column({ type: 'integer' })
  tier: number

  @Column({ type: 'integer', default: 0 })
  agentCount: number
}

