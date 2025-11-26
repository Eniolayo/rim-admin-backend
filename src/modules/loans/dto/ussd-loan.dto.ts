import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  IsNumber,
} from 'class-validator';

export type UssdResponseType = 'text' | 'json';

export class UssdLoanOfferRequestDto {
  @ApiProperty({ description: 'Phone number of the user' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiPropertyOptional({ description: 'Telco session identifier' })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Network identifier (e.g. mtn, airtel)' })
  @IsString()
  @IsOptional()
  network?: string;

  @ApiPropertyOptional({ description: 'Channel (e.g. USSD)' })
  @IsString()
  @IsOptional()
  channel?: string;

  @ApiPropertyOptional({
    description: 'Response type, defaults to text',
    enum: ['text', 'json'],
  })
  @IsString()
  @IsIn(['text', 'json'])
  @IsOptional()
  responseType?: UssdResponseType;
}

export interface UssdLoanOfferJson {
  status: 'success' | 'error';
  type: 'loan-offer';
  sessionId: string;
  phoneNumber: string;
  userId?: string;
  offers?: Array<{
    option: number;
    amount: number;
    currency: string;
    interestRate: number;
    repaymentPeriodDays: number;
  }>;
  metadata?: {
    eligibleAmount: number;
    network?: string;
  };
  code?: string;
  message?: string;
}

export class UssdLoanApproveRequestDto {
  @ApiProperty({ description: 'Phone number of the user' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiPropertyOptional({ description: 'Telco session identifier' })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Selected option index (1-based) returned from loan-offer',
  })
  @IsString()
  @IsOptional()
  selectedOption?: string;

  @ApiPropertyOptional({
    description: 'Selected loan amount',
  })
  @IsNumber()
  @IsOptional()
  selectedAmount?: number;

  @ApiPropertyOptional({ description: 'Network identifier (e.g. mtn, airtel)' })
  @IsString()
  @IsOptional()
  network?: string;

  @ApiPropertyOptional({
    description: 'Response type, defaults to text',
    enum: ['text', 'json'],
  })
  @IsString()
  @IsIn(['text', 'json'])
  @IsOptional()
  responseType?: UssdResponseType;
}

export interface UssdLoanApproveJson {
  status: 'processing' | 'success' | 'error';
  type: 'loan-approve';
  sessionId: string;
  phoneNumber: string;
  loan?: {
    id: string;
    loanId: string;
    userId: string;
    amount: number;
    status: string;
  };
  code?: string;
  message: string;
}


