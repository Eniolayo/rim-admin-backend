import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AdminActivityLog } from '../../../entities/admin-activity-log.entity'

@Injectable()
export class AdminActivityLogRepository {
  constructor(
    @InjectRepository(AdminActivityLog)
    private readonly repository: Repository<AdminActivityLog>,
  ) {}

  async query(filters: { adminId?: string; action?: string; resource?: string; startDate?: Date; endDate?: Date }): Promise<AdminActivityLog[]> {
    const qb = this.repository.createQueryBuilder('log')
    if (filters.adminId) qb.andWhere('log.adminId = :adminId', { adminId: filters.adminId })
    if (filters.action) qb.andWhere('log.action = :action', { action: filters.action })
    if (filters.resource) qb.andWhere('log.resource = :resource', { resource: filters.resource })
    if (filters.startDate && filters.endDate) {
      qb.andWhere('log.timestamp BETWEEN :from AND :to', { from: filters.startDate, to: filters.endDate })
    } else if (filters.startDate) {
      qb.andWhere('log.timestamp >= :from', { from: filters.startDate })
    } else if (filters.endDate) {
      qb.andWhere('log.timestamp <= :to', { to: filters.endDate })
    }
    return qb.orderBy('log.timestamp', 'DESC').getMany()
  }
}

