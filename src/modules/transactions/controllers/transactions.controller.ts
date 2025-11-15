import { Controller, Get, Param, Query, Post, Body, Res, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiExtraModels, getSchemaPath } from '@nestjs/swagger'
import { TransactionsService } from '../services/transactions.service'
import { TransactionResponseDto, TransactionStatsDto } from '../dto/transaction-response.dto'
import { TransactionQueryDto } from '../dto/transaction-query.dto'
import { CreateReconciliationDto } from '../dto/reconcile.dto'
import { PaginatedResponseDto } from '../../users/dto/paginated-response.dto'
import type { Response } from 'express'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../../auth/guards/permissions.guard'
import { Permissions } from '../../auth/decorators/permissions.decorator'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { AdminUser } from '../../../entities/admin-user.entity'

@ApiTags('transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiExtraModels(PaginatedResponseDto, TransactionResponseDto)
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Get()
  @Permissions('transactions', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get all transactions with pagination and filters' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of transactions',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(TransactionResponseDto) },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid query parameters',
  })
  findAll(@Query() query: TransactionQueryDto): Promise<PaginatedResponseDto<TransactionResponseDto>> {
    return this.service.findAll(query)
  }

  @Get('stats')
  @Permissions('transactions', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get transaction statistics' })
  @ApiResponse({ status: 200, type: TransactionStatsDto })
  async stats(): Promise<TransactionStatsDto> {
    return this.service.stats()
  }

  @Get('export')
  @Permissions('transactions', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Export transactions CSV' })
  async export(@Res() res: Response, @Query() query: TransactionQueryDto) {
    // For export, get all transactions by setting a high limit or fetching all pages
    // For now, we'll use the paginated response and access the data array
    const result = await this.service.findAll({ ...query, limit: query.limit ?? 1000, page: 1 })
    const headers = 'Transaction ID,User ID,Phone,Type,Amount,Status,Payment Method,Network,Created At,Reference\n'
    const rows = result.data
      .map(
        t => `${t.transactionId},${t.userId},${t.userPhone},${t.type},${t.amount},${t.status},${t.paymentMethod ?? ''},${t.network ?? ''},${t.createdAt.toISOString()},${t.reference ?? ''}`,
      )
      .join('\n')
    const csv = headers + rows
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"')
    res.send(csv)
  }

  @Get(':id')
  @Permissions('transactions', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get a transaction by ID' })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  findOne(@Param('id') id: string): Promise<TransactionResponseDto> {
    return this.service.findOne(id) as any
  }

  @Post('reconcile')
  @Permissions('transactions', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Reconcile a transaction' })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  reconcile(@Body() body: CreateReconciliationDto, @CurrentUser() admin: AdminUser): Promise<TransactionResponseDto> {
    return this.service.reconcile(body, admin.id) as any
  }
}
