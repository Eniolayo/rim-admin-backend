import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import {
  AdminUserResponseDto,
  AdminUserFiltersDto,
  UpdateAdminStatusDto,
  UpdateAdminRoleDto,
} from '../dto/admin-user.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequireSuperAdmin } from '../../auth/decorators/require-super-admin.decorator';
import { AdminMgmtUserRepository } from '../repositories/user.repository';

@ApiTags('admin-users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly service: UsersService,
    private readonly usersRepo: AdminMgmtUserRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List admin users' })
  @ApiQuery({
    name: 'role',
    required: false,
    description: 'Filter by role name (case-insensitive)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (active, inactive, suspended)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by username or email (case-insensitive)',
  })
  @ApiResponse({ status: 200, type: [AdminUserResponseDto] })
  @ApiResponse({ status: 400, description: 'Invalid filter parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async list(@Query() q: AdminUserFiltersDto): Promise<AdminUserResponseDto[]> {
    this.logger.log(
      `GET /admin/users - Filters: role=${q.role}, status=${q.status}, search=${q.search}`,
    );
    return this.service.list({
      role: q.role,
      status: q.status,
      search: q.search,
    });
  }

  @Patch(':id/status')
  @RequireSuperAdmin()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Update admin user status' })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required',
  })
  @ApiResponse({ status: 404, description: 'Admin user not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateAdminStatusDto,
  ): Promise<AdminUserResponseDto> {
    this.logger.log(
      `PATCH /admin/users/${id}/status - Updating status to ${body.status}`,
    );

    try {
      await this.usersRepo.updateStatus(id, body.status);
      const allUsers = await this.service.list({
        role: undefined,
        status: undefined,
        search: undefined,
      });
      const user = allUsers.find((u) => u.id === id);

      if (!user) {
        this.logger.warn(`Admin user not found after status update: ${id}`);
        throw new NotFoundException(`Admin user with id ${id} not found`);
      }

      this.logger.log(
        `Successfully updated admin user status: id=${id}, status=${body.status}`,
      );
      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error updating admin user status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Patch(':id/role')
  @RequireSuperAdmin()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Update admin user role' })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required',
  })
  @ApiResponse({ status: 404, description: 'Admin user or role not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updateRole(
    @Param('id') id: string,
    @Body() body: UpdateAdminRoleDto,
  ): Promise<AdminUserResponseDto> {
    this.logger.log(
      `PATCH /admin/users/${id}/role - Updating role to ${body.roleId}`,
    );
    return this.service.updateRole(id, body.roleId);
  }
}
