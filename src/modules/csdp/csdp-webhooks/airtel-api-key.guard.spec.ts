import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AirtelApiKeyGuard } from './airtel-api-key.guard';

function makeCtx(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

function makeConfig(values: Record<string, string | undefined>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

describe('AirtelApiKeyGuard', () => {
  it('accepts a matching `Authorization: ApiKey <key>` header', () => {
    const guard = new AirtelApiKeyGuard(
      makeConfig({ AIRTEL_WEBHOOK_API_KEY: 'secret', NODE_ENV: 'production' }),
    );
    expect(
      guard.canActivate(makeCtx({ authorization: 'ApiKey secret' })),
    ).toBe(true);
  });

  it('rejects a missing Authorization header in production', () => {
    const guard = new AirtelApiKeyGuard(
      makeConfig({ AIRTEL_WEBHOOK_API_KEY: 'secret', NODE_ENV: 'production' }),
    );
    expect(() => guard.canActivate(makeCtx({}))).toThrow(UnauthorizedException);
  });

  it('rejects a wrong key', () => {
    const guard = new AirtelApiKeyGuard(
      makeConfig({ AIRTEL_WEBHOOK_API_KEY: 'secret', NODE_ENV: 'production' }),
    );
    expect(() =>
      guard.canActivate(makeCtx({ authorization: 'ApiKey wrong' })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a header with the wrong scheme even if the token matches', () => {
    const guard = new AirtelApiKeyGuard(
      makeConfig({ AIRTEL_WEBHOOK_API_KEY: 'secret', NODE_ENV: 'production' }),
    );
    expect(() =>
      guard.canActivate(makeCtx({ authorization: 'Bearer secret' })),
    ).toThrow(UnauthorizedException);
  });

  it('throws in production if AIRTEL_WEBHOOK_API_KEY is not configured', () => {
    const guard = new AirtelApiKeyGuard(
      makeConfig({ NODE_ENV: 'production' }),
    );
    expect(() =>
      guard.canActivate(makeCtx({ authorization: 'ApiKey anything' })),
    ).toThrow(UnauthorizedException);
  });

  it('passes in non-production when the env key is unset (dev convenience)', () => {
    const guard = new AirtelApiKeyGuard(
      makeConfig({ NODE_ENV: 'development' }),
    );
    expect(guard.canActivate(makeCtx({}))).toBe(true);
  });
});
