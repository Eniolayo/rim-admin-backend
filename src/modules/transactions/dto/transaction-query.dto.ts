import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsEnum, IsNumber } from 'class-validator'
import { TransactionType, TransactionStatus, PaymentMethod } from '../../../entities/transaction.entity'

export class TransactionQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  network?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFrom?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateTo?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  amountMin?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  amountMax?: number
}

