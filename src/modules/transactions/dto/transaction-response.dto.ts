import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { TransactionStatus, TransactionType, PaymentMethod } from '../../../entities/transaction.entity'

export class TransactionResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  transactionId: string

  @ApiProperty()
  userId: string

  @ApiProperty()
  userPhone: string

  @ApiPropertyOptional()
  userEmail: string | null

  @ApiProperty({ enum: TransactionType })
  type: TransactionType

  @ApiProperty()
  amount: number

  @ApiProperty({ enum: TransactionStatus })
  status: TransactionStatus

  @ApiPropertyOptional({ enum: PaymentMethod })
  paymentMethod: PaymentMethod | null

  @ApiPropertyOptional()
  description: string | null

  @ApiPropertyOptional()
  reference: string | null

  @ApiPropertyOptional()
  provider: string | null

  @ApiPropertyOptional()
  network: string | null

  @ApiPropertyOptional()
  reconciledAt: Date | null

  @ApiPropertyOptional()
  reconciledBy: string | null

  @ApiPropertyOptional()
  notes: string | null

  @ApiPropertyOptional({ type: 'object' })
  metadata: Record<string, unknown> | null

  @ApiProperty()
  createdAt: Date

  @ApiProperty()
  updatedAt: Date
}

export class TransactionStatsDto {
  @ApiProperty()
  totalTransactions: number

  @ApiProperty()
  totalAmount: number

  @ApiProperty()
  airtimeTransactions: number

  @ApiProperty()
  repaymentTransactions: number

  @ApiProperty()
  completedTransactions: number

  @ApiProperty()
  pendingTransactions: number

  @ApiProperty()
  failedTransactions: number

  @ApiProperty()
  todayTransactions: number

  @ApiProperty()
  todayAmount: number
}

