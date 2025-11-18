import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import {
  LoginDto,
  LoginResultDto,
  SetupRequestDto,
  SetupVerifyDto,
  BackupCodeConsumeDto,
  BackupCodesResponseDto,
  VerifyCodeDto,
  SetupStartResponseDto,
  TokenResponseDto,
  RefreshTokenDto,
} from '../dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { AdminUser } from '../../../entities/admin-user.entity';
import { UserResponseDto } from '../dto/login-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResultDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto): Promise<LoginResultDto> {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start 2FA setup for admin without 2FA' })
  async startSetup(
    @Body() body: SetupRequestDto,
  ): Promise<SetupStartResponseDto> {
    return this.authService.start2faSetup(body.sessionToken);
  }

  @Public()
  @Post('2fa/verify-setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 2FA setup code and enable 2FA' })
  @ApiResponse({
    status: 200,
    description: '2FA enabled and authentication successful',
    type: TokenResponseDto,
  })
  async verifySetup(@Body() body: SetupVerifyDto): Promise<TokenResponseDto> {
    return this.authService.verify2faSetup(body.sessionToken, body.code);
  }

  @Post('2fa/backup-codes/regenerate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerate backup codes' })
  async regenerateBackupCodes(
    @CurrentUser() user: AdminUser,
  ): Promise<BackupCodesResponseDto> {
    const codes = await this.authService.regenerateBackupCodes(user.id);
    return { codes };
  }

  @Public()
  @Post('2fa/backup-codes/consume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Consume a backup code for MFA' })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    type: TokenResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid backup code' })
  async consumeBackupCode(
    @Body() body: BackupCodeConsumeDto,
  ): Promise<TokenResponseDto> {
    return this.authService.consumeBackupCode(body.temporaryHash, body.code);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: TokenResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body() body: RefreshTokenDto): Promise<TokenResponseDto> {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Current user information',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getCurrentUser(@CurrentUser() user: AdminUser): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.username,
      role: user.role || user.roleEntity?.name || '',
    };
  }
}
