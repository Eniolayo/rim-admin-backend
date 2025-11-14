import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveLoanDto {
  @ApiProperty({ description: 'Loan ID', example: 'LOAN-2024-001' })
  @IsString()
  loanId: string;

  @ApiPropertyOptional({ description: 'Approval notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
