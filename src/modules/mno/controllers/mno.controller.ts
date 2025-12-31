import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiQuery,
} from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { Counter } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { MnoService } from '../services/mno.service';
import {
  EligibilityRequestDto,
  EligibilityResponseDto,
  FulfillmentRequestDto,
  FulfillmentResponseDto,
  RepaymentRequestDto,
  RepaymentResponseDto,
  LoanEnquiryRequestDto,
  LoanEnquiryResponseDto,
} from '../dto/mno.dto';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { ApiKeyRateLimitGuard } from '../../auth/guards/api-key-rate-limit.guard';
import { OAuth2Guard } from '../../auth/guards/oauth2.guard';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('mno')
@ApiSecurity('api-key')
@ApiSecurity('oauth2', [
  'mno:eligibility',
  'mno:fulfillment',
  'mno:repayment',
  'mno:enquiry',
])
@Controller('mno')
@Public()
@UseGuards(ApiKeyGuard, ApiKeyRateLimitGuard)
export class MnoController {
  constructor(
    private readonly mnoService: MnoService,
    private readonly logger: Logger,
    @InjectMetric('mno_api_calls_total')
    private readonly apiCallsCounter: Counter<string>,
  ) {}

  @Post('eligibility')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eligibility API (MNO Initiated)',
    description:
      "Used to determine how much loan to provide a subscriber. This endpoint is called by the MNO to check a subscriber's eligibility for a loan.",
  })
  @ApiResponse({
    status: 200,
    description: 'Eligibility check completed successfully',
    type: EligibilityResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid API token',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded (1000 requests/minute per API key)',
  })
  async checkEligibility(
    @Body() body: EligibilityRequestDto,
  ): Promise<EligibilityResponseDto> {
    this.logger.log(
      {
        phoneNumber: body.phoneNumber,
        network: body.network,
        requestId: body.requestId,
      },
      'Eligibility API called',
    );

    this.apiCallsCounter.inc({ method: 'checkEligibility' });
    return this.mnoService.checkEligibility(body);
  }

  @Post('fulfillment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Fulfillment API (MNO Initiated)',
    description:
      'Used to notify lender of how much has been provided to a subscriber. This endpoint is called by the MNO after a loan has been disbursed to the subscriber.',
  })
  @ApiResponse({
    status: 200,
    description: 'Fulfillment notification processed successfully',
    type: FulfillmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid API token',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded (1000 requests/minute per API key)',
  })
  async processFulfillment(
    @Body() body: FulfillmentRequestDto,
  ): Promise<FulfillmentResponseDto> {
    this.logger.log(
      {
        phoneNumber: body.phoneNumber,
        loanId: body.loanId,
        amount: body.amount,
        requestId: body.requestId,
      },
      'Fulfillment API called',
    );

    return this.mnoService.processFulfillment(body);
  }

  @Post('repayment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Repayment API (MNO Initiated)',
    description:
      'Used to notify lender of repayment of a loan. This endpoint is called by the MNO when a subscriber repays a loan.',
  })
  @ApiResponse({
    status: 200,
    description: 'Repayment notification processed successfully',
    type: RepaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid API token',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded (1000 requests/minute per API key)',
  })
  async processRepayment(
    @Body() body: RepaymentRequestDto,
  ): Promise<RepaymentResponseDto> {
    this.logger.log(
      {
        phoneNumber: body.phoneNumber,
        loanId: body.loanId,
        amount: body.amount,
        requestId: body.requestId,
      },
      'Repayment API called',
    );

    return this.mnoService.processRepayment(body);
  }

  @Get('loan-enquiry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Loan Enquiry API (Lender Initiated)',
    description:
      'Used by lender to check outstanding loan amount for a subscriber. This endpoint can be called by the lender to query loan information.',
  })
  @ApiQuery({
    name: 'phoneNumber',
    required: true,
    description: 'Subscriber phone number',
    example: '+2348012345678',
  })
  @ApiQuery({
    name: 'network',
    required: false,
    description: 'Network identifier (optional filter)',
    enum: ['MTN', 'Airtel', 'Glo', '9mobile'],
  })
  @ApiResponse({
    status: 200,
    description: 'Loan enquiry completed successfully',
    type: LoanEnquiryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid API token',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded (1000 requests/minute per API key)',
  })
  async enquiryLoan(
    @Query() query: LoanEnquiryRequestDto,
  ): Promise<LoanEnquiryResponseDto> {
    this.logger.log(
      {
        phoneNumber: query.phoneNumber,
        network: query.network,
      },
      'Loan Enquiry API called',
    );

    return this.mnoService.enquiryLoan(query);
  }
}
