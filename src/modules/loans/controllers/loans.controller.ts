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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { LoansService } from '../services/loans.service';
import {
  CreateLoanDto,
  UpdateLoanDto,
  ApproveLoanDto,
  RejectLoanDto,
  LoanResponseDto,
  LoanStatsDto,
} from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminUser } from '../../../entities/admin-user.entity';
import { LoanStatus, Network } from '../../../entities/loan.entity';

@ApiTags('loans')
@Controller('loans')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new loan' })
  @ApiResponse({
    status: 201,
    description: 'Loan created',
    type: LoanResponseDto,
  })
  create(
    @Body() createLoanDto: CreateLoanDto,
    @CurrentUser() adminUser: AdminUser,
  ): Promise<LoanResponseDto> {
    return this.loansService.create(createLoanDto, adminUser);
  }

  @Get()
  @ApiOperation({ summary: 'Get all loans' })
  @ApiQuery({ name: 'status', required: false, enum: LoanStatus })
  @ApiQuery({ name: 'network', required: false, enum: Network })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({
    status: 200,
    description: 'List of loans',
    type: [LoanResponseDto],
  })
  findAll(
    @Query('status') status?: LoanStatus,
    @Query('network') network?: Network,
    @Query('search') search?: string,
  ): Promise<LoanResponseDto[]> {
    return this.loansService.findAll({ status, network, search });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get loan statistics' })
  @ApiResponse({
    status: 200,
    description: 'Loan statistics',
    type: LoanStatsDto,
  })
  getStats(): Promise<LoanStatsDto> {
    return this.loansService.getStats();
  }

  @Get(':id')
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
  @ApiOperation({ summary: 'Delete a loan' })
  @ApiResponse({ status: 200, description: 'Loan deleted' })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  remove(@Param('id') id: string): Promise<void> {
    return this.loansService.remove(id);
  }
}
