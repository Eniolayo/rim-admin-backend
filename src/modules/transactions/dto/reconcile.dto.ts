import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger'
import { TransactionStatus } from '../../../entities/transaction.entity'
import { IsOptional, IsString, IsNumber, IsEnum, IsNotEmpty } from 'class-validator'

export class CreateReconciliationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  transactionId: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  amount?: number

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string
}

