import {
  IsNumber,
  IsEnum,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LoanStatus, Network } from '../../../entities/loan.entity';

export class UpdateLoanDto {
  @ApiPropertyOptional({ description: 'Loan amount' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: 'Loan status', enum: LoanStatus })
  @IsEnum(LoanStatus)
  @IsOptional()
  status?: LoanStatus;

  @ApiPropertyOptional({ description: 'Network', enum: Network })
  @IsEnum(Network)
  @IsOptional()
  network?: Network;

  @ApiPropertyOptional({ description: 'Interest rate percentage' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  interestRate?: number;

  @ApiPropertyOptional({ description: 'Repayment period in days' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  repaymentPeriod?: number;

  @ApiPropertyOptional({ description: 'Due date' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Amount paid' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  amountPaid?: number;

  @ApiPropertyOptional({ description: 'Metadata', type: 'object' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
