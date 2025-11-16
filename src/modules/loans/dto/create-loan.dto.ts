import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Network } from '../../../entities/loan.entity';

export class CreateLoanDto {
  @ApiProperty({ description: 'User ID', example: 'uuid' })
  @IsString()
  userId: string;

  @ApiPropertyOptional({
    description:
      'Loan amount (if not provided, will be calculated based on credit score)',
    example: 50000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiProperty({ description: 'Network', enum: Network, example: Network.MTN })
  @IsEnum(Network)
  network: Network;

  @ApiPropertyOptional({
    description:
      'Interest rate percentage (if not provided, will be calculated based on credit score)',
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  interestRate?: number;

  @ApiPropertyOptional({
    description:
      'Repayment period in days (if not provided, will be calculated based on credit score)',
    example: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  repaymentPeriod?: number;

  @ApiPropertyOptional({ description: 'Metadata', type: 'object' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
