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
