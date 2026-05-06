import { BadRequestException } from '@nestjs/common';
import { SubscriberBalanceService } from './subscriber-balance.service';

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
  let mockRepo: { findOne: jest.Mock; query: jest.Mock };
  let redis: InMemoryRedis;

  const validMsisdn = '2347030278896';
  const localMsisdn = '07030278896';

  beforeEach(() => {
    mockRepo = { findOne: jest.fn(), query: jest.fn() };
    redis = new InMemoryRedis();
    service = new SubscriberBalanceService(mockRepo as any, redis as any);
  });

  describe('getOutstandingNaira', () => {
    it('throws BadRequestException for invalid MSISDN', async () => {
      await expect(service.getOutstandingNaira('bad-input')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('returns cached value without hitting DB', async () => {
      await redis.setex('sub:2347030278896:balance', 60, '5000.00');
      const result = await service.getOutstandingNaira(validMsisdn);
      expect(result).toBe('5000.00');
      expect(mockRepo.findOne).not.toHaveBeenCalled();
    });

    it('returns "0" and warms cache when subscriber does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await service.getOutstandingNaira(localMsisdn);
      expect(result).toBe('0');
      const cached = await redis.get('sub:2347030278896:balance');
      expect(cached).toBe('0');
    });

    it('returns outstanding from DB and warms cache on miss', async () => {
      mockRepo.findOne.mockResolvedValue({
        msisdn: validMsisdn,
        outstandingNaira: '12345.00',
      });
      const result = await service.getOutstandingNaira(validMsisdn);
      expect(result).toBe('12345.00');
      const cached = await redis.get('sub:2347030278896:balance');
      expect(cached).toBe('12345.00');
    });
  });

  describe('addOutstandingNaira', () => {
    it('throws BadRequestException for invalid MSISDN', async () => {
      await expect(service.addOutstandingNaira('', '100')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('upserts and updates cache', async () => {
      mockRepo.query.mockResolvedValue([{ outstanding_naira: '1500.00' }]);
      const result = await service.addOutstandingNaira(validMsisdn, '500');
      expect(result).toBe('1500.00');
      expect(mockRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        ['2347030278896', '500'],
      );
      const cached = await redis.get('sub:2347030278896:balance');
      expect(cached).toBe('1500.00');
    });
  });

  describe('setOutstandingNaira', () => {
    it('throws BadRequestException for invalid MSISDN', async () => {
      await expect(service.setOutstandingNaira('abc', '0')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('upserts with absolute value and caches', async () => {
      mockRepo.query.mockResolvedValue([]);
      await service.setOutstandingNaira(validMsisdn, '9999.00');
      expect(mockRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('outstanding_naira = EXCLUDED.outstanding_naira'),
        ['2347030278896', '9999.00'],
      );
      const cached = await redis.get('sub:2347030278896:balance');
      expect(cached).toBe('9999.00');
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
