import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequireSuperAdmin } from '../../auth/decorators/require-super-admin.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminUser } from '../../../entities/admin-user.entity';
import { ApiKeyService } from '../../auth/services/api-key.service';
import {
  CreateApiKeyDto,
  ApiKeyResponseDto,
  ApiKeyListItemDto,
} from '../dto/api-key.dto';

@ApiTags('api-keys')
@ApiBearerAuth()
@Throttle({ default: { limit: 100, ttl: 60000 } })
@Controller('admin/api-keys')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireSuperAdmin()
export class ApiKeysController {
  private readonly logger = new Logger(ApiKeysController.name);

  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @ApiOperation({ summary: 'Generate a new API token' })
  @ApiResponse({
    status: 201,
    description: 'API token generated successfully',
    type: ApiKeyResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - email already has an active API key or invalid input',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'Creator not found',
  })
  async generateApiKey(
    @CurrentUser() user: AdminUser,
    @Body() dto: CreateApiKeyDto,
  ): Promise<ApiKeyResponseDto> {
    this.logger.log(
      `POST /admin/api-keys - Generating API token for ${dto.email} by ${user.email}`,
    );

    const result = await this.apiKeyService.generateApiToken(
      user.id,
      dto.name,
      dto.email,
      dto.description,
    );

    return {
      id: result.entity.id,
      token: result.token, // Only shown once (96 characters)
      name: result.entity.name,
      email: result.entity.email,
      description: result.entity.description || undefined,
      expiresAt: result.entity.expiresAt,
      createdAt: result.entity.createdAt,
      warning:
        'Store this token securely. It will not be shown again.',
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all API keys' })
  @ApiResponse({
    status: 200,
    description: 'API keys retrieved successfully',
    type: [ApiKeyListItemDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required',
  })
  async listApiKeys(
    @CurrentUser() user: AdminUser,
  ): Promise<ApiKeyListItemDto[]> {
    this.logger.log(`GET /admin/api-keys - Listing API keys by ${user.email}`);

    const apiKeys = await this.apiKeyService.listApiKeys();

    return apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      email: key.email,
      description: key.description || undefined,
      status: key.status,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      creatorEmail: key.creator?.email || 'Unknown',
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific API key details' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiResponse({
    status: 200,
    description: 'API key retrieved successfully',
    type: ApiKeyListItemDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'API key not found',
  })
  async getApiKeyById(
    @Param('id') id: string,
  ): Promise<ApiKeyListItemDto> {
    const apiKey = await this.apiKeyService.getApiKeyById(id);

    return {
      id: apiKey.id,
      name: apiKey.name,
      email: apiKey.email,
      description: apiKey.description || undefined,
      status: apiKey.status,
      lastUsedAt: apiKey.lastUsedAt,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      creatorEmail: apiKey.creator?.email || 'Unknown',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiResponse({
    status: 204,
    description: 'API key revoked successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'API key not found',
  })
  async revokeApiKey(
    @Param('id') id: string,
    @CurrentUser() user: AdminUser,
  ): Promise<void> {
    this.logger.log(
      `DELETE /admin/api-keys/${id} - Revoking API key by ${user.email}`,
    );
    await this.apiKeyService.revokeApiKey(id, user.id);
  }
}

