import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../../auth/decorators/public.decorator';
import { CsdpApiKeyGuard } from '../../auth/guards/csdp-api-key.guard';
import { CsdpScopes } from '../../auth/decorators/csdp-scopes.decorator';
import { IngestService } from './ingest.service';
import { UploadDto } from './dto/upload.dto';
import type { MulterFile } from './multer-file.type';

/**
 * Public-facing ingest controller — protected only by CSDP API key.
 * Used by Airtel integration to upload CDR / vendor dump files.
 */
@Controller('csdp/ingest')
@Public()
@UseGuards(CsdpApiKeyGuard)
@CsdpScopes('csdp:ingest')
export class IngestController {
  constructor(private readonly service: IngestService) {}

  @Post('cdr/refill')
  @UseInterceptors(FileInterceptor('file'))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async refill(@UploadedFile() file: any, @Body() dto: UploadDto) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    if (dto.source !== 'refill') {
      throw new BadRequestException('source must be "refill"');
    }
    return this.service.receive(file as MulterFile, dto);
  }

  @Post('cdr/sdp')
  @UseInterceptors(FileInterceptor('file'))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sdp(@UploadedFile() file: any, @Body() dto: UploadDto) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    if (dto.source !== 'sdp') {
      throw new BadRequestException('source must be "sdp"');
    }
    return this.service.receive(file as MulterFile, dto);
  }

  @Post('vendor-dump')
  @UseInterceptors(FileInterceptor('file'))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async vendorDump(@UploadedFile() file: any, @Body() dto: UploadDto) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    if (!dto.source.startsWith('vendor:')) {
      throw new BadRequestException('source must be one of vendor:avyra, vendor:erl, vendor:fonyou');
    }
    return this.service.receive(file as MulterFile, dto);
  }

  @Get('batches')
  async list(
    @Query('source') source?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listBatches({
      source,
      status,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get('batches/:id')
  async getBatch(@Param('id') id: string) {
    return this.service.getBatch(id);
  }
}
