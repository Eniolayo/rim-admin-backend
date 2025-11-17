import {
  Controller,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { AuthService } from '../services/auth.service';
import { VerifyCodeDto, TokenResponseDto } from '../dto';

@ApiTags('admin')
@Controller('admin/mfa')
export class AdminController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post(':temporaryHash')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify admin 2FA code and issue JWT' })
  @ApiBody({ type: VerifyCodeDto })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    type: TokenResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid code or session expired' })
  async verify(
    @Param('temporaryHash') temporaryHash: string,
    @Body() body: VerifyCodeDto,
  ): Promise<TokenResponseDto> {
    return this.authService.completeMfaLogin(temporaryHash, body.code);
  }
}
