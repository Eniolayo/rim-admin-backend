import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsString } from 'class-validator'
import { AdminUserStatus } from '../../../entities/admin-user.entity'

export class AdminUserResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  username: string

  @ApiProperty()
  email: string

  @ApiProperty()
  role: string

  @ApiProperty()
  roleId: string

  @ApiProperty({ enum: AdminUserStatus })
  status: AdminUserStatus

  @ApiProperty({ required: false })
  lastLogin?: Date | null

  @ApiProperty()
  twoFactorEnabled: boolean

  @ApiProperty()
  createdAt: Date

  @ApiProperty({ required: false })
  createdBy?: string | null
}

export class UpdateAdminStatusDto {
  @ApiProperty({ enum: AdminUserStatus })
  @IsEnum(AdminUserStatus)
  status: AdminUserStatus
}

export class AdminUserFiltersDto {
  @ApiProperty({ required: false })
  @IsString()
  role?: string

  @ApiProperty({ required: false })
  @IsString()
  status?: string

  @ApiProperty({ required: false })
  @IsString()
  search?: string
}

