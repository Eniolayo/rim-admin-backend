import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { UsersService } from '../services/users.service'
import { AdminUserResponseDto, AdminUserFiltersDto, UpdateAdminStatusDto } from '../dto/admin-user.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { AdminMgmtUserRepository } from '../repositories/user.repository'

@ApiTags('admin-users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/users')
export class UsersController {
  constructor(private readonly service: UsersService, private readonly usersRepo: AdminMgmtUserRepository) {}

  @Get()
  @ApiOperation({ summary: 'List admin users' })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, type: [AdminUserResponseDto] })
  list(@Query() q: AdminUserFiltersDto): Promise<AdminUserResponseDto[]> {
    return this.service.list({ role: q.role, status: q.status, search: q.search })
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update admin user status' })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  async updateStatus(@Param('id') id: string, @Body() body: UpdateAdminStatusDto): Promise<AdminUserResponseDto> {
    await this.usersRepo.updateStatus(id, body.status)
    const [user] = await this.service.list({ role: undefined, status: undefined, search: undefined }).then((list) => list.filter((u) => u.id === id))
    return user
  }
}

