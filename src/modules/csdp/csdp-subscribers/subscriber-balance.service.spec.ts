import { BadRequestException } from '@nestjs/common';
import { SubscriberBalanceService } from './subscriber-balance.service';

// Minimal in-memory Redis stub
class InMemoryRedis {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('SubscriberBalanceService', () => {
  let service: SubscriberBalanceService;
  let mockRepo: {
    findOne: jest.Mock;
    query: jest.Mock;
  };
  let redis: InMemoryRedis;

  const validMsisdn = '2347030278896';    // 13-digit E.164
  const localMsisdn = '07030278896';      // 11-digit local — should normalise OK

  beforeEach(() => {
    mockRepo = {
      findOne: jest.fn(),
      query: jest.fn(),
    };
    redis = new InMemoryRedis();
    service = new SubscriberBalanceService(mockRepo as any, redis as any);
  });

  describe('getOutstandingKobo', () => {
    it('throws BadRequestException for invalid MSISDN', async () => {
      await expect(service.getOutstandingKobo('bad-input')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('returns cached value without hitting DB', async () => {
      await redis.setex('sub:2347030278896:balance', 60, '5000');
      const result = await service.getOutstandingKobo(validMsisdn);
      expect(result).toBe(5000n);
      expect(mockRepo.findOne).not.toHaveBeenCalled();
    });

    it('returns 0n and warms cache when subscriber does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await service.getOutstandingKobo(localMsisdn);
      expect(result).toBe(0n);
      const cached = await redis.get('sub:2347030278896:balance');
      expect(cached).toBe('0');
    });

    it('returns outstanding from DB and warms cache on miss', async () => {
      mockRepo.findOne.mockResolvedValue({ msisdn: validMsisdn, outstandingKobo: '12345' });
      const result = await service.getOutstandingKobo(validMsisdn);
      expect(result).toBe(12345n);
      const cached = await redis.get('sub:2347030278896:balance');
      expect(cached).toBe('12345');
    });
  });

  describe('addOutstandingKobo', () => {
    it('throws BadRequestException for invalid MSISDN', async () => {
      await expect(service.addOutstandingKobo('', 100n)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('upserts and updates cache', async () => {
      mockRepo.query.mockResolvedValue([{ outstanding_kobo: '1500' }]);
      const result = await service.addOutstandingKobo(validMsisdn, 500n);
      expect(result).toBe(1500n);
      expect(mockRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        ['2347030278896', '500'],
      );
      const cached = await redis.get('sub:2347030278896:balance');
      expect(cached).toBe('1500');
    });
  });

  describe('setOutstandingKobo', () => {
    it('throws BadRequestException for invalid MSISDN', async () => {
      await expect(service.setOutstandingKobo('abc', 0n)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('upserts with absolute value and caches', async () => {
      mockRepo.query.mockResolvedValue([]);
      await service.setOutstandingKobo(validMsisdn, 9999n);
      expect(mockRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('outstanding_kobo = EXCLUDED.outstanding_kobo'),
        ['2347030278896', '9999'],
      );
      const cached = await redis.get('sub:2347030278896:balance');
      expect(cached).toBe('9999');
    });
  });

  describe('invalidate', () => {
    it('removes cache key', async () => {
      await redis.setex('sub:2347030278896:balance', 60, '1000');
      await service.invalidate(validMsisdn);
      const cached = await redis.get('sub:2347030278896:balance');
      expect(cached).toBeNull();
    });

    it('throws BadRequestException for invalid MSISDN', async () => {
      await expect(service.invalidate(null as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
