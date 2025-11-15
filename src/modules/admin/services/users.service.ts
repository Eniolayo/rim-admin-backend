import { Injectable, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common'
import { AdminMgmtUserRepository } from '../repositories/user.repository'
import { AdminUserResponseDto } from '../dto/admin-user.dto'
import { AdminUser } from '../../../entities/admin-user.entity'

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

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
    try {
      this.logger.log(`Listing admin users with filters: role=${filters.role}, status=${filters.status}, search=${filters.search}`)

      // Validate filters - handle empty strings
      if (filters.role !== undefined && filters.role !== null) {
        const trimmedRole = filters.role.trim()
        if (trimmedRole.length === 0) {
          throw new BadRequestException('Role filter cannot be empty')
        }
        filters.role = trimmedRole
      }

      if (filters.search !== undefined && filters.search !== null) {
        const trimmedSearch = filters.search.trim()
        if (trimmedSearch.length === 0) {
          throw new BadRequestException('Search filter cannot be empty')
        }
        filters.search = trimmedSearch
      }

      // Pass role (string) directly, not as roleId
      const all = await this.users.findWithFilters({ 
        role: filters.role, 
        status: filters.status, 
        search: filters.search
      })

      this.logger.debug(`Retrieved ${all.length} admin users`)
      return all.map((u) => this.toDto(u))
    } catch (error) {
      // Re-throw HTTP exceptions as-is
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error
      }

      this.logger.error(`Error listing admin users: ${error.message}`, error.stack)
      throw new InternalServerErrorException('Failed to retrieve admin users')
    }
  }
}

