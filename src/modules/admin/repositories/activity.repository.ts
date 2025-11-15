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

  async create(data: {
    adminId: string
    adminName: string
    action: string
    resource: string
    resourceId?: string | null
    details?: Record<string, unknown> | null
    ipAddress?: string | null
  }): Promise<AdminActivityLog> {
    const log = this.repository.create({
      adminId: data.adminId,
      adminName: data.adminName,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId ?? null,
      details: data.details ?? null,
      ipAddress: data.ipAddress ?? null,
    })
    return this.repository.save(log)
  }
}

