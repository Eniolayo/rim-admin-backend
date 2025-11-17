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
import { UsersService } from '../services/users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  UserStatsDto,
  UserQueryDto,
  PaginatedResponseDto,
} from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { UserStatus } from '../../../entities/user.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiExtraModels(PaginatedResponseDto, UserResponseDto)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions('users', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({
    status: 201,
    description: 'User created',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input or duplicate phone number',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Permissions('users', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get all users with pagination and filters' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of users',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(UserResponseDto) },
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
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  findAll(
    @Query() queryDto: UserQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    return this.usersService.findAll(queryDto);
  }

  @Get('stats')
  @Permissions('users', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({
    status: 200,
    description: 'User statistics',
    type: UserStatsDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  getStats(): Promise<UserStatsDto> {
    return this.usersService.getStats();
  }

  @Get('export')
  @Permissions('users', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Export users to CSV' })
  @ApiResponse({
    status: 200,
    description: 'CSV file with user data',
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
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async export(
    @Res() res: Response,
    @Query() queryDto: UserQueryDto,
  ): Promise<void> {
    const users = await this.usersService.exportUsers(queryDto);

    // CSV headers
    const headers =
      'User ID,Phone,Email,Credit Score,Total Repaid,Status,Repayment Status,Credit Limit\n';

    // Format rows
    const rows = users
      .map(
        (user) =>
          `${user.userId || ''},${user.phone || ''},${user.email || ''},${user.creditScore || 0},${user.totalRepaid || 0},${user.status || ''},${user.repaymentStatus || ''},${user.creditLimit || 0}`,
      )
      .join('\n');

    const csv = headers + rows;

    // Set response headers
    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="users-export-${timestamp}.csv"`,
    );

    res.send(csv);
  }

  @Get(':id')
  @Permissions('users', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({
    summary: 'Get a user by ID',
    description: 'Get user details by UUID or custom userId (e.g., USR-2025-002)'
  })
  @ApiResponse({
    status: 200,
    description: 'User details',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid user ID format'
  })
  @ApiResponse({
    status: 404,
    description: 'User not found'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    try {
      return await this.usersService.findOne(id);
    } catch (error) {
      // Re-throw HTTP exceptions (they're already properly formatted)
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Log unexpected errors
      throw new BadRequestException(
        'An error occurred while retrieving the user. Please try again later.',
      );
    }
  }

  @Patch(':id')
  @Permissions('users', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({
    status: 200,
    description: 'User updated',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/status')
  @Permissions('users', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Update user status' })
  @ApiResponse({
    status: 200,
    description: 'Status updated',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: UserStatus,
  ): Promise<UserResponseDto> {
    return this.usersService.updateStatus(id, status);
  }

  @Patch(':id/credit-limit')
  @Permissions('users', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Update user credit limit' })
  @ApiResponse({
    status: 200,
    description: 'Credit limit updated',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  updateCreditLimit(
    @Param('id') id: string,
    @Body('creditLimit') creditLimit: number,
    @Body('autoLimitEnabled') autoLimitEnabled?: boolean,
  ): Promise<UserResponseDto> {
    return this.usersService.updateCreditLimit(
      id,
      creditLimit,
      autoLimitEnabled,
    );
  }

  @Post('bulk/status')
  @Permissions('users', 'write')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Bulk update user status' })
  @ApiResponse({
    status: 200,
    description: 'Statuses updated',
    type: [UserResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  bulkUpdateStatus(
    @Body('ids') ids: string[],
    @Body('status') status: UserStatus,
  ): Promise<UserResponseDto[]> {
    return this.usersService.bulkUpdateStatus(ids, status);
  }

  @Get(':id/eligible-loan-amount')
  @Permissions('users', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({
    summary: 'Get eligible loan amount for user based on credit score',
  })
  @ApiResponse({
    status: 200,
    description: 'Eligible loan amount',
    schema: {
      type: 'object',
      properties: {
        eligibleAmount: { type: 'number' },
        creditScore: { type: 'number' },
        isFirstTimeUser: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  getEligibleLoanAmount(@Param('id') id: string) {
    return this.usersService.getEligibleLoanAmount(id);
  }

  @Get(':id/credit-score/history')
  @Permissions('users', 'read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get credit score history for a user' })
  @ApiResponse({
    status: 200,
    description: 'Credit score history',
    type: 'array',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  getCreditScoreHistory(@Param('id') id: string) {
    return this.usersService.getCreditScoreHistory(id);
  }

  @Delete(':id')
  @Permissions('users', 'delete')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.usersService.remove(id);
  }
}
