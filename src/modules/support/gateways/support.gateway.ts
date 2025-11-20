import { Logger, UseGuards } from '@nestjs/common'
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { SupportService } from '../services/support.service'
import { ChatMessage } from '../../../entities/chat-message.entity'
import { WsJwtGuard } from '../../auth/guards/ws-jwt.guard'

@WebSocketGateway({ namespace: '/support', cors: { origin: true, credentials: true } })
export class SupportGateway {
  private readonly logger = new Logger(SupportGateway.name)

  constructor(private readonly supportService: SupportService) {}

  @WebSocketServer()
  server: Server

  private room(ticketId: string): string {
    return `ticket:${ticketId}`
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('support:join')
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { ticketId: string }) {
    const { ticketId } = data || ({} as any)
    if (!ticketId) {
      return { status: 'error', message: 'ticketId required' }
    }
    await client.join(this.room(ticketId))
    this.logger.log(`Client ${client.id} joined room ${this.room(ticketId)}`)
    return { status: 'ok' }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('support:leave')
  async handleLeave(@ConnectedSocket() client: Socket, @MessageBody() data: { ticketId: string }) {
    const { ticketId } = data || ({} as any)
    if (!ticketId) {
      return { status: 'error', message: 'ticketId required' }
    }
    await client.leave(this.room(ticketId))
    this.logger.log(`Client ${client.id} left room ${this.room(ticketId)}`)
    return { status: 'ok' }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('support:send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ticketId: string; message: string },
  ) {
    const { ticketId, message } = data || ({} as any)
    if (!ticketId || !message || !message.trim()) {
      return { status: 'error', message: 'ticketId and message required' }
    }
    const user = (client.data && (client.data as any).user) || null
    if (!user) {
      return { status: 'error', message: 'unauthenticated' }
    }
    const hasWrite = Array.isArray(user.roleEntity?.permissions)
      ? user.roleEntity.permissions.some(
          (p: any) => p.resource === 'support' && Array.isArray(p.actions) && p.actions.includes('write'),
        )
      : false
    if (!hasWrite) {
      return { status: 'error', message: 'insufficient_permissions' }
    }
    const saved = await this.supportService.sendMessage({ ticketId, message }, user)
    this.server.to(this.room(ticketId)).emit('support:message:new', saved)
    this.logger.log(`Broadcasted new message ${saved.id} to room ${this.room(ticketId)}`)
    return { status: 'ok', message: saved }
  }

  emitMessage(msg: ChatMessage): void {
    if (!msg?.ticketId) return
    this.server.to(this.room(msg.ticketId)).emit('support:message:new', msg)
    this.logger.log(`Emitted message ${msg.id} for ticket ${msg.ticketId}`)
  }
}

