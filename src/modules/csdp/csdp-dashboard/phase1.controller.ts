import { Controller, Get, Param, Query } from '@nestjs/common';
import { Phase1DashboardService } from './phase1.service';

@Controller('csdp/dashboard')
export class CsdpDashboardController {
  constructor(private readonly service: Phase1DashboardService) {}

  @Get('counters')
  counters() {
    return this.service.getCounters();
  }

  @Get('teamwee-health')
  teamweeHealth() {
    return this.service.getTeamweeHealth();
  }

  @Get('queues')
  queues() {
    return this.service.getQueueDepths();
  }

  @Get('ingest/recent')
  recentBatches(@Query('limit') limit?: string) {
    return this.service.getRecentBatches(limit ? Number(limit) : 20);
  }

  @Get('investigate/:msisdn')
  investigate(@Param('msisdn') msisdn: string) {
    return this.service.investigateMsisdn(msisdn);
  }
}
