import {
  Body,
  Controller,
  Post,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import {
  UssdLoanOfferRequestDto,
  UssdLoanApproveRequestDto,
} from '../dto/ussd-loan.dto';
import { UssdLoansService } from '../services/ussd-loans.service';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';

@ApiTags('ussd-loans')
@ApiSecurity('api-key')
@Throttle({ default: { limit: 1000, ttl: 60000 } })
@Controller('ussd')
@UseGuards(ApiKeyGuard)
export class UssdLoansController {
  constructor(private readonly ussdLoansService: UssdLoansService) {}

  @Post('loan-offer')
  @ApiOperation({ summary: 'USSD loan offer callback' })
  @ApiResponse({ status: 200, description: 'Loan offers returned successfully' })
  @ApiResponse({ status: 401, description: 'Invalid API key or secret' })
  @ApiResponse({ status: 404, description: 'User not found or not eligible' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async loanOffer(
    @Body() body: UssdLoanOfferRequestDto,
  ): Promise<string | unknown> {
    try {
      return await this.ussdLoansService.handleLoanOffer(body);
    } catch (error) {
      // NestJS will automatically handle HttpException and return proper status codes
      // For text responses, exceptions are already handled in the service
      if (error instanceof HttpException) {
        throw error;
      }
      // For unexpected errors, wrap in 500
      throw new HttpException(
        'An error occurred processing your request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('loan-approve')
  @ApiOperation({ summary: 'USSD loan approve callback' })
  @ApiResponse({ status: 200, description: 'Loan approved and queued for disbursement' })
  @ApiResponse({ status: 401, description: 'Invalid API key or secret' })
  @ApiResponse({ status: 404, description: 'User not found or not eligible' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async loanApprove(
    @Body() body: UssdLoanApproveRequestDto,
  ): Promise<string | unknown> {
    try {
      return await this.ussdLoansService.handleLoanApprove(body);
    } catch (error) {
      // NestJS will automatically handle HttpException and return proper status codes
      // For text responses, exceptions are already handled in the service
      if (error instanceof HttpException) {
        throw error;
      }
      // For unexpected errors, wrap in 500
      throw new HttpException(
        'An error occurred processing your request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}


