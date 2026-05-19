import { ZavorthMnemosMemoryUxService } from '../../src/services/ZavorthMnemosMemoryUxService';

describe('ZavorthMnemosMemoryUxService', () => {
  it('builds dashboard, cli and telegram memory controls without mutation', () => {
    const service = new ZavorthMnemosMemoryUxService({
      now: () => new Date('2026-05-18T12:00:00.000Z'),
      lintService: {
        lint: () => ({
          status: 'passed',
          summary: { findings: 0 },
        } as any),
      },
      proceduralMemoryService: {
        list: () => ({
          summary: { total: 1 },
          rules: [{ status: 'active' }],
        } as any),
      },
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot).toEqual(expect.objectContaining({
      version: 'zavorth-mnemos-memory-ux-v1',
      generatedAt: '2026-05-18T12:00:00.000Z',
      status: 'ready',
      safety: expect.objectContaining({
        providerCall: false,
        networkCall: false,
        durableMutation: false,
        dashboardCanWriteMemory: false,
        cliWriteRequiresApproval: true,
        telegramWriteRequiresApproval: true,
        rawJsonHiddenByDefault: true,
      }),
    }));
    expect(snapshot.summary.surfaces).toEqual(['dashboard', 'cli', 'telegram']);
    expect(snapshot.panels.map((panel) => panel.title)).toEqual(expect.arrayContaining([
      'Memory Health',
      'Procedural Rules',
      'Wiki Query',
      'Revocation',
    ]));
  });

  it('formats compact CLI and Telegram summaries', () => {
    const service = new ZavorthMnemosMemoryUxService({
      lintService: { lint: () => ({ status: 'passed', summary: { findings: 0 } } as any) },
      proceduralMemoryService: { list: () => ({ summary: { total: 0 }, rules: [] } as any) },
    });

    expect(service.formatCli()).toContain('Mnemos Memory UX');
    expect(service.formatCli()).toContain('zavorth memory mnemos');
    expect(service.formatTelegram()).toContain('/mnemos');
    expect(service.formatTelegram()).toContain('Procedural');
  });

  it('promotes blocked lint to blocked UX status', () => {
    const service = new ZavorthMnemosMemoryUxService({
      lintService: { lint: () => ({ status: 'blocked', summary: { findings: 2 } } as any) },
      proceduralMemoryService: { list: () => ({ summary: { total: 0 }, rules: [] } as any) },
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.lintFindings).toBe(2);
  });
});
