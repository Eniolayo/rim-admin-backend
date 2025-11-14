import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { RolesService } from '../services/roles.service'
import { CreateRoleDto, RoleResponseDto, UpdateRoleDto } from '../dto/role.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'

@ApiTags('admin-roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'List admin roles' })
  @ApiResponse({ status: 200, type: [RoleResponseDto] })
  list(): Promise<RoleResponseDto[]> {
    return this.service.list()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get admin role by ID' })
  @ApiResponse({ status: 200, type: RoleResponseDto })
  get(@Param('id') id: string): Promise<RoleResponseDto> {
    return this.service.get(id)
  }

  @Post()
  @ApiOperation({ summary: 'Create admin role' })
  @ApiResponse({ status: 201, type: RoleResponseDto })
  create(@Body() dto: CreateRoleDto): Promise<RoleResponseDto> {
    return this.service.create(dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update admin role' })
  @ApiResponse({ status: 200, type: RoleResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto): Promise<RoleResponseDto> {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete admin role' })
  @ApiResponse({ status: 200 })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id)
  }
}

