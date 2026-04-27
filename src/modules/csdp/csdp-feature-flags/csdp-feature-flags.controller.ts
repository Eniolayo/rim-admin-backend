import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Req,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminTwoFactorGuard } from '../../auth/guards/admin-2fa.guard';
import { MfaConfirmedGuard } from '../../auth/guards/mfa-confirmed.guard';
import { CsdpFeatureFlagsService } from './csdp-feature-flags.service';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';

@Controller('csdp/admin/feature-flags')
@UseGuards(JwtAuthGuard, AdminTwoFactorGuard)
export class CsdpFeatureFlagsController {
  constructor(
    private readonly flagsService: CsdpFeatureFlagsService,
    @InjectQueue('activity-logs') private readonly activityQueue: Queue,
  ) {}

  @Get()
  async list() {
    return this.flagsService.list();
  }

  @Get(':key')
  async getOne(@Param('key') key: string) {
    const value = await this.flagsService.get(key);
    if (value === undefined) {
      throw new NotFoundException(`Feature flag '${key}' not found`);
    }
    return { key, value };
  }

  @Put(':key')
  @UseGuards(MfaConfirmedGuard)
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto,
    @Req() req: Request & { user: { id: string; name?: string } },
  ) {
    const oldValue = await this.flagsService.get(key);
    const saved = await this.flagsService.set(key, dto.value, req.user.id);

    // Fire-and-forget audit log
    this.activityQueue
      .add(
        'batch-process',
        {
          adminId: req.user.id,
          adminName: req.user['name'] ?? req.user.id,
          action: 'csdp.feature_flag.update',
          resource: 'feature_flag',
          resourceId: key,
          details: { key, oldValue, newValue: dto.value },
          ipAddress: req.ip ?? null,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 10 },
          removeOnFail: { age: 86400 },
        },
      )
      .catch(() => {
        // Non-fatal — do not break response
      });

    return saved;
  }
}
