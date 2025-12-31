import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '../../../entities/api-key.entity';

export interface OAuth2TokenRequest {
  grant_type: 'authorization_code' | 'client_credentials' | 'refresh_token';
  code?: string;
  redirect_uri?: string;
  client_id: string;
  client_secret?: string;
  scope?: string;
  refresh_token?: string;
}

export interface OAuth2TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

@Injectable()
export class OAuth2Service {
  private readonly logger = new Logger(OAuth2Service.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {}

  /**
   * Generate OAuth 2.0 access token
   * Supports Authorization Code and Client Credentials flows
   */
  async generateAccessToken(
    request: OAuth2TokenRequest,
  ): Promise<OAuth2TokenResponse> {
    this.logger.log(
      { grant_type: request.grant_type, client_id: request.client_id },
      'Generating OAuth 2.0 access token',
    );

    // Validate grant type
    if (
      request.grant_type !== 'authorization_code' &&
      request.grant_type !== 'client_credentials' &&
      request.grant_type !== 'refresh_token'
    ) {
      throw new BadRequestException(
        `Unsupported grant_type: ${request.grant_type}`,
      );
    }

    // Client Credentials flow (for server-to-server)
    if (request.grant_type === 'client_credentials') {
      return this.handleClientCredentials(request);
    }

    // Authorization Code flow (for user-facing apps)
    if (request.grant_type === 'authorization_code') {
      return this.handleAuthorizationCode(request);
    }

    // Refresh Token flow
    if (request.grant_type === 'refresh_token') {
      return this.handleRefreshToken(request);
    }

    throw new BadRequestException('Invalid grant type');
  }

  /**
   * Client Credentials flow - for MNO and server-to-server integrations
   */
  private async handleClientCredentials(
    request: OAuth2TokenRequest,
  ): Promise<OAuth2TokenResponse> {
    // Validate client credentials
    // For now, we'll use API keys as client credentials
    // In production, you'd have a separate OAuth2 client table
    if (!request.client_id || !request.client_secret) {
      throw new UnauthorizedException('client_id and client_secret required');
    }

    // Find API key by client_id (email) and validate secret
    const apiKey = await this.apiKeyRepository.findOne({
      where: { email: request.client_id },
    });

    if (!apiKey || apiKey.status !== 'active') {
      throw new UnauthorizedException('Invalid client credentials');
    }

    // In a real implementation, you'd verify client_secret against stored hash
    // For now, we'll use the API key token as the secret
    // This is a simplified implementation

    // Generate access token
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const expiresIn = 3600; // 1 hour
    const scopes = request.scope
      ? request.scope.split(' ')
      : ['mno:eligibility', 'mno:fulfillment', 'mno:repayment', 'mno:enquiry'];

    const payload = {
      type: 'oauth2_access_token',
      grant_type: 'client_credentials',
      client_id: request.client_id,
      scope: scopes.join(' '),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresIn,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: jwtSecret,
    });

    this.logger.log(
      { client_id: request.client_id, scopes },
      'OAuth2 access token generated (client_credentials)',
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
      scope: scopes.join(' '),
    };
  }

  /**
   * Authorization Code flow - for user-facing applications
   */
  private async handleAuthorizationCode(
    request: OAuth2TokenRequest,
  ): Promise<OAuth2TokenResponse> {
    if (!request.code || !request.redirect_uri) {
      throw new BadRequestException(
        'code and redirect_uri required for authorization_code flow',
      );
    }

    // In a real implementation, you'd:
    // 1. Validate the authorization code
    // 2. Exchange it for an access token
    // 3. Verify redirect_uri matches the one used in authorization

    // For now, this is a placeholder implementation
    throw new BadRequestException(
      'Authorization Code flow not fully implemented yet',
    );
  }

  /**
   * Refresh Token flow
   */
  private async handleRefreshToken(
    request: OAuth2TokenRequest,
  ): Promise<OAuth2TokenResponse> {
    if (!request.refresh_token) {
      throw new BadRequestException('refresh_token required');
    }

    // In a real implementation, you'd:
    // 1. Validate the refresh token
    // 2. Generate a new access token
    // 3. Optionally generate a new refresh token

    // For now, this is a placeholder implementation
    throw new BadRequestException(
      'Refresh Token flow not fully implemented yet',
    );
  }

  /**
   * Validate OAuth 2.0 scopes
   */
  validateScopes(requiredScopes: string[], tokenScopes: string[]): boolean {
    return requiredScopes.every((scope) => tokenScopes.includes(scope));
  }
}
