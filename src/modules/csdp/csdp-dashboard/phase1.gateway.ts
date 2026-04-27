import { Logger, UseGuards } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { WsJwtGuard } from '../../auth/guards/ws-jwt.guard';
import { Phase1DashboardService } from './phase1.service';

@WebSocketGateway({ namespace: '/csdp/dashboard', cors: { origin: true, credentials: true } })
export class CsdpDashboardGateway implements OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server: Server;

  private readonly logger = new Logger(CsdpDashboardGateway.name);
  private interval?: ReturnType<typeof setInterval>;

  constructor(private readonly service: Phase1DashboardService) {}

  onModuleInit() {
    // Skip the ticker in the batch/scheduler process — that process sets RUN_SCHEDULERS=1
    // and should not run the WebSocket dashboard logic.
    if (process.env.RUN_SCHEDULERS === '1') return;

    this.interval = setInterval(async () => {
      try {
        const counters = await this.service.getCounters();
        this.server.emit('counters', counters);
      } catch (err) {
        this.logger.warn(`Dashboard ticker error: ${(err as Error).message}`);
      }
    }, 5000);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('csdp:dashboard:subscribe')
  handleSubscribe(@ConnectedSocket() client: Socket) {
    const user = (client.data as any)?.user;
    if (!user) {
      return { status: 'error', message: 'unauthenticated' };
    }
    return { status: 'ok' };
  }
}
