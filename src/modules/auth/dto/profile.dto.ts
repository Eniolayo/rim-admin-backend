import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { AdminUserStatus } from '../../../entities/admin-user.entity';

export class AdminProfileResponseDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiProperty({ description: 'Email address' })
  email: string;

  @ApiProperty({ description: 'Role name' })
  role: string;

  @ApiProperty({ description: 'Role ID' })
  roleId: string;

  @ApiProperty({ enum: AdminUserStatus, description: 'User status' })
  status: AdminUserStatus;

  @ApiPropertyOptional({ description: 'Last login timestamp' })
  lastLogin?: Date | null;

  @ApiProperty({ description: 'Two-factor authentication enabled' })
  twoFactorEnabled: boolean;

  @ApiProperty({ description: 'Account creation timestamp' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'ID of user who created this account' })
  createdBy?: string | null;
}

export class UpdateAdminProfileDto {
  @ApiPropertyOptional({
    description: 'Username',
    minLength: 3,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  username?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Current password (required when changing password)',
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  currentPassword?: string;

  @ApiPropertyOptional({ description: 'New password', minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  newPassword?: string;
}
