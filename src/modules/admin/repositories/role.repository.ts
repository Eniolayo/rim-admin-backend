import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AdminRole } from '../../../entities/admin-role.entity'

@Injectable()
export class AdminRoleRepository {
  constructor(
    @InjectRepository(AdminRole)
    private readonly repository: Repository<AdminRole>,
  ) {}

  async findAll(): Promise<AdminRole[]> {
    return this.repository.find({ order: { createdAt: 'DESC' } })
  }

  async findById(id: string): Promise<AdminRole | null> {
    return this.repository.findOne({ where: { id } })
  }

  async isNameTaken(name: string, excludeId?: string): Promise<boolean> {
    const qb = this.repository.createQueryBuilder('role').where('role.name = :name', { name })
    if (excludeId) qb.andWhere('role.id != :excludeId', { excludeId })
    const count = await qb.getCount()
    return count > 0
  }

  async save(role: AdminRole): Promise<AdminRole> {
    return this.repository.save(role)
  }

  async update(id: string, data: Partial<AdminRole>): Promise<void> {
    await this.repository.update(id, data)
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id)
  }
}

