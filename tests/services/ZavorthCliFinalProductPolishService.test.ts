import { ZavorthCliFinalProductPolishService } from '../../src/services/ZavorthCliFinalProductPolishService.js';

describe('ZavorthCliFinalProductPolishService', () => {
  it('certifies the final CLI product polish contract', () => {
    const service = new ZavorthCliFinalProductPolishService({
      now: () => new Date('2026-05-14T12:00:00.000Z'),
      rootDir: process.cwd(),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-14.phase-12-cli-final-product-polish');
    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary.dashboardPath).toBe('/dashboard');
    expect(snapshot.summary.inkPreviewRendersOnce).toBe(true);
    expect(snapshot.summary.inkInteractiveMode).toBe(true);
    expect(snapshot.summary.noInfiniteRenderLoop).toBe(true);
    expect(snapshot.summary.hermesInspiredZavorthIdentity).toBe(true);
    expect(snapshot.summary.cliCanExecuteMutations).toBe(false);
    expect(snapshot.summary.rawSecretsSerialized).toBe(false);
    expect(snapshot.summary.requiredCommands).toEqual(expect.arrayContaining([
      'zavorth onboard',
      'zavorth go',
      'zavorth doctor',
      'zavorth providers',
      'zavorth channels',
      'zavorth missions',
      'zavorth receipts',
      'zavorth schedule',
      'zavorth skills',
      'zavorth agents',
    ]));
  });
});
