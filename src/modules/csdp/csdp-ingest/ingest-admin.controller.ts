import {
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MfaConfirmedGuard } from '../../auth/guards/mfa-confirmed.guard';
import { IngestService } from './ingest.service';

/**
 * Admin-only ingest controller — protected by the global JWT + 2FA guards
 * (applied by the app module) plus the MFA confirmation guard.
 * Does NOT use @Public() so JwtAuthGuard + AdminTwoFactorGuard still run.
 */
@Controller('csdp/ingest')
@UseGuards(MfaConfirmedGuard)
export class IngestAdminController {
  constructor(private readonly service: IngestService) {}

  @Post('batches/:id/replay')
  async replay(@Param('id') id: string, @Req() req: any) {
    await this.service.replay(id, req.user?.id ?? 'system');
    return { ok: true };
  }
}
