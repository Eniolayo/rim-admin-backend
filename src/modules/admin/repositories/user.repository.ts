import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AdminUser, AdminUserStatus } from '../../../entities/admin-user.entity'

@Injectable()
export class AdminMgmtUserRepository {
  constructor(
    @InjectRepository(AdminUser)
    private readonly repository: Repository<AdminUser>,
  ) {}

  async findWithFilters(filters: { roleId?: string; status?: string; search?: string }): Promise<AdminUser[]> {
    const qb = this.repository.createQueryBuilder('admin')
    if (filters.roleId) qb.andWhere('admin.roleId = :roleId', { roleId: filters.roleId })
    if (filters.status) qb.andWhere('admin.status = :status', { status: filters.status })
    if (filters.search) {
      qb.andWhere('(LOWER(admin.username) LIKE :q OR LOWER(admin.email) LIKE :q)', { q: `%${filters.search.toLowerCase()}%` })
    }
    return qb.orderBy('admin.createdAt', 'DESC').getMany()
  }

  async countByRole(roleId: string): Promise<number> {
    return this.repository.count({ where: { roleId } })
  }

  async updateStatus(id: string, status: AdminUserStatus): Promise<void> {
    await this.repository.update(id, { status })
  }
}

