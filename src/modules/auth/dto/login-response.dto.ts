import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User email' })
  email: string;

  @ApiProperty({ description: 'User name (username)' })
  name: string;

  @ApiProperty({ description: 'User role name' })
  role: string;
}

export class LoginResultDto {
  @ApiProperty({ description: 'User information', type: UserResponseDto })
  user: UserResponseDto;

  @ApiPropertyOptional({ description: 'JWT access token' })
  token?: string;

  @ApiPropertyOptional({ description: 'JWT refresh token' })
  refreshToken?: string;

  @ApiPropertyOptional({ description: 'Login step status', enum: ['MFA_REQUIRED', 'MFA_SETUP_REQUIRED'] })
  status?: 'MFA_REQUIRED' | 'MFA_SETUP_REQUIRED';

  @ApiPropertyOptional({ description: 'Temporary hash for MFA verification' })
  temporaryHash?: string;

  @ApiPropertyOptional({ description: 'Session token for 2FA setup' })
  sessionToken?: string;

  @ApiPropertyOptional({ description: 'Expiry time for temporary artifact' })
  expiresAt?: Date;
}

export class TokenResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  token: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken: string;

  @ApiProperty({ description: 'Token expiration time (e.g., "1h")' })
  expiresIn: string;
}
