import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsUUID } from 'class-validator';
import { AdminUserStatus } from '../../../entities/admin-user.entity';

export class AdminUserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  roleId: string;

  @ApiProperty({ enum: AdminUserStatus })
  status: AdminUserStatus;

  @ApiProperty({ required: false })
  lastLogin?: Date | null;

  @ApiProperty()
  twoFactorEnabled: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ required: false })
  createdBy?: string | null;
}

export class UpdateAdminStatusDto {
  @ApiProperty({ enum: AdminUserStatus })
  @IsEnum(AdminUserStatus)
  status: AdminUserStatus;
}

export class UpdateAdminRoleDto {
  @ApiProperty({ description: 'Role ID to assign to user' })
  @IsUUID()
  roleId!: string;
}

export class AdminUserFiltersDto {
  @ApiProperty({
    required: false,
    example: 'Support Agent',
    description: 'Filter by role name (case-insensitive)',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({
    required: false,
    enum: AdminUserStatus,
    example: AdminUserStatus.ACTIVE,
    description: 'Filter by user status',
  })
  @IsOptional()
  @IsEnum(AdminUserStatus, {
    message: 'Status must be one of: active, inactive, suspended',
  })
  status?: AdminUserStatus;

  @ApiProperty({
    required: false,
    example: 'john@example.com',
    description: 'Search by username or email (case-insensitive)',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
