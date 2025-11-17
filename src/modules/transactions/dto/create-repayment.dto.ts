import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  Min,
  Matches,
} from 'class-validator';

export class CreateRepaymentDto {
  @ApiProperty({
    description: 'User phone number',
    example: '08012345678',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{10,15}$/, {
    message: 'Phone number must be 10-15 digits',
  })
  userPhone: string;

  @ApiProperty({
    description: 'Repayment amount',
    example: 500.0,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @IsNotEmpty()
  amount: number;

  @ApiPropertyOptional({
    description: 'Loan ID to link this repayment to. If not provided, will find active loan for user.',
    example: 'LOAN-2024-001',
  })
  @IsString()
  @IsOptional()
  loanId?: string;

  @ApiPropertyOptional({
    description: 'Payment reference number from telecom provider',
    example: 'REF-123456789',
  })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional({
    description: 'Payment method',
    example: 'wallet',
    enum: ['bank_transfer', 'card', 'wallet', 'cash'],
  })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: 'Telecom network',
    example: 'MTN',
    enum: ['MTN', 'Airtel', 'Glo', '9mobile'],
  })
  @IsString()
  @IsOptional()
  network?: string;

  @ApiPropertyOptional({
    description: 'Additional notes or description',
    example: 'Repayment via mobile wallet',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
