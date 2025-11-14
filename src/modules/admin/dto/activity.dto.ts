import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

export class ActivityQueryDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  adminId?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  action?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  resource?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  startDate?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  endDate?: string
}

export class ActivityLogResponseDto {
  @ApiProperty()
  id: string
  @ApiProperty()
  adminId: string
  @ApiProperty()
  adminName: string
  @ApiProperty()
  action: string
  @ApiProperty()
  resource: string
  @ApiProperty({ required: false })
  resourceId?: string | null
  @ApiProperty({ required: false })
  details?: Record<string, unknown> | null
  @ApiProperty({ required: false })
  ipAddress?: string | null
  @ApiProperty()
  timestamp: Date
}

