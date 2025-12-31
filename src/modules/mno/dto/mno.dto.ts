import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsUUID,
  Min,
  Matches,
} from 'class-validator';
import { Network } from '../../../entities/loan.entity';

/**
 * Eligibility API Request (MNO Initiated)
 * Used to determine how much loan to provide a subscriber
 */
export class EligibilityRequestDto {
  @ApiProperty({
    description: 'Subscriber phone number',
    example: '+2348012345678',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Network identifier',
    enum: Network,
    example: Network.AIRTEL,
  })
  @IsEnum(Network)
  @IsNotEmpty()
  network: Network;

  @ApiPropertyOptional({
    description: 'Request ID for idempotency (optional)',
    example: 'req-1234567890',
  })
  @IsString()
  @IsOptional()
  requestId?: string;
}

/**
 * Eligibility API Response
 */
export class EligibilityResponseDto {
  @ApiProperty({ description: 'Response status', example: 'success' })
  status: 'success' | 'error';

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiPropertyOptional({
    description: 'Eligible loan amount in NGN',
    example: 5000,
  })
  eligibleAmount?: number;

  @ApiPropertyOptional({
    description: 'Subscriber credit score',
    example: 1500,
  })
  creditScore?: number;

  @ApiPropertyOptional({ description: 'Currency code', example: 'NGN' })
  currency?: string;

  @ApiPropertyOptional({ description: 'Error code if status is error' })
  errorCode?: string;

  @ApiPropertyOptional({ description: 'Request ID for tracking' })
  requestId?: string;
}

/**
 * Fulfillment API Request (MNO Initiated)
 * Used to notify lender of how much has been provided to a subscriber
 */
export class FulfillmentRequestDto {
  @ApiProperty({ description: 'Subscriber phone number' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format',
  })
  phoneNumber: string;

  @ApiProperty({ description: 'Loan ID from eligibility response' })
  @IsUUID()
  @IsNotEmpty()
  loanId: string;

  @ApiProperty({ description: 'Amount disbursed to subscriber' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Network identifier', enum: Network })
  @IsEnum(Network)
  @IsNotEmpty()
  network: Network;

  @ApiPropertyOptional({ description: 'Transaction reference from MNO' })
  @IsString()
  @IsOptional()
  transactionReference?: string;

  @ApiPropertyOptional({ description: 'Disbursement timestamp (ISO 8601)' })
  @IsString()
  @IsOptional()
  disbursedAt?: string;

  @ApiPropertyOptional({ description: 'Request ID for idempotency' })
  @IsString()
  @IsOptional()
  requestId?: string;
}

/**
 * Fulfillment API Response
 */
export class FulfillmentResponseDto {
  @ApiProperty({ description: 'Response status', example: 'success' })
  status: 'success' | 'error';

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiPropertyOptional({ description: 'Loan ID' })
  loanId?: string;

  @ApiPropertyOptional({ description: 'Error code if status is error' })
  errorCode?: string;

  @ApiPropertyOptional({ description: 'Request ID for tracking' })
  requestId?: string;
}

/**
 * Repayment API Request (MNO Initiated)
 * Used to notify lender of repayment of a loan
 */
export class RepaymentRequestDto {
  @ApiProperty({ description: 'Subscriber phone number' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format',
  })
  phoneNumber: string;

  @ApiProperty({ description: 'Loan ID' })
  @IsUUID()
  @IsNotEmpty()
  loanId: string;

  @ApiProperty({ description: 'Repayment amount' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Network identifier', enum: Network })
  @IsEnum(Network)
  @IsNotEmpty()
  network: Network;

  @ApiPropertyOptional({ description: 'Transaction reference from MNO' })
  @IsString()
  @IsOptional()
  transactionReference?: string;

  @ApiPropertyOptional({ description: 'Repayment timestamp (ISO 8601)' })
  @IsString()
  @IsOptional()
  repaidAt?: string;

  @ApiPropertyOptional({ description: 'Request ID for idempotency' })
  @IsString()
  @IsOptional()
  requestId?: string;
}

/**
 * Repayment API Response
 */
export class RepaymentResponseDto {
  @ApiProperty({ description: 'Response status', example: 'success' })
  status: 'success' | 'error';

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiPropertyOptional({ description: 'Transaction ID' })
  transactionId?: string;

  @ApiPropertyOptional({ description: 'Loan ID' })
  loanId?: string;

  @ApiPropertyOptional({
    description: 'Outstanding loan amount after repayment',
  })
  outstandingAmount?: number;

  @ApiPropertyOptional({ description: 'Error code if status is error' })
  errorCode?: string;

  @ApiPropertyOptional({ description: 'Request ID for tracking' })
  requestId?: string;
}

/**
 * Loan Enquiry API Request (Lender Initiated)
 * Used by lender to check outstanding loan amount
 */
export class LoanEnquiryRequestDto {
  @ApiProperty({ description: 'Subscriber phone number' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format',
  })
  phoneNumber: string;

  @ApiPropertyOptional({ description: 'Network identifier', enum: Network })
  @IsEnum(Network)
  @IsOptional()
  network?: Network;
}

/**
 * Loan Enquiry API Response
 */
export class LoanEnquiryResponseDto {
  @ApiProperty({ description: 'Response status', example: 'success' })
  status: 'success' | 'error';

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiPropertyOptional({ description: 'Subscriber phone number' })
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Array of active loans with outstanding amounts',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        loanId: { type: 'string' },
        amount: { type: 'number' },
        outstandingAmount: { type: 'number' },
        dueDate: { type: 'string', format: 'date-time' },
        status: { type: 'string' },
      },
    },
  })
  loans?: Array<{
    loanId: string;
    amount: number;
    outstandingAmount: number;
    dueDate: string;
    status: string;
  }>;

  @ApiPropertyOptional({
    description: 'Total outstanding amount across all loans',
  })
  totalOutstandingAmount?: number;

  @ApiPropertyOptional({ description: 'Currency code', example: 'NGN' })
  currency?: string;

  @ApiPropertyOptional({ description: 'Error code if status is error' })
  errorCode?: string;
}
