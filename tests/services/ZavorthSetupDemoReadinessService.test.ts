import { ZavorthSetupDemoReadinessService } from '../../src/services/ZavorthSetupDemoReadinessService';

describe('ZavorthSetupDemoReadinessService', () => {
  it('builds a ready Phase D setup and demo snapshot under ten minutes', () => {
    const snapshot = new ZavorthSetupDemoReadinessService({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.surface).toBe('setup-demo-readiness');
    expect(snapshot.phase).toBe('D');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.installOnboard.targetMinutes).toBe(10);
    expect(snapshot.installOnboard.estimatedMinutes).toBeLessThanOrEqual(10);
    expect(snapshot.installOnboard.steps.map((step) => step.command)).toEqual(expect.arrayContaining([
      'npm run setup -- --dry-run',
      'npm run go -- --dry-run --json',
      'npm run zavorth:setup-demo:check',
    ]));
  });

  it('seeds the real product demo surfaces without secrets or live external IO', () => {
    const snapshot = new ZavorthSetupDemoReadinessService().buildSnapshot();

    expect(snapshot.demoSeed.fixtures.map((fixture) => fixture.id)).toEqual(expect.arrayContaining([
      'product-home',
      'github-governed-review',
      'daily-assistant',
      'receipts',
    ]));
    expect(snapshot.safety).toEqual({
      noRawSecretsSerialized: true,
      noLiveExternalIoInSeed: true,
      approvalsRequiredForWritesAndSends: true,
      receiptsRequiredForDemoActions: true,
      deterministicWithoutGitHubOrTelegramTokens: true,
    });
    expect(snapshot.demoSeed.fixtures.every((fixture) => fixture.externalIo !== 'none' || fixture.successSignal)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toMatch(/\b(sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-)/);
  });

  it('renders a human runbook for the operator', () => {
    const service = new ZavorthSetupDemoReadinessService({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
    });
    const report = service.renderText();

    expect(report).toContain('[zavorth-setup-demo-readiness]');
    expect(report).toContain('status=ready');
    expect(report).toContain('[10-minute path]');
    expect(report).toContain('GitHub Governed Review');
    expect(report).toContain('Telegram Daily Assistant');
    expect(report).toContain('npm run zavorth:setup-demo:check');
  });
});
