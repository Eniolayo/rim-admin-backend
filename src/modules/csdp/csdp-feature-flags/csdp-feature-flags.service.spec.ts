import { CsdpFeatureFlagsService } from './csdp-feature-flags.service';

describe('CsdpFeatureFlagsService', () => {
  let service: CsdpFeatureFlagsService;

  const mockRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CsdpFeatureFlagsService(mockRepo as any, mockRedis as any);
  });

  describe('get', () => {
    it('returns parsed value from Redis cache on hit', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify('PROXY'));
      const result = await service.get('DECISION_MODE');
      expect(result).toBe('PROXY');
      expect(mockRepo.findOne).not.toHaveBeenCalled();
    });

    it('falls back to Postgres on Redis miss and populates cache', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRepo.findOne.mockResolvedValue({ key: 'DECISION_MODE', value: 'STUB_DENY' });
      const result = await service.get('DECISION_MODE');
      expect(result).toBe('STUB_DENY');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'config:DECISION_MODE',
        JSON.stringify('STUB_DENY'),
        'EX',
        30,
      );
    });

    it('returns undefined when missing in both Redis and Postgres', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRepo.findOne.mockResolvedValue(null);
      const result = await service.get('NONEXISTENT');
      expect(result).toBeUndefined();
    });
  });

  describe('getString', () => {
    it('returns the string value when present', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(800));
      const result = await service.getString('TEAMWEE_TIMEOUT_MS', '500');
      expect(result).toBe('800');
    });

    it('returns fallback when key is missing', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRepo.findOne.mockResolvedValue(null);
      const result = await service.getString('MISSING', 'default');
      expect(result).toBe('default');
    });
  });

  describe('set', () => {
    it('upserts row and invalidates Redis', async () => {
      const existingRow = { key: 'DECISION_MODE', value: 'STUB_DENY', updatedBy: null };
      mockRepo.findOne.mockResolvedValue(existingRow);
      const savedRow = { key: 'DECISION_MODE', value: 'PROXY', updatedBy: 'user-1' };
      mockRepo.create.mockReturnValue(savedRow);
      mockRepo.save.mockResolvedValue(savedRow);

      const result = await service.set('DECISION_MODE', 'PROXY', 'user-1');

      expect(mockRepo.save).toHaveBeenCalledWith(savedRow);
      expect(mockRedis.del).toHaveBeenCalledWith('config:DECISION_MODE');
      expect(result).toEqual(savedRow);
    });

    it('creates new row when key does not exist yet', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const newRow = { key: 'NEW_FLAG', value: true, updatedBy: 'actor' };
      mockRepo.create.mockReturnValue(newRow);
      mockRepo.save.mockResolvedValue(newRow);

      await service.set('NEW_FLAG', true, 'actor');

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'NEW_FLAG', value: true, updatedBy: 'actor' }),
      );
    });
  });

  describe('list', () => {
    it('returns all flags from Postgres', async () => {
      const rows = [{ key: 'A', value: 1 }, { key: 'B', value: 2 }];
      mockRepo.find.mockResolvedValue(rows);
      const result = await service.list();
      expect(result).toEqual(rows);
    });
  });
});
