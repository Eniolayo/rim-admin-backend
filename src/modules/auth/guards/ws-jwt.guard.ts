import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { ConfigType } from '@nestjs/config'
import jwtConfig from '../../../config/jwt.config'
import { AuthService } from '../services/auth.service'

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    @Inject(jwtConfig.KEY) private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: any = context.switchToWs().getClient()
    const token = this.extractToken(client)
    if (!token) {
      throw new UnauthorizedException('Missing token')
    }
    try {
      const payload: any = await this.jwtService.verifyAsync(token, { secret: this.jwtConfiguration.secret })
      const user = await this.authService.validateUserById(payload.sub)
      client.data = client.data || {}
      client.data.user = user
      return true
    } catch {
      throw new UnauthorizedException('Invalid token')
    }
  }

  private extractToken(client: any): string | null {
    const authHeader: string | undefined = client?.handshake?.headers?.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring('Bearer '.length)
    }
    const authToken: string | undefined = client?.handshake?.auth?.token
    if (authToken) return authToken
    return null
  }
}
