import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AdminMgmtUserRepository } from '../repositories/user.repository';
import { AdminRoleRepository } from '../repositories/role.repository';
import { AdminUserResponseDto } from '../dto/admin-user.dto';
import { AdminUser } from '../../../entities/admin-user.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly users: AdminMgmtUserRepository,
    private readonly roles: AdminRoleRepository,
  ) {}

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
    };
  }

  async list(filters: {
    role?: string;
    status?: string;
    search?: string;
  }): Promise<AdminUserResponseDto[]> {
    try {
      this.logger.log(
        `Listing admin users with filters: role=${filters.role}, status=${filters.status}, search=${filters.search}`,
      );

      // Validate filters - handle empty strings
      if (filters.role !== undefined && filters.role !== null) {
        const trimmedRole = filters.role.trim();
        if (trimmedRole.length === 0) {
          throw new BadRequestException('Role filter cannot be empty');
        }
        filters.role = trimmedRole;
      }

      if (filters.search !== undefined && filters.search !== null) {
        const trimmedSearch = filters.search.trim();
        if (trimmedSearch.length === 0) {
          throw new BadRequestException('Search filter cannot be empty');
        }
        filters.search = trimmedSearch;
      }

      // Pass role (string) directly, not as roleId
      const all = await this.users.findWithFilters({
        role: filters.role,
        status: filters.status,
        search: filters.search,
      });

      this.logger.debug(`Retrieved ${all.length} admin users`);
      return all.map((u) => this.toDto(u));
    } catch (error) {
      // Re-throw HTTP exceptions as-is
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.logger.error(
        `Error listing admin users: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to retrieve admin users');
    }
  }

  async updateRole(id: string, roleId: string): Promise<AdminUserResponseDto> {
    try {
      this.logger.log(`Updating admin user role: id=${id}, roleId=${roleId}`);

      // Validate role exists
      const role = await this.roles.findById(roleId);
      if (!role) {
        this.logger.error(`Role not found: ${roleId}`);
        throw new NotFoundException(`Role with ID '${roleId}' not found`);
      }

      // Get user with old role to track previous roleId
      const user = await this.users.findById(id);
      if (!user) {
        this.logger.error(`Admin user not found: ${id}`);
        throw new NotFoundException(`Admin user with id ${id} not found`);
      }

      const oldRoleId = user.roleId;

      // Update user's roleId and denormalized role field
      await this.users.updateRole(id, roleId, role.name);

      // Recalculate userCount for both old and new roles
      if (oldRoleId !== roleId) {
        const oldRole = await this.roles.findById(oldRoleId);
        if (oldRole) {
          oldRole.userCount = await this.users.countByRole(oldRoleId);
          await this.roles.save(oldRole);
          this.logger.debug(
            `Updated userCount for old role ${oldRoleId}: ${oldRole.userCount}`,
          );
        }

        role.userCount = await this.users.countByRole(roleId);
        await this.roles.save(role);
        this.logger.debug(
          `Updated userCount for new role ${roleId}: ${role.userCount}`,
        );
      }

      // Fetch updated user with role relation
      const updatedUser = await this.users.findById(id);
      if (!updatedUser) {
        this.logger.error(`Admin user not found after update: ${id}`);
        throw new NotFoundException(`Admin user with id ${id} not found`);
      }

      this.logger.log(
        `Successfully updated admin user role: id=${id}, new role=${role.name}`,
      );
      return this.toDto(updatedUser);
    } catch (error) {
      // Re-throw HTTP exceptions as-is
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating admin user role: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to update admin user role',
      );
    }
  }
}
