import {
  Body,
  Controller,
  Post,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
} from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import {
  UssdLoanOfferRequestDto,
  UssdLoanApproveRequestDto,
} from '../dto/ussd-loan.dto';
import { UssdLoansService } from '../services/ussd-loans.service';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { ApiKeyRateLimitGuard } from '../../auth/guards/api-key-rate-limit.guard';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('ussd-loans')
@ApiSecurity('api-key')
@Controller('ussd')
@Public()
@UseGuards(ApiKeyGuard, ApiKeyRateLimitGuard)
export class UssdLoansController {
  constructor(
    private readonly ussdLoansService: UssdLoansService,
    private readonly logger: Logger,
  ) {}

  @Post('loan-offer')
  @ApiOperation({ summary: 'USSD loan offer callback' })
  @ApiResponse({
    status: 200,
    description: 'Loan offers returned successfully',
  })
  @ApiResponse({ status: 401, description: 'Invalid API token' })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded (1000 requests/minute per API key)',
  })
  @ApiResponse({ status: 404, description: 'User not found or not eligible' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async loanOffer(
    @Body() body: UssdLoanOfferRequestDto,
  ): Promise<string | unknown> {
    this.logger.log(
      `loan-offer endpoint called - phoneNumber: ${body.phoneNumber}, sessionId: ${body.sessionId}, responseType: ${body.responseType}`,
    );

    try {
      const result = await this.ussdLoansService.handleLoanOffer(body);

      this.logger.log(
        `loan-offer endpoint completed successfully - phoneNumber: ${body.phoneNumber}, sessionId: ${body.sessionId}, responseType: ${body.responseType}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `loan-offer endpoint error - phoneNumber: ${body.phoneNumber}, sessionId: ${body.sessionId}, error: ${error instanceof Error ? error.message : String(error)}`,
      );

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
  @ApiResponse({
    status: 200,
    description: 'Loan approved and queued for disbursement',
  })
  @ApiResponse({ status: 401, description: 'Invalid API token' })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded (1000 requests/minute per API key)',
  })
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
