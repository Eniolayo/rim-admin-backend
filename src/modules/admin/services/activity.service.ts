import { Injectable } from '@nestjs/common'
import { AdminActivityLogRepository } from '../repositories/activity.repository'
import { ActivityLogResponseDto } from '../dto/activity.dto'

@Injectable()
export class ActivityService {
  constructor(private readonly logs: AdminActivityLogRepository) {}

  private toDto(log: any): ActivityLogResponseDto {
    return {
      id: log.id,
      adminId: log.adminId,
      adminName: log.adminName,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId ?? null,
      details: log.details ?? null,
      ipAddress: log.ipAddress ?? null,
      timestamp: log.timestamp,
    }
  }

  async list(filters: { adminId?: string; action?: string; resource?: string; startDate?: string; endDate?: string }): Promise<ActivityLogResponseDto[]> {
    const parsed = {
      adminId: filters.adminId,
      action: filters.action,
      resource: filters.resource,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    }
    const all = await this.logs.query(parsed)
    return all.map((l) => this.toDto(l))
  }
}

