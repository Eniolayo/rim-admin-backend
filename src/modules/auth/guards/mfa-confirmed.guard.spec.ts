import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { MfaConfirmedGuard } from './mfa-confirmed.guard';
import { authenticator } from 'otplib';

jest.mock('otplib', () => ({
  authenticator: {
    check: jest.fn(),
  },
}));

const mockAuthenticator = authenticator as jest.Mocked<typeof authenticator>;

function buildContext(overrides: {
  user?: any;
  headers?: Record<string, string>;
}): ExecutionContext {
  const req = {
    user: overrides.user,
    headers: overrides.headers ?? {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

describe('MfaConfirmedGuard', () => {
  let guard: MfaConfirmedGuard;

  beforeEach(() => {
    guard = new MfaConfirmedGuard();
    jest.clearAllMocks();
  });

  it('throws ForbiddenException when req.user is absent', () => {
    const ctx = buildContext({ user: undefined });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user has no otpSecret', () => {
    const ctx = buildContext({
      user: { id: '1', twoFactorEnabled: true, otpSecret: null },
      headers: { 'x-mfa-code': '123456' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when twoFactorEnabled is false', () => {
    const ctx = buildContext({
      user: { id: '1', twoFactorEnabled: false, otpSecret: 'SECRET' },
      headers: { 'x-mfa-code': '123456' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws UnauthorizedException when x-mfa-code header is missing', () => {
    const ctx = buildContext({
      user: { id: '1', twoFactorEnabled: true, otpSecret: 'SECRET' },
      headers: {},
    });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when code is invalid', () => {
    mockAuthenticator.check.mockReturnValue(false);
    const ctx = buildContext({
      user: { id: '1', twoFactorEnabled: true, otpSecret: 'SECRET' },
      headers: { 'x-mfa-code': '000000' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(mockAuthenticator.check).toHaveBeenCalledWith('000000', 'SECRET');
  });

  it('returns true when code is valid', () => {
    mockAuthenticator.check.mockReturnValue(true);
    const ctx = buildContext({
      user: { id: '1', twoFactorEnabled: true, otpSecret: 'SECRET' },
      headers: { 'x-mfa-code': '123456' },
    });
    const result = guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockAuthenticator.check).toHaveBeenCalledWith('123456', 'SECRET');
  });
});
