import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { OAuth2Service } from '../services/oauth2.service';
import type { OAuth2TokenRequest, OAuth2TokenResponse } from '../services/oauth2.service';
import { Public } from '../decorators/public.decorator';

@ApiTags('auth')
@Controller('auth/oauth')
@Public()
export class OAuth2Controller {
  constructor(private readonly oauth2Service: OAuth2Service) {}

  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'OAuth 2.0 Token Endpoint',
    description:
      'OAuth 2.0 token endpoint supporting Authorization Code and Client Credentials flows. ' +
      'Returns access tokens for API authentication.',
  })
  @ApiBody({
    description: 'OAuth 2.0 token request',
    schema: {
      type: 'object',
      required: ['grant_type', 'client_id'],
      properties: {
        grant_type: {
          type: 'string',
          enum: ['authorization_code', 'client_credentials', 'refresh_token'],
          description: 'OAuth 2.0 grant type',
        },
        client_id: {
          type: 'string',
          description: 'OAuth 2.0 client identifier',
        },
        client_secret: {
          type: 'string',
          description: 'OAuth 2.0 client secret (required for client_credentials)',
        },
        code: {
          type: 'string',
          description: 'Authorization code (required for authorization_code flow)',
        },
        redirect_uri: {
          type: 'string',
          description: 'Redirect URI (required for authorization_code flow)',
        },
        scope: {
          type: 'string',
          description: 'Space-separated list of scopes',
          example: 'mno:eligibility mno:fulfillment',
        },
        refresh_token: {
          type: 'string',
          description: 'Refresh token (required for refresh_token flow)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Access token generated successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        token_type: { type: 'string', example: 'Bearer' },
        expires_in: { type: 'number', example: 3600 },
        refresh_token: { type: 'string' },
        scope: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid client credentials',
  })
  async token(@Body() body: OAuth2TokenRequest): Promise<OAuth2TokenResponse> {
    return this.oauth2Service.generateAccessToken(body);
  }
}
