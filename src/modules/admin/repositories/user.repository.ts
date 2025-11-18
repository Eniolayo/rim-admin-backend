import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AdminUser,
  AdminUserStatus,
} from '../../../entities/admin-user.entity';

@Injectable()
export class AdminMgmtUserRepository {
  private readonly logger = new Logger(AdminMgmtUserRepository.name);

  constructor(
    @InjectRepository(AdminUser)
    private readonly repository: Repository<AdminUser>,
  ) {}

  async findWithFilters(filters: {
    role?: string;
    status?: string;
    search?: string;
  }): Promise<AdminUser[]> {
    try {
      this.logger.debug(
        `Finding admin users with filters: ${JSON.stringify(filters)}`,
      );

      const qb = this.repository.createQueryBuilder('admin');

      if (filters.role) {
        // Change from exact match to partial match (LIKE)
        qb.andWhere('LOWER(admin.role) LIKE LOWER(:role)', {
          role: `%${filters.role}%`,
        });
      }

      if (filters.status) {
        qb.andWhere('admin.status = :status', { status: filters.status });
      }

      if (filters.search) {
        qb.andWhere(
          '(LOWER(admin.username) LIKE :q OR LOWER(admin.email) LIKE :q)',
          {
            q: `%${filters.search.toLowerCase()}%`,
          },
        );
      }

      const results = await qb.orderBy('admin.createdAt', 'DESC').getMany();
      this.logger.debug(`Found ${results.length} admin users`);

      return results;
    } catch (error) {
      this.logger.error(
        `Error finding admin users with filters: ${error.message}`,
        error.stack,
      );

      // Handle database-specific errors
      if (error.code === '23505') {
        throw new InternalServerErrorException('Database constraint violation');
      }

      throw new InternalServerErrorException('Failed to retrieve admin users');
    }
  }

  async countByRole(roleId: string): Promise<number> {
    try {
      this.logger.debug(`Counting admin users by roleId: ${roleId}`);
      const count = await this.repository.count({ where: { roleId } });
      return count;
    } catch (error) {
      this.logger.error(
        `Error counting admin users by role: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to count admin users by role',
      );
    }
  }

  async updateStatus(id: string, status: AdminUserStatus): Promise<void> {
    try {
      this.logger.debug(
        `Updating admin user status: id=${id}, status=${status}`,
      );
      const result = await this.repository.update(id, { status });

      if (result.affected === 0) {
        this.logger.warn(`No admin user found with id: ${id}`);
        throw new NotFoundException(`Admin user with id ${id} not found`);
      }

      this.logger.debug(`Successfully updated admin user status: id=${id}`);
    } catch (error) {
      // Re-throw NotFoundException as-is
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error updating admin user status: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to update admin user status',
      );
    }
  }

  async updateRole(
    id: string,
    roleId: string,
    roleName: string,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Updating admin user role: id=${id}, roleId=${roleId}, roleName=${roleName}`,
      );
      const result = await this.repository.update(id, {
        roleId,
        role: roleName,
      });

      if (result.affected === 0) {
        this.logger.warn(`No admin user found with id: ${id}`);
        throw new NotFoundException(`Admin user with id ${id} not found`);
      }

      this.logger.debug(`Successfully updated admin user role: id=${id}`);
    } catch (error) {
      // Re-throw NotFoundException as-is
      if (error instanceof NotFoundException) {
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

  async findById(id: string): Promise<AdminUser | null> {
    try {
      return await this.repository.findOne({
        where: { id },
        relations: ['roleEntity'],
      });
    } catch (error) {
      this.logger.error(
        `Error finding admin user by id: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to find admin user');
    }
  }
}
