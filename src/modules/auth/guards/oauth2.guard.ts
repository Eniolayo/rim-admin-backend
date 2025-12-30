import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

interface OAuth2User {
  id: string;
  email?: string;
  scopes: string[];
  clientId?: string;
  grantType?: string;
}

declare module 'express' {
  interface Request {
    oauth2Auth?: boolean;
    user?: OAuth2User | any;
  }
}

/**
 * OAuth 2.0 Guard
 * Validates OAuth 2.0 access tokens for API requests
 * Supports both Authorization Code and Client Credentials flows
 */
@Injectable()
export class OAuth2Guard implements CanActivate {
  private readonly logger = new Logger(OAuth2Guard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Allow OPTIONS requests (CORS preflight)
    if (request.method === 'OPTIONS') {
      return true;
    }

    // Extract token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn('OAuth2 token missing from Authorization header');
      throw new UnauthorizedException('OAuth 2.0 access token is required');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify and decode the OAuth 2.0 access token
      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not configured');
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtSecret,
      });

      // Validate token type
      if (payload.type !== 'oauth2_access_token') {
        this.logger.warn('Invalid token type for OAuth2 guard');
        throw new UnauthorizedException('Invalid OAuth 2.0 token type');
      }

      // Attach user/client information to request
      request.user = {
        id: payload.sub || payload.client_id,
        email: payload.email,
        scopes: payload.scope ? payload.scope.split(' ') : [],
        clientId: payload.client_id,
        grantType: payload.grant_type,
      };

      request.oauth2Auth = true; // Flag to indicate OAuth2 authentication

      this.logger.debug(
        `OAuth2 token validated for client/user: ${request.user.id}`,
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `OAuth2 token validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException('Invalid or expired OAuth 2.0 token');
    }
  }
}
