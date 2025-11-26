import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'External user name',
    example: 'John Doe',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'External user email (must be unique)',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Optional description for the API key',
    example: 'API key for USSD integration',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class ApiKeyResponseDto {
  @ApiProperty({ description: 'API key ID' })
  id: string;

  @ApiProperty({ description: 'Plain API key (only shown once)' })
  apiKey: string;

  @ApiProperty({ description: 'Plain API secret (only shown once)' })
  apiSecret: string;

  @ApiProperty({ description: 'External user name' })
  name: string;

  @ApiProperty({ description: 'External user email' })
  email: string;

  @ApiPropertyOptional({ description: 'Description' })
  description?: string;

  @ApiProperty({ description: 'Expiration date' })
  expiresAt: Date;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Warning message' })
  warning: string;
}

export class ApiKeyListItemDto {
  @ApiProperty({ description: 'API key ID' })
  id: string;

  @ApiProperty({ description: 'External user name' })
  name: string;

  @ApiProperty({ description: 'External user email' })
  email: string;

  @ApiPropertyOptional({ description: 'Description' })
  description?: string;

  @ApiProperty({ description: 'Status', enum: ['active', 'inactive', 'revoked'] })
  status: string;

  @ApiProperty({ description: 'Last used timestamp', nullable: true })
  lastUsedAt: Date | null;

  @ApiProperty({ description: 'Expiration date' })
  expiresAt: Date;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Creator email' })
  creatorEmail: string;
}

