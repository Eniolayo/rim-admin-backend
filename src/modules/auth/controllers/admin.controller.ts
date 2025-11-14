import {
  Controller,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { AuthService } from '../services/auth.service';
import { VerifyCodeDto } from '../dto';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post(':temporaryHash')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify admin 2FA code and issue JWT' })
  @ApiBody({ type: VerifyCodeDto })
  async verify(
    @Param('temporaryHash') temporaryHash: string,
    @Body() body: VerifyCodeDto,
  ): Promise<{ token: string; expiresIn: string }> {
    return this.authService.completeMfaLogin(temporaryHash, body.code);
  }
}

