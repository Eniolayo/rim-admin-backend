import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { CsdpSubscriber } from '../../../entities/csdp/csdp-subscriber.entity';
import { CSDP_REDIS_CACHE } from '../csdp-core/redis-cache/csdp-redis.constants';
import { toE164Nigerian } from '../../../common/utils/phone.utils';

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

  async getOutstandingKobo(msisdnRaw: string): Promise<bigint> {
    const msisdn = toE164Nigerian(msisdnRaw);
    if (!msisdn) {
      throw new BadRequestException(`Invalid MSISDN: ${msisdnRaw}`);
    }

    const key = this.cacheKey(msisdn);
    const cached = await this.redis.get(key);

    if (cached !== null) {
      return BigInt(cached);
    }

    // Cache miss — read from Postgres
    const row = await this.repo.findOne({ where: { msisdn } });
    const value = row ? BigInt(row.outstandingKobo) : 0n;
    await this.redis.setex(key, 60, value.toString());
    return value;
  }

  async addOutstandingKobo(msisdnRaw: string, deltaKobo: bigint): Promise<bigint> {
    const msisdn = toE164Nigerian(msisdnRaw);
    if (!msisdn) {
      throw new BadRequestException(`Invalid MSISDN: ${msisdnRaw}`);
    }

    const result: Array<{ outstanding_kobo: string }> = await this.repo.query(
      `INSERT INTO csdp_subscriber (msisdn, outstanding_kobo, loans_taken, loans_recovered, blacklisted)
       VALUES ($1, $2, 0, 0, false)
       ON CONFLICT (msisdn) DO UPDATE
         SET outstanding_kobo = csdp_subscriber.outstanding_kobo + EXCLUDED.outstanding_kobo,
             updated_at = now()
       RETURNING outstanding_kobo`,
      [msisdn, deltaKobo.toString()],
    );

    const newTotal = BigInt(result[0].outstanding_kobo);
    const key = this.cacheKey(msisdn);
    await this.redis.setex(key, 60, newTotal.toString());
    return newTotal;
  }

  async setOutstandingKobo(msisdnRaw: string, totalKobo: bigint): Promise<void> {
    const msisdn = toE164Nigerian(msisdnRaw);
    if (!msisdn) {
      throw new BadRequestException(`Invalid MSISDN: ${msisdnRaw}`);
    }

    await this.repo.query(
      `INSERT INTO csdp_subscriber (msisdn, outstanding_kobo, loans_taken, loans_recovered, blacklisted)
       VALUES ($1, $2, 0, 0, false)
       ON CONFLICT (msisdn) DO UPDATE
         SET outstanding_kobo = EXCLUDED.outstanding_kobo,
             updated_at = now()`,
      [msisdn, totalKobo.toString()],
    );

    const key = this.cacheKey(msisdn);
    await this.redis.setex(key, 60, totalKobo.toString());
  }

  async invalidate(msisdnRaw: string): Promise<void> {
    const msisdn = toE164Nigerian(msisdnRaw);
    if (!msisdn) {
      throw new BadRequestException(`Invalid MSISDN: ${msisdnRaw}`);
    }
    await this.redis.del(this.cacheKey(msisdn));
  }
}
