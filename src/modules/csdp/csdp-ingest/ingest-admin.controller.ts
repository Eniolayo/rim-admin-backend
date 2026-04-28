import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MfaConfirmedGuard } from '../../auth/guards/mfa-confirmed.guard';
import { IngestService } from './ingest.service';

/**
 * Admin-only ingest controller — protected by the global JWT + 2FA guards
 * (applied by the app module). The destructive replay endpoint additionally
 * requires the per-request MFA confirmation header; read-only list/detail
 * endpoints do not.
 *
 * Note: the public, API-key-guarded read endpoints in IngestController are
 * left intact for external (Airtel-side) callers; the admin UI uses these
 * JWT-protected variants instead.
 */
@Controller('csdp/admin/ingest')
export class IngestAdminController {
  constructor(private readonly service: IngestService) {}

  @Get('batches')
  async listBatches(
    @Query('source') source?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.listBatchesPaginated({
      source,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      dateFrom,
      dateTo,
    });
  }

  @Get('batches/:id')
  async getBatch(@Param('id') id: string) {
    const batch = await this.service.getBatch(id);
    if (!batch) {
      throw new NotFoundException(`Batch ${id} not found`);
    }
    return batch;
  }

  @Post('batches/:id/replay')
  @UseGuards(MfaConfirmedGuard)
  async replay(@Param('id') id: string, @Req() req: any) {
    await this.service.replay(id, req.user?.id ?? 'system');
    return { ok: true };
  }
}
