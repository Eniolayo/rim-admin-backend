import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Network } from '../../../entities/loan.entity';

export class CreateLoanDto {
  @ApiProperty({ description: 'User ID', example: 'uuid' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Loan amount', example: 50000 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Network', enum: Network, example: Network.MTN })
  @IsEnum(Network)
  network: Network;

  @ApiProperty({ description: 'Interest rate percentage', example: 5 })
  @IsNumber()
  @Min(0)
  interestRate: number;

  @ApiProperty({ description: 'Repayment period in days', example: 30 })
  @IsNumber()
  @Min(1)
  repaymentPeriod: number;

  @ApiPropertyOptional({ description: 'Metadata', type: 'object' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
