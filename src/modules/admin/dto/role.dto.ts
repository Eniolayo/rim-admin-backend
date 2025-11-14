import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNotEmpty, IsString, ArrayNotEmpty, ArrayMinSize, IsIn } from 'class-validator'

export class PermissionDto {
  @ApiProperty()
  @IsString()
  resource: string

  @ApiProperty({ isArray: true, enum: ['read', 'write', 'delete'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(['read', 'write', 'delete'], { each: true })
  actions: ('read' | 'write' | 'delete')[]
}

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string

  @ApiProperty({ type: [PermissionDto] })
  @IsArray()
  @ArrayMinSize(1)
  permissions: PermissionDto[]
}

export class UpdateRoleDto {
  @ApiProperty({ required: false })
  @IsString()
  name?: string

  @ApiProperty({ required: false })
  @IsString()
  description?: string

  @ApiProperty({ type: [PermissionDto], required: false })
  @IsArray()
  permissions?: PermissionDto[]
}

export class RoleResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  name: string

  @ApiProperty()
  description: string

  @ApiProperty({ type: [PermissionDto] })
  permissions: PermissionDto[]

  @ApiProperty()
  userCount: number

  @ApiProperty()
  createdAt: Date

  @ApiProperty()
  updatedAt: Date
}

