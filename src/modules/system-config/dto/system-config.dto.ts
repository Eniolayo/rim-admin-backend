import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDefined,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSystemConfigDto {
  @ApiProperty({
    description: 'Configuration category',
    example: 'credit_score',
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    description: 'Configuration key',
    example: 'points_per_repayment_rate',
  })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({
    description:
      'Configuration value (can be string, number, boolean, or object)',
    example: 10,
  })
  @IsDefined()
  value: string | number | boolean | object | unknown[];

  @ApiPropertyOptional({ description: 'Configuration description' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateSystemConfigDto {
  @ApiPropertyOptional({
    description: 'Configuration value',
    example: 10,
  })
  @IsOptional()
  value?: string | number | boolean | object | unknown[];

  @ApiPropertyOptional({ description: 'Configuration description' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class SystemConfigResponseDto {
  @ApiProperty({ description: 'Configuration ID' })
  id: string;

  @ApiProperty({ description: 'Configuration category' })
  category: string;

  @ApiProperty({ description: 'Configuration key' })
  key: string;

  @ApiProperty({ description: 'Configuration value' })
  value: string | number | boolean | object | unknown[];

  @ApiPropertyOptional({ description: 'Configuration description' })
  description: string | null;

  @ApiPropertyOptional({ description: 'ID of admin who last updated' })
  updatedBy: string | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class SystemConfigQueryDto {
  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsString()
  @IsOptional()
  category?: string;
}
