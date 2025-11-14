import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsEnum } from 'class-validator'
import { TwoFactorMethod } from '../../../entities/security-settings.entity'

export class TwoFactorSettingsResponseDto {
  @ApiProperty()
  enabled: boolean

  @ApiProperty()
  requiredForAdmins: boolean

  @ApiProperty({ enum: TwoFactorMethod })
  method: TwoFactorMethod
}

export class TwoFactorSettingsUpdateDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean

  @ApiProperty()
  @IsBoolean()
  requiredForAdmins: boolean

  @ApiProperty({ enum: TwoFactorMethod })
  @IsEnum(TwoFactorMethod)
  method: TwoFactorMethod
}

