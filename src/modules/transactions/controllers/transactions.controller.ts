import { Controller, Get, Param, Query, Post, Body, Res, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { TransactionsService } from '../services/transactions.service'
import { TransactionResponseDto, TransactionStatsDto } from '../dto/transaction-response.dto'
import { TransactionQueryDto } from '../dto/transaction-query.dto'
import { CreateReconciliationDto } from '../dto/reconcile.dto'
import type { Response } from 'express'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { AdminUser } from '../../../entities/admin-user.entity'

@ApiTags('transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get transactions' })
  @ApiResponse({ status: 200, type: [TransactionResponseDto] })
  findAll(@Query() query: TransactionQueryDto): Promise<TransactionResponseDto[]> {
    return this.service.findAll(query) as any
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get transaction statistics' })
  @ApiResponse({ status: 200, type: TransactionStatsDto })
  stats(): Promise<TransactionStatsDto> {
    return this.service.stats() as any
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a transaction by ID' })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  findOne(@Param('id') id: string): Promise<TransactionResponseDto> {
    return this.service.findOne(id) as any
  }

  @Post('reconcile')
  @ApiOperation({ summary: 'Reconcile a transaction' })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  reconcile(@Body() body: CreateReconciliationDto, @CurrentUser() admin: AdminUser): Promise<TransactionResponseDto> {
    return this.service.reconcile(body, admin.id) as any
  }

  @Get('export')
  @ApiOperation({ summary: 'Export transactions CSV' })
  async export(@Res() res: Response, @Query() query: TransactionQueryDto) {
    const list = await this.service.findAll(query)
    const headers = 'Transaction ID,User ID,Phone,Type,Amount,Status,Payment Method,Network,Created At,Reference\n'
    const rows = list
      .map(
        t => `${t.transactionId},${t.userId},${t.userPhone},${t.type},${t.amount},${t.status},${t.paymentMethod ?? ''},${t.network ?? ''},${t.createdAt.toISOString()},${t.reference ?? ''}`,
      )
      .join('\n')
    const csv = headers + rows
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"')
    res.send(csv)
  }
}
