import { Injectable } from '@nestjs/common'
import { AdminMgmtUserRepository } from '../repositories/user.repository'
import { AdminUserResponseDto } from '../dto/admin-user.dto'
import { AdminUser } from '../../../entities/admin-user.entity'

@Injectable()
export class UsersService {
  constructor(private readonly users: AdminMgmtUserRepository) {}

  private toDto(user: AdminUser): AdminUserResponseDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || user.roleEntity?.name || '',
      roleId: user.roleId,
      status: user.status,
      lastLogin: user.lastLogin ?? null,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
      createdBy: user.createdBy ?? null,
    }
  }

  async list(filters: { role?: string; status?: string; search?: string }): Promise<AdminUserResponseDto[]> {
    const all = await this.users.findWithFilters({ roleId: filters.role, status: filters.status, search: filters.search })
    return all.map((u) => this.toDto(u))
  }
}

