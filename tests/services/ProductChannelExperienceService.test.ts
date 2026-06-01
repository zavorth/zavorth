import { ProductChannelExperienceService } from '../../src/services/ProductChannelExperienceService';
import { buildZavorthProductModeSnapshot } from '../../src/services/ProductModeService';

describe('ProductChannelExperienceService', () => {
  it('keeps chat mode focused on control plus telegram and hides secondary channels', () => {
    const service = new ProductChannelExperienceService({
      now: () => new Date('2026-04-14T21:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      productMode: buildZavorthProductModeSnapshot('chat', 'core'),
      controlEntry: 'http://127.0.0.1:33333/dashboard',
      controlReady: true,
      telegramReady: false,
      discordReady: false,
      cliEntry: 'npm run cli -- status',
      cliReady: true,
    });

    expect(snapshot.recommendedJourney).toBe('web-only');
    expect(snapshot.visibleSurfaces).toEqual(expect.arrayContaining(['control', 'telegram']));
    expect(snapshot.hiddenSecondaryChannels).toEqual(expect.arrayContaining(['Discord', 'Slack', 'WhatsApp']));
    expect(snapshot.surfaces.find((entry) => entry.id === 'discord')).toEqual(
      expect.objectContaining({
        visible: false,
      }),
    );
  });

  it('shows the full operational path when operator mode is active', () => {
    const service = new ProductChannelExperienceService({
      now: () => new Date('2026-04-14T21:05:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      productMode: buildZavorthProductModeSnapshot('operator', 'ops'),
      controlEntry: 'http://127.0.0.1:33333/dashboard',
      controlReady: true,
      telegramReady: true,
      discordReady: true,
      cliEntry: 'npm run cli -- status',
      cliReady: true,
    });

    expect(snapshot.recommendedJourney).toBe('web+telegram');
    expect(snapshot.visibleSurfaces).toEqual(expect.arrayContaining(['control', 'telegram', 'discord', 'cli']));
    expect(snapshot.visibleSurfaces).not.toContain('classic');
    expect(snapshot.hiddenSecondaryChannels).toEqual([]);
    expect(snapshot.legacySurfaces).toEqual([]);
  });
});
