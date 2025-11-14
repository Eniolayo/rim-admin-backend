import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SecuritySettings, TwoFactorMethod } from '../../../entities/security-settings.entity'

@Injectable()
export class SecuritySettingsRepository {
  constructor(
    @InjectRepository(SecuritySettings)
    private readonly repository: Repository<SecuritySettings>,
  ) {}

  async getSingleton(): Promise<SecuritySettings> {
    let settings = await this.repository.findOne({ where: {} })
    if (!settings) {
      settings = this.repository.create({ enabled: true, requiredForAdmins: false, method: TwoFactorMethod.SMS })
      settings = await this.repository.save(settings)
    }
    return settings
  }

  async update(data: Partial<SecuritySettings>, updatedBy?: string): Promise<SecuritySettings> {
    const settings = await this.getSingleton()
    Object.assign(settings, data)
    if (updatedBy) settings.updatedBy = updatedBy
    return this.repository.save(settings)
  }
}

