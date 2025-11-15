import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LoanStatus, Network } from '../../../entities/loan.entity';

export class LoanQueryDto {
  @ApiPropertyOptional({
    enum: LoanStatus,
    description: 'Filter by loan status',
  })
  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;

  @ApiPropertyOptional({
    enum: Network,
    description: 'Filter by network',
  })
  @IsOptional()
  @IsEnum(Network)
  network?: Network;

  @ApiPropertyOptional({
    description: 'Search by loanId, userPhone, or userEmail',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

