import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class ForgotPasswordRequestDto {
  @ApiProperty({ description: 'Admin email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: '6-digit TOTP code from authenticator', minLength: 6 })
  @IsString()
  @MinLength(6)
  code: string;
}

export class VerifyResetTokenResponseDto {
  @ApiProperty({ description: 'Token validity flag' })
  valid: boolean;

  @ApiProperty({ description: 'Optional message when invalid', required: false })
  message?: string;
}