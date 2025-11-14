import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ActivityService } from '../services/activity.service'
import { ActivityLogResponseDto, ActivityQueryDto } from '../dto/activity.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'

@ApiTags('admin-activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/activity-logs')
export class ActivityController {
  constructor(private readonly service: ActivityService) {}

  @Get()
  @ApiOperation({ summary: 'List admin activity logs' })
  @ApiResponse({ status: 200, type: [ActivityLogResponseDto] })
  list(@Query() q: ActivityQueryDto): Promise<ActivityLogResponseDto[]> {
    return this.service.list(q)
  }
}

