import { ApiProperty } from '@nestjs/swagger';
import { LoanStatsDto } from '../../loans/dto/loan-response.dto';
import { UserStatsDto } from '../../users/dto/user-response.dto';
import { TransactionStatsDto } from '../../transactions/dto/transaction-response.dto';

export class DashboardStatsDto {
  @ApiProperty({ description: 'Loan statistics', type: LoanStatsDto })
  loanStats: LoanStatsDto;

  @ApiProperty({ description: 'User statistics', type: UserStatsDto })
  userStats: UserStatsDto;

  @ApiProperty({ description: 'Transaction statistics', type: TransactionStatsDto })
  transactionStats: TransactionStatsDto;
}

