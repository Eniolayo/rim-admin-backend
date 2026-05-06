import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { CsdpSubscriber } from '../../../entities/csdp/csdp-subscriber.entity';
import { CSDP_REDIS_CACHE } from '../csdp-core/redis-cache/csdp-redis.constants';
import { toE164Nigerian } from '../../../common/utils/phone.utils';

/**
 * Subscriber outstanding-balance accessor.
 *
 * All values are naira strings (matching the DB `numeric(14,2)` mapping).
 * Postgres handles the arithmetic; we never touch JS Number for money.
 */
@Injectable()
export class SubscriberBalanceService {
  constructor(
    @InjectRepository(CsdpSubscriber, 'csdpHot')
    private readonly repo: Repository<CsdpSubscriber>,
    @Inject(CSDP_REDIS_CACHE) private readonly redis: Redis,
  ) {}

  private cacheKey(msisdn: string): string {
    return `sub:${msisdn}:balance`;
  }

  async getOutstandingNaira(msisdnRaw: string): Promise<string> {
    const msisdn = toE164Nigerian(msisdnRaw);
    if (!msisdn) {
      throw new BadRequestException(`Invalid MSISDN: ${msisdnRaw}`);
    }

    const key = this.cacheKey(msisdn);
    const cached = await this.redis.get(key);
    if (cached !== null) return cached;

    const row = await this.repo.findOne({ where: { msisdn } });
    const value = row ? row.outstandingNaira : '0';
    await this.redis.setex(key, 60, value);
    return value;
  }

  async addOutstandingNaira(msisdnRaw: string, deltaNaira: string): Promise<string> {
    const msisdn = toE164Nigerian(msisdnRaw);
    if (!msisdn) {
      throw new BadRequestException(`Invalid MSISDN: ${msisdnRaw}`);
    }

    const result: Array<{ outstanding_naira: string }> = await this.repo.query(
      `INSERT INTO csdp_subscriber (msisdn, outstanding_naira, loans_taken, loans_recovered, blacklisted)
       VALUES ($1, $2, 0, 0, false)
       ON CONFLICT (msisdn) DO UPDATE
         SET outstanding_naira = csdp_subscriber.outstanding_naira + EXCLUDED.outstanding_naira,
             updated_at = now()
       RETURNING outstanding_naira`,
      [msisdn, deltaNaira],
    );

    const newTotal = result[0].outstanding_naira;
    await this.redis.setex(this.cacheKey(msisdn), 60, newTotal);
    return newTotal;
  }

  async setOutstandingNaira(msisdnRaw: string, totalNaira: string): Promise<void> {
    const msisdn = toE164Nigerian(msisdnRaw);
    if (!msisdn) {
      throw new BadRequestException(`Invalid MSISDN: ${msisdnRaw}`);
    }

    await this.repo.query(
      `INSERT INTO csdp_subscriber (msisdn, outstanding_naira, loans_taken, loans_recovered, blacklisted)
       VALUES ($1, $2, 0, 0, false)
       ON CONFLICT (msisdn) DO UPDATE
         SET outstanding_naira = EXCLUDED.outstanding_naira,
             updated_at = now()`,
      [msisdn, totalNaira],
    );

    await this.redis.setex(this.cacheKey(msisdn), 60, totalNaira);
  }

  async invalidate(msisdnRaw: string): Promise<void> {
    const msisdn = toE164Nigerian(msisdnRaw);
    if (!msisdn) {
      throw new BadRequestException(`Invalid MSISDN: ${msisdnRaw}`);
    }
    await this.redis.del(this.cacheKey(msisdn));
  }
}
