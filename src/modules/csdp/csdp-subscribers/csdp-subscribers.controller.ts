import { Controller, Get, Param, Query } from '@nestjs/common';
import { CsdpSubscribersService } from './csdp-subscribers.service';

@Controller('csdp/subscribers')
export class CsdpSubscribersController {
  constructor(private readonly service: CsdpSubscribersService) {}

  @Get(':msisdn')
  async investigate(
    @Param('msisdn') msisdn: string,
    @Query('logs') logsLimit?: string,
    @Query('loans') loansLimit?: string,
  ) {
    return this.service.investigate(msisdn, {
      logsLimit: logsLimit ? Number(logsLimit) : undefined,
      loansLimit: loansLimit ? Number(loansLimit) : undefined,
    });
  }
}
