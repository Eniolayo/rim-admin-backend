import { ExposurePublisherService } from './exposure-publisher.service';

function makeFixture(opts: {
  bookKobo: string | null;
  budgetKobo: number | null | undefined;
}) {
  const dataSource = {
    query: jest.fn(async () => [{ kobo: opts.bookKobo }]),
  };
  const counters = {
    setSystemExposurePct: jest.fn().mockResolvedValue(undefined),
  };
  const systemConfig = {
    getValue: jest.fn(async (_cat: string, _key: string, def: number) => {
      return opts.budgetKobo === undefined ? def : opts.budgetKobo;
    }),
  };
  return { dataSource, counters, systemConfig };
}

function newSvc(fx: ReturnType<typeof makeFixture>) {
  return new ExposurePublisherService(
    fx.dataSource as never,
    fx.counters as never,
    fx.systemConfig as never,
  );
}

describe('ExposurePublisherService.publishOnce', () => {
  it('writes pct = book / budget when both > 0', async () => {
    const fx = makeFixture({ bookKobo: '500000', budgetKobo: 1000000 });
    const svc = newSvc(fx);

    const pct = await svc.publishOnce();

    expect(pct).toBeCloseTo(0.5);
    expect(fx.counters.setSystemExposurePct).toHaveBeenCalledWith(0.5);
  });

  it('writes 0 when budget is 0 (pre-LIVE; ops has not seeded a real budget)', async () => {
    const fx = makeFixture({ bookKobo: '999999', budgetKobo: 0 });
    const svc = newSvc(fx);

    const pct = await svc.publishOnce();

    expect(pct).toBe(0);
    expect(fx.counters.setSystemExposurePct).toHaveBeenCalledWith(0);
  });

  it('writes 0 when book is 0 even with a positive budget', async () => {
    const fx = makeFixture({ bookKobo: '0', budgetKobo: 1000000 });
    const svc = newSvc(fx);

    expect(await svc.publishOnce()).toBe(0);
    expect(fx.counters.setSystemExposurePct).toHaveBeenCalledWith(0);
  });

  it('handles NULL book sum gracefully (no rows in csdp_loan)', async () => {
    const fx = makeFixture({ bookKobo: null, budgetKobo: 1000000 });
    const svc = newSvc(fx);

    expect(await svc.publishOnce()).toBe(0);
  });

  it('reads budget from SYSTEM_CONFIG csdp_scoring/csdp.exposure.budget_kobo with default 0', async () => {
    const fx = makeFixture({ bookKobo: '0', budgetKobo: undefined });
    const svc = newSvc(fx);

    await svc.publishOnce();

    expect(fx.systemConfig.getValue).toHaveBeenCalledWith(
      'csdp_scoring',
      'csdp.exposure.budget_kobo',
      0,
    );
  });

  it('produces pct > 1 when book exceeds budget (Stage 4 halt territory)', async () => {
    const fx = makeFixture({ bookKobo: '2000000', budgetKobo: 1000000 });
    const svc = newSvc(fx);

    const pct = await svc.publishOnce();

    expect(pct).toBeCloseTo(2);
    expect(fx.counters.setSystemExposurePct).toHaveBeenCalledWith(2);
  });
});
