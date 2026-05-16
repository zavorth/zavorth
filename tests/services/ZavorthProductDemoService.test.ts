import { ZavorthProductDemoService } from '../../src/services/ZavorthProductDemoService';

describe('ZavorthProductDemoService', () => {
  it('builds the Phase F product demo around start, visual demo and connector doctor', () => {
    const snapshot = new ZavorthProductDemoService({
      now: () => new Date('2026-05-16T14:00:00.000Z'),
      env: {},
    }).buildSnapshot();

    expect(snapshot.phase).toBe('F');
    expect(snapshot.surface).toBe('product-demo');
    expect(snapshot.command.primary).toBe('zavorth start');
    expect(snapshot.command.connectors).toBe('zavorth connectors doctor');
    expect(snapshot.quickstart.estimatedMinutes).toBeLessThanOrEqual(10);
    expect(snapshot.quickstart.steps.map((step) => step.command)).toEqual(expect.arrayContaining([
      'zavorth start',
      'zavorth go',
      'zavorth demo browser',
      'npm run zavorth:demo:check',
    ]));
    expect(snapshot.visualHome).toEqual(expect.objectContaining({
      route: '/dashboard',
      openCommand: 'zavorth go',
      browserDemoCommand: 'zavorth demo browser',
      localVisualDemo: true,
    }));
  });

  it('reports exact GitHub, Telegram and Discord setup gaps without pretending connectors are live', () => {
    const snapshot = new ZavorthProductDemoService({ env: {} }).buildSnapshot();

    expect(snapshot.status).toBe('needs_setup');
    expect(snapshot.connectors.checklist.map((entry) => entry.id)).toEqual([
      'github',
      'github-pr-comment',
      'telegram',
      'discord',
    ]);
    expect(snapshot.doctor.exactMissing.join(' ')).toContain('gh auth status');
    expect(snapshot.doctor.exactMissing.join(' ')).toContain('TELEGRAM_BOT_TOKEN');
    expect(snapshot.doctor.exactMissing.join(' ')).toContain('TELEGRAM_ALLOWED_USER_IDS');
    expect(snapshot.doctor.exactMissing.join(' ')).toContain('DISCORD_BOT_TOKEN');
    expect(snapshot.doctor.exactMissing.join(' ')).toContain('DISCORD_ALLOWED_GUILD_IDS');
    expect(snapshot.safety).toEqual({
      noRawSecretsSerialized: true,
      noExternalMutationBeforeApproval: true,
      demoDoesNotPretendLiveConnectors: true,
      internalRuntimeNamesHiddenFromPrimaryPath: true,
    });
  });

  it('marks connector checklist ready when safe readiness signals are present', () => {
    const snapshot = new ZavorthProductDemoService({
      env: {
        GH_TOKEN: 'present',
        TELEGRAM_BOT_TOKEN: 'present',
        TELEGRAM_ALLOWED_USER_IDS: '42',
        DISCORD_BOT_TOKEN: 'present',
        DISCORD_ALLOWED_GUILD_IDS: 'guild-1',
        DISCORD_OWNER_USER_IDS: 'owner-1',
      },
    }).buildSnapshot();

    expect(snapshot.status).toBe('ready');
    expect(snapshot.doctor.exactMissing).toEqual([]);
    expect(snapshot.connectors.summary).toBe('4/4 ready, 0 need setup or live check.');
  });

  it('renders product and doctor output for humans', () => {
    const service = new ZavorthProductDemoService({ env: {} });

    expect(service.renderText()).toContain('Zavorth Demo');
    expect(service.renderText()).toContain('10-minute path');
    expect(service.renderText()).toContain('Visual Home');
    expect(service.renderText()).toContain('zavorth demo browser');
    expect(service.renderDoctor()).toContain('Zavorth Demo Doctor');
    expect(service.renderDoctor()).toContain('Exact missing setup:');
  });
});
