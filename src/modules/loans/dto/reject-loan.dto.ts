import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectLoanDto {
  @ApiProperty({ description: 'Loan ID', example: 'LOAN-2024-001' })
  @IsString()
  loanId: string;

  @ApiProperty({ description: 'Rejection reason', example: 'Low credit score' })
  @IsString()
  reason: string;
}
