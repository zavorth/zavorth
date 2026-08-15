import { ZavorthCliFinalProductPolishService } from '../../src/services/ZavorthCliFinalProductPolishService.js';


describe('ZavorthCliFinalProductPolishService', () => {
  it('certifies the final CLI product polish contract', () => {
    const service = new ZavorthCliFinalProductPolishService({
      now: () => new Date('2026-05-14T12:00:00.000Z'),
      rootDir: __dirname,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-14.checkpoint-12-cli-final-product-polish');
    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary.dashboardPath).toBe('/zavorthControl');
    expect(snapshot.summary.inkPreviewRendersOnce).toBe(true);
    expect(snapshot.summary.inkInteractiveMode).toBe(true);
    expect(snapshot.summary.noInfiniteRenderLoop).toBe(true);
    expect(snapshot.summary.zavorthNativeCommandIdentity).toBe(true);
    expect(snapshot.summary.cliCanExecuteMutations).toBe(false);
    expect(snapshot.summary.rawSecretsSerialized).toBe(false);
    expect(snapshot.summary.requiredCommands).toEqual(expect.arrayContaining([
      'zavorth setup',
      'zavorth start',
      'zavorth open',
      'zavorth ready',
      'zavorth status',
      'zavorth chat',
      'zavorth doctor',
      'zavorth providers',
      'zavorth channels',
      'zavorth skills',
      'zavorth review',
      'zavorth trust',
    ]));
  });
});
