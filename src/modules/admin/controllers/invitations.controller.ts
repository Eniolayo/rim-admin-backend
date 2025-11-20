import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InvitationsService } from '../services/invitations.service';
import {
  InviteAdminDto,
  AdminInvitationResponseDto,
  VerifyInviteResponseDto,
  SetupAdminAccountDto,
  SetupAdminAccountResponseDto,
} from '../dto/invitation.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequireSuperAdmin } from '../../auth/decorators/require-super-admin.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { ActivityLogInterceptor } from '../interceptors/activity-log.interceptor';
import { AdminUser } from '../../../entities/admin-user.entity';

@ApiTags('admin-invitations')
@Throttle({ default: { limit: 100, ttl: 60000 } })
@Controller('admin/invitations')
export class InvitationsController {
  private readonly logger = new Logger(InvitationsController.name);

  constructor(private readonly service: InvitationsService) {}

  @Post('invite')
  @Permissions('settings', 'delete')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite a new admin' })
  @ApiResponse({
    status: 201,
    description: 'Invitation created successfully',
    type: AdminInvitationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - duplicate email or invalid role',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'Role not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async inviteAdmin(
    @Body() dto: InviteAdminDto,
    @CurrentUser() user: AdminUser,
  ): Promise<AdminInvitationResponseDto> {
    this.logger.log(
      `POST /admin/invitations/invite - Inviting ${dto.email} with roleId ${dto.roleId}`,
    );
    return this.service.inviteAdmin(dto, user);
  }

  @Get()
  @Permissions('settings', 'delete')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all admin invitations' })
  @ApiResponse({
    status: 200,
    description: 'List of invitations',
    type: [AdminInvitationResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getInvitations(): Promise<AdminInvitationResponseDto[]> {
    this.logger.log('GET /admin/invitations - Listing all invitations');
    return this.service.getInvitations();
  }

  @Get('verify/:token')
  @Public()
  @ApiOperation({ summary: 'Verify an invitation token' })
  @ApiParam({
    name: 'token',
    description: 'Invitation token to verify',
    example: 'abc123def456...',
  })
  @ApiResponse({
    status: 200,
    description: 'Token verification result',
    type: VerifyInviteResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async verifyInviteToken(
    @Param('token') token: string,
  ): Promise<VerifyInviteResponseDto> {
    this.logger.log('GET /admin/invitations/verify/:token - Verifying token');
    return this.service.verifyInviteToken(token);
  }

  @Post('setup')
  @Public()
  @ApiOperation({ summary: 'Set up admin account from invitation' })
  @ApiResponse({
    status: 201,
    description: 'Admin account created successfully',
    type: SetupAdminAccountResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid token, expired, or already used',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async setupAdminAccount(
    @Body() dto: SetupAdminAccountDto,
  ): Promise<SetupAdminAccountResponseDto> {
    this.logger.log('POST /admin/invitations/setup - Setting up admin account');
    return this.service.setupAdminAccount(dto);
  }

  @Post(':id/resend')
  @Permissions('settings', 'delete')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend an invitation' })
  @ApiParam({
    name: 'id',
    description: 'Invitation ID to resend',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation resent successfully',
    type: AdminInvitationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invitation already accepted or expired',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async resendInvitation(
    @Param('id') id: string,
    @CurrentUser() user: AdminUser,
  ): Promise<AdminInvitationResponseDto> {
    this.logger.log(
      `POST /admin/invitations/${id}/resend - Resending invitation`,
    );
    return this.service.resendInvitation(id, user);
  }

  @Delete(':id')
  @Permissions('settings', 'delete')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an invitation' })
  @ApiParam({
    name: 'id',
    description: 'Invitation ID to cancel',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation cancelled successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async cancelInvitation(@Param('id') id: string): Promise<void> {
    this.logger.log(`DELETE /admin/invitations/${id} - Cancelling invitation`);
    return this.service.cancelInvitation(id);
  }
}
