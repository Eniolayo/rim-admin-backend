import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';

export interface UssdOfferSession {
  userId: string;
  msisdn: string;
  eligibleAmount: number;
  network?: string;
  offers: Array<{
    option: number;
    amount: number;
    currency: string;
    interestRate: number;
    repaymentPeriodDays: number;
  }>;
}

@Injectable()
export class UssdSessionService {
  private readonly ttlSeconds = 180;

  constructor(private readonly redisService: RedisService) {}

  private buildKey(sessionId: string): string {
    return `ussd:loan-offer:${sessionId}`;
  }

  async saveOfferSession(
    sessionId: string,
    payload: UssdOfferSession,
  ): Promise<void> {
    const key = this.buildKey(sessionId);
    await this.redisService.setJson(key, payload, this.ttlSeconds);
  }

  async getOfferSession(sessionId: string): Promise<UssdOfferSession | null> {
    const key = this.buildKey(sessionId);
    return this.redisService.getJson<UssdOfferSession>(key);
  }

  async invalidateSession(sessionId: string): Promise<void> {
    const key = this.buildKey(sessionId);
    await this.redisService.del(key);
  }
}


