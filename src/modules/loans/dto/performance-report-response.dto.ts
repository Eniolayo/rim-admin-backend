import { ApiProperty } from '@nestjs/swagger';
import { LoanStatus, Network } from '../../../entities/loan.entity';

class PeriodDto {
  @ApiProperty({ description: 'Start date of the report period' })
  start: string;

  @ApiProperty({ description: 'End date of the report period' })
  end: string;
}

class NetworkBreakdownDto {
  @ApiProperty({ enum: Network, description: 'Network name' })
  network: Network;

  @ApiProperty({ description: 'Number of loans for this network' })
  count: number;

  @ApiProperty({ description: 'Total loan amount for this network' })
  amount: number;

  @ApiProperty({ description: 'Default rate percentage for this network' })
  defaultRate: number;
}

class StatusBreakdownDto {
  @ApiProperty({ enum: LoanStatus, description: 'Loan status' })
  status: LoanStatus;

  @ApiProperty({ description: 'Number of loans with this status' })
  count: number;

  @ApiProperty({ description: 'Total loan amount for this status' })
  amount: number;
}

export class PerformanceReportResponseDto {
  @ApiProperty({ type: PeriodDto, description: 'Report period' })
  period: PeriodDto;

  @ApiProperty({ description: 'Total number of loans in the period' })
  totalLoans: number;

  @ApiProperty({ description: 'Total amount disbursed' })
  totalDisbursed: number;

  @ApiProperty({ description: 'Total amount repaid' })
  totalRepaid: number;

  @ApiProperty({ description: 'Total outstanding amount' })
  totalOutstanding: number;

  @ApiProperty({ description: 'Default rate percentage' })
  defaultRate: number;

  @ApiProperty({ description: 'Repayment rate percentage' })
  repaymentRate: number;

  @ApiProperty({ description: 'Average loan amount' })
  averageLoanAmount: number;

  @ApiProperty({ description: 'Average repayment time in days' })
  averageRepaymentTime: number;

  @ApiProperty({
    type: [NetworkBreakdownDto],
    description: 'Breakdown by network',
  })
  networkBreakdown: NetworkBreakdownDto[];

  @ApiProperty({
    type: [StatusBreakdownDto],
    description: 'Breakdown by status',
  })
  statusBreakdown: StatusBreakdownDto[];
}

