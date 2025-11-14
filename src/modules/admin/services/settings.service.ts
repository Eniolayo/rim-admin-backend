import { Injectable } from '@nestjs/common'
import { SecuritySettingsRepository } from '../repositories/settings.repository'
import { TwoFactorSettingsResponseDto, TwoFactorSettingsUpdateDto } from '../dto/twofa-settings.dto'
import { AdminUser } from '../../../entities/admin-user.entity'

@Injectable()
export class SettingsService {
  constructor(private readonly settings: SecuritySettingsRepository) {}

  async getTwoFactor(): Promise<TwoFactorSettingsResponseDto> {
    const s = await this.settings.getSingleton()
    return { enabled: s.enabled, requiredForAdmins: s.requiredForAdmins, method: s.method }
  }

  async updateTwoFactor(dto: TwoFactorSettingsUpdateDto, admin: AdminUser): Promise<TwoFactorSettingsResponseDto> {
    const s = await this.settings.update({ enabled: dto.enabled, requiredForAdmins: dto.requiredForAdmins, method: dto.method }, admin.id)
    return { enabled: s.enabled, requiredForAdmins: s.requiredForAdmins, method: s.method }
  }
}

