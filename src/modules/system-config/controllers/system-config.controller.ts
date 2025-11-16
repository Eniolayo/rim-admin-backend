import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SystemConfigService } from '../services/system-config.service';
import {
  CreateSystemConfigDto,
  UpdateSystemConfigDto,
  SystemConfigResponseDto,
  SystemConfigQueryDto,
} from '../dto/system-config.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminUser } from '../../../entities/admin-user.entity';

@ApiTags('System Configuration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/settings/configs')
export class SystemConfigController {
  constructor(private readonly configService: SystemConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Get all system configurations' })
  @ApiResponse({
    status: 200,
    description: 'List of system configurations',
    type: [SystemConfigResponseDto],
  })
  async findAll(
    @Query() query: SystemConfigQueryDto,
  ): Promise<SystemConfigResponseDto[]> {
    return this.configService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a system configuration by ID' })
  @ApiResponse({
    status: 200,
    description: 'System configuration',
    type: SystemConfigResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  async findOne(@Param('id') id: string): Promise<SystemConfigResponseDto> {
    return this.configService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new system configuration' })
  @ApiResponse({
    status: 201,
    description: 'System configuration created',
    type: SystemConfigResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Configuration already exists' })
  async create(
    @Body() createDto: CreateSystemConfigDto,
    @CurrentUser() adminUser: AdminUser,
  ): Promise<SystemConfigResponseDto> {
    return this.configService.create(createDto, adminUser);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a system configuration' })
  @ApiResponse({
    status: 200,
    description: 'System configuration updated',
    type: SystemConfigResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSystemConfigDto,
    @CurrentUser() adminUser: AdminUser,
  ): Promise<SystemConfigResponseDto> {
    return this.configService.update(id, updateDto, adminUser);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a system configuration' })
  @ApiResponse({ status: 204, description: 'Configuration deleted' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.configService.delete(id);
  }

  @Get('category/:category')
  @ApiOperation({ summary: 'Get configurations by category' })
  @ApiResponse({
    status: 200,
    description: 'List of configurations in category',
    type: [SystemConfigResponseDto],
  })
  async findByCategory(
    @Param('category') category: string,
  ): Promise<SystemConfigResponseDto[]> {
    return this.configService.findAll({ category });
  }
}
