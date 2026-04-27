import { InboundLogService } from './inbound-log.service';

describe('InboundLogService', () => {
  let service: InboundLogService;
  let mockRepo: { query: jest.Mock };

  beforeEach(() => {
    mockRepo = { query: jest.fn() };
    service = new InboundLogService(mockRepo as any);
  });

  it('returns isDuplicate=false with new id on first insert', async () => {
    mockRepo.query.mockResolvedValueOnce([{ id: 'uuid-new' }]);

    const result = await service.record('loan', 'key-001', { foo: 1 }, { 'x-src': 'test' });

    expect(result).toEqual({ id: 'uuid-new', isDuplicate: false });
    expect(mockRepo.query).toHaveBeenCalledTimes(1);
  });

  it('returns isDuplicate=true with existing id on conflict', async () => {
    // First call: INSERT returns nothing (conflict)
    mockRepo.query.mockResolvedValueOnce([]);
    // Second call: SELECT returns existing row
    mockRepo.query.mockResolvedValueOnce([{ id: 'uuid-existing' }]);

    const result = await service.record('recovery', 'key-dup', { bar: 2 }, {});

    expect(result).toEqual({ id: 'uuid-existing', isDuplicate: true });
    expect(mockRepo.query).toHaveBeenCalledTimes(2);
  });

  it('passes kind, dedupeKey, body JSON, and headers JSON to query', async () => {
    mockRepo.query.mockResolvedValueOnce([{ id: 'uuid-abc' }]);

    await service.record('loan', 'my-key', { amount: 100 }, { host: 'example.com' });

    const [sql, params] = mockRepo.query.mock.calls[0];
    expect(sql).toContain('ON CONFLICT (dedupe_key) DO NOTHING');
    expect(params[0]).toBe('loan');
    expect(params[1]).toBe('my-key');
    expect(JSON.parse(params[2])).toEqual({ amount: 100 });
    expect(JSON.parse(params[3])).toEqual({ host: 'example.com' });
  });
});
