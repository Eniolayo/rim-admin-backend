import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoanStatus, Network } from '../../../entities/loan.entity';

export class LoanResponseDto {
  @ApiProperty({ description: 'Loan ID' })
  id: string;

  @ApiProperty({ description: 'Loan business ID', example: 'LOAN-2024-001' })
  loanId: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'User phone' })
  userPhone: string;

  @ApiPropertyOptional({ description: 'User email' })
  userEmail: string | null;

  @ApiProperty({ description: 'Loan amount' })
  amount: number;

  @ApiProperty({ description: 'Loan status', enum: LoanStatus })
  status: LoanStatus;

  @ApiProperty({ description: 'Network', enum: Network })
  network: Network;

  @ApiProperty({ description: 'Interest rate percentage' })
  interestRate: number;

  @ApiProperty({ description: 'Repayment period in days' })
  repaymentPeriod: number;

  @ApiProperty({ description: 'Due date' })
  dueDate: Date;

  @ApiProperty({ description: 'Amount due' })
  amountDue: number;

  @ApiProperty({ description: 'Amount paid' })
  amountPaid: number;

  @ApiProperty({ description: 'Outstanding amount' })
  outstandingAmount: number;

  @ApiPropertyOptional({ description: 'Approved at' })
  approvedAt: Date | null;

  @ApiPropertyOptional({ description: 'Approved by (admin ID)' })
  approvedBy: string | null;

  @ApiPropertyOptional({ description: 'Rejected at' })
  rejectedAt: Date | null;

  @ApiPropertyOptional({ description: 'Rejected by (admin ID)' })
  rejectedBy: string | null;

  @ApiPropertyOptional({ description: 'Rejection reason' })
  rejectionReason: string | null;

  @ApiPropertyOptional({ description: 'Disbursed at' })
  disbursedAt: Date | null;

  @ApiPropertyOptional({ description: 'Completed at' })
  completedAt: Date | null;

  @ApiPropertyOptional({ description: 'Defaulted at' })
  defaultedAt: Date | null;

  @ApiPropertyOptional({ description: 'Telco reference' })
  telcoReference: string | null;

  @ApiPropertyOptional({ description: 'Metadata', type: 'object' })
  metadata: Record<string, unknown> | null;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;
}

export class LoanStatsDto {
  @ApiProperty({ description: 'Total loans count' })
  totalLoans: number;

  @ApiProperty({ description: 'Total loan amount' })
  totalLoanAmount: number;

  @ApiProperty({ description: 'Pending loans count' })
  pendingLoans: number;

  @ApiProperty({ description: 'Approved loans count' })
  approvedLoans: number;

  @ApiProperty({ description: 'Outstanding loans count' })
  outstandingLoans: number;

  @ApiProperty({ description: 'Defaulted loans count' })
  defaultedLoans: number;

  @ApiProperty({ description: 'Total outstanding amount' })
  totalOutstanding: number;

  @ApiProperty({ description: 'Total repaid amount' })
  totalRepaid: number;

  @ApiProperty({ description: 'Default rate percentage' })
  defaultRate: number;

  @ApiProperty({ description: 'Repayment rate percentage' })
  repaymentRate: number;

  @ApiProperty({ description: 'Average loan amount' })
  averageLoanAmount: number;

  @ApiProperty({ description: 'Today loans count' })
  todayLoans: number;

  @ApiProperty({ description: 'Today loan amount' })
  todayAmount: number;
}
