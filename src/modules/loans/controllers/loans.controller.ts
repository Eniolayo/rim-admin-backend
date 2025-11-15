import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { LoansService } from '../services/loans.service';
import {
  CreateLoanDto,
  UpdateLoanDto,
  ApproveLoanDto,
  RejectLoanDto,
  LoanResponseDto,
  LoanStatsDto,
  LoanQueryDto,
} from '../dto';
import { PaginatedResponseDto } from '../../users/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminUser } from '../../../entities/admin-user.entity';

@ApiTags('loans')
@Controller('loans')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiExtraModels(PaginatedResponseDto, LoanResponseDto)
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  @Permissions('loans', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Create a new loan' })
  @ApiResponse({
    status: 201,
    description: 'Loan created',
    type: LoanResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Loan amount exceeds user credit limit, invalid data, or database constraint violation',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - Unexpected error occurred',
  })
  create(
    @Body() createLoanDto: CreateLoanDto,
    @CurrentUser() adminUser: AdminUser,
  ): Promise<LoanResponseDto> {
    return this.loansService.create(createLoanDto, adminUser);
  }

  @Get()
  @Permissions('loans', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get all loans with pagination and filters' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of loans',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(LoanResponseDto) },
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
  findAll(
    @Query() queryDto: LoanQueryDto,
  ): Promise<PaginatedResponseDto<LoanResponseDto>> {
    return this.loansService.findAll(queryDto);
  }

  @Get('stats')
  @Permissions('loans', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get loan statistics' })
  @ApiResponse({
    status: 200,
    description: 'Loan statistics',
    type: LoanStatsDto,
  })
  getStats(): Promise<LoanStatsDto> {
    return this.loansService.getStats();
  }

  @Get('export')
  @Permissions('loans', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Export loans to CSV' })
  @ApiResponse({
    status: 200,
    description: 'CSV file with loan data',
    content: {
      'text/csv': {
        schema: {
          type: 'string',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid query parameters',
  })
  async export(
    @Res() res: Response,
    @Query() queryDto: LoanQueryDto,
  ): Promise<void> {
    const loans = await this.loansService.exportLoans(queryDto);

    // CSV headers
    const headers =
      'Loan ID,User ID,Phone,Email,Amount,Status,Network,Interest Rate,Repayment Period,Due Date,Amount Due,Amount Paid,Outstanding Amount,Created At\n';

    // Format rows
    const rows = loans
      .map(
        (loan) =>
          `${loan.loanId || ''},${loan.userId || ''},${loan.userPhone || ''},${loan.userEmail || ''},${loan.amount || 0},${loan.status || ''},${loan.network || ''},${loan.interestRate || 0},${loan.repaymentPeriod || 0},${loan.dueDate?.toISOString().split('T')[0] || ''},${loan.amountDue || 0},${loan.amountPaid || 0},${loan.outstandingAmount || 0},${loan.createdAt?.toISOString().split('T')[0] || ''}`,
      )
      .join('\n');

    const csv = headers + rows;

    // Set response headers
    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="loans-export-${timestamp}.csv"`,
    );

    res.send(csv);
  }

  @Get(':id')
  @Permissions('loans', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get a loan by ID' })
  @ApiResponse({
    status: 200,
    description: 'Loan details',
    type: LoanResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  findOne(@Param('id') id: string): Promise<LoanResponseDto> {
    return this.loansService.findOne(id);
  }

  @Patch(':id')
  @Permissions('loans', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Update a loan' })
  @ApiResponse({
    status: 200,
    description: 'Loan updated',
    type: LoanResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  update(
    @Param('id') id: string,
    @Body() updateLoanDto: UpdateLoanDto,
  ): Promise<LoanResponseDto> {
    return this.loansService.update(id, updateLoanDto);
  }

  @Post('approve')
  @Permissions('loans', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Approve a loan' })
  @ApiResponse({
    status: 200,
    description: 'Loan approved',
    type: LoanResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  approve(
    @Body() approveLoanDto: ApproveLoanDto,
    @CurrentUser() adminUser: AdminUser,
  ): Promise<LoanResponseDto> {
    return this.loansService.approve(approveLoanDto, adminUser);
  }

  @Post('reject')
  @Permissions('loans', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Reject a loan' })
  @ApiResponse({
    status: 200,
    description: 'Loan rejected',
    type: LoanResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  reject(
    @Body() rejectLoanDto: RejectLoanDto,
    @CurrentUser() adminUser: AdminUser,
  ): Promise<LoanResponseDto> {
    return this.loansService.reject(rejectLoanDto, adminUser);
  }

  @Post(':id/disburse')
  @Permissions('loans', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Disburse a loan' })
  @ApiResponse({
    status: 200,
    description: 'Loan disbursed',
    type: LoanResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  disburse(
    @Param('id') id: string,
    @CurrentUser() adminUser: AdminUser,
  ): Promise<LoanResponseDto> {
    return this.loansService.disburse(id, adminUser);
  }

  @Delete(':id')
  @Permissions('loans', 'delete')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Delete a loan' })
  @ApiResponse({ status: 200, description: 'Loan deleted' })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  remove(@Param('id') id: string): Promise<void> {
    return this.loansService.remove(id);
  }
}
