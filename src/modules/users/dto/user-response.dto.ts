import { ApiProperty } from '@nestjs/swagger';
import { UserStatus, RepaymentStatus } from '../../../entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User business ID', example: 'USR-2024-001' })
  userId: string;

  @ApiProperty({ description: 'Phone number' })
  phone: string;

  @ApiProperty({ description: 'Email address', nullable: true })
  email: string | null;

  @ApiProperty({ description: 'Credit score' })
  creditScore: number;

  @ApiProperty({ description: 'Repayment status', enum: RepaymentStatus })
  repaymentStatus: RepaymentStatus;

  @ApiProperty({ description: 'Total amount repaid' })
  totalRepaid: number;

  @ApiProperty({ description: 'User status', enum: UserStatus })
  status: UserStatus;

  @ApiProperty({ description: 'Credit limit' })
  creditLimit: number;

  @ApiProperty({ description: 'Auto limit enabled' })
  autoLimitEnabled: boolean;

  @ApiProperty({ description: 'Total loans', nullable: true })
  totalLoans: number | null;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;
}

export class UserStatsDto {
  @ApiProperty({ description: 'Active users count' })
  activeUsers: number;

  @ApiProperty({ description: 'Inactive users count' })
  inactiveUsers: number;

  @ApiProperty({ description: 'Suspended users count' })
  suspendedUsers: number;

  @ApiProperty({ description: 'New users count' })
  newUsers: number;

  @ApiProperty({ description: 'Total users count' })
  totalUsers: number;

  @ApiProperty({ description: 'Average credit score of all users' })
  avgCreditScore: number;
}
