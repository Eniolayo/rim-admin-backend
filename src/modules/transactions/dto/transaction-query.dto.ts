import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsEnum, IsNumber, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
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

  @ApiPropertyOptional({
    description: 'Page number',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number
}

