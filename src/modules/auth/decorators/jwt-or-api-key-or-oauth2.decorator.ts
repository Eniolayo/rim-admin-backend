import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { OAuth2Guard } from '../guards/oauth2.guard';

/**
 * Decorator that allows authentication via JWT, API Key, or OAuth 2.0
 * Useful for endpoints that need to support multiple authentication methods
 */
export function JwtOrApiKeyOrOAuth2(...scopes: string[]) {
  return applyDecorators(
    ApiSecurity('bearer'),
    ApiSecurity('api-key'),
    ApiSecurity('oauth2', scopes.length > 0 ? scopes : undefined),
    UseGuards(JwtAuthGuard, ApiKeyGuard, OAuth2Guard),
  );
}
