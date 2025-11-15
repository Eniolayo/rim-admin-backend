import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsEnum,
  MinLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import {
  AdminInvitationRole,
  AdminInvitationStatus,
} from '../../../entities/admin-invitation.entity';
import { AdminUserResponseDto } from './admin-user.dto';

export class InviteAdminDto {
  @ApiProperty({
    description: 'Email address of the admin to invite',
    example: 'admin@example.com',
  })
  @IsString({ message: 'Email must be a string' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    description: 'Role to assign to the admin',
    enum: AdminInvitationRole,
    example: AdminInvitationRole.ADMIN,
  })
  @IsString({ message: 'Role must be a string' })
  @IsEnum(AdminInvitationRole, {
    message: 'Role must be one of: super_admin, admin, moderator',
  })
  @IsNotEmpty({ message: 'Role is required' })
  role!: AdminInvitationRole;
}

export class AdminInvitationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: AdminInvitationRole })
  role: AdminInvitationRole;

  @ApiProperty()
  inviteToken: string;

  @ApiProperty()
  invitedBy: string;

  @ApiProperty()
  invitedByName: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  expiresAt: Date;

  @ApiPropertyOptional()
  acceptedAt?: Date | null;

  @ApiProperty({ enum: AdminInvitationStatus })
  status: AdminInvitationStatus;
}

export class VerifyInviteTokenDto {
  @ApiProperty({
    description: 'Invitation token to verify',
    example: 'abc123def456...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Token is required' })
  token: string;
}

export class VerifyInviteResponseDto {
  @ApiProperty({ description: 'Whether the token is valid' })
  valid: boolean;

  @ApiPropertyOptional({ type: AdminInvitationResponseDto })
  invitation?: AdminInvitationResponseDto;

  @ApiPropertyOptional({ description: 'Error message if invalid' })
  message?: string;
}

export class SetupAdminAccountDto {
  @ApiProperty({
    description: 'Invitation token',
    example: 'abc123def456...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Invitation token is required' })
  inviteToken: string;

  @ApiProperty({
    description: 'Full name of the admin',
    example: 'John Doe',
  })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  name: string;

  @ApiProperty({
    description: 'Password for the admin account',
    example: 'SecurePassword123',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/[a-z]/, {
    message: 'Password must contain at least one lowercase letter',
  })
  @Matches(/[0-9]/, {
    message: 'Password must contain at least one number',
  })
  password: string;
}

export class SetupAdminAccountResponseDto extends AdminUserResponseDto {}

