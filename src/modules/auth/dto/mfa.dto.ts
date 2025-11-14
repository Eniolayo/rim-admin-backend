import { ApiProperty } from '@nestjs/swagger'
import { IsString, Length } from 'class-validator'

export class VerifyCodeDto {
  @ApiProperty({ description: '6-digit TOTP code', example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string
}

export class SetupRequestDto {
  @ApiProperty({ description: 'Setup session token' })
  @IsString()
  sessionToken: string
}

export class SetupVerifyDto {
  @ApiProperty({ description: 'Setup session token' })
  @IsString()
  sessionToken: string

  @ApiProperty({ description: '6-digit TOTP code', example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string
}

export class BackupCodeConsumeDto {
  @ApiProperty({ description: 'Temporary hash from login step' })
  @IsString()
  temporaryHash: string

  @ApiProperty({ description: 'Backup code value' })
  @IsString()
  code: string
}

export class BackupCodesResponseDto {
  @ApiProperty({ description: 'Plaintext backup codes (one-time view)', type: [String] })
  codes: string[]
}

export class SetupStartResponseDto {
  @ApiProperty({ description: 'otpauth URL for authenticator apps' })
  otpauthUrl: string

  @ApiProperty({ description: 'Manual secret key for input' })
  manualKey: string

  @ApiProperty({ description: 'QR code as PNG data URL' })
  qrCodeDataUrl: string

  @ApiProperty({ description: 'Plaintext backup codes (one-time view)', type: [String] })
  backupCodes: string[]
}
