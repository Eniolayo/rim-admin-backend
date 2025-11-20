import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { SettingsService } from '../services/settings.service'
import { TwoFactorSettingsResponseDto, TwoFactorSettingsUpdateDto } from '../dto/twofa-settings.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { AdminUser } from '../../../entities/admin-user.entity'

@ApiTags('admin-settings')
@ApiBearerAuth()
@Throttle({ default: { limit: 100, ttl: 60000 } })
@UseGuards(JwtAuthGuard)
@Controller('admin/settings/2fa')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get two-factor settings' })
  @ApiResponse({ status: 200, type: TwoFactorSettingsResponseDto })
  get(): Promise<TwoFactorSettingsResponseDto> {
    return this.service.getTwoFactor()
  }

  @Put()
  @ApiOperation({ summary: 'Update two-factor settings' })
  @ApiResponse({ status: 200, type: TwoFactorSettingsResponseDto })
  update(@Body() dto: TwoFactorSettingsUpdateDto, @CurrentUser() admin: AdminUser): Promise<TwoFactorSettingsResponseDto> {
    return this.service.updateTwoFactor(dto, admin)
  }
}

