import { ZavorthSchedulerPerceptionDeviceLiveCompletionService } from '../../src/services/ZavorthSchedulerPerceptionDeviceLiveCompletionService.js';

describe('ZavorthSchedulerPerceptionDeviceLiveCompletionService Phase 7', () => {
  it('certifies scheduler, perception and device completion without unsafe defaults', async () => {
    const snapshot = await new ZavorthSchedulerPerceptionDeviceLiveCompletionService({
      now: () => new Date('2026-05-14T13:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-14.phase-7-scheduler-perception-device-live-completion');
    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary.schedulerDailyUseReady).toBe(true);
    expect(snapshot.summary.perceptionReadOnlyReady).toBe(true);
    expect(snapshot.summary.deviceCompanionReady).toBe(true);
    expect(snapshot.summary.rawSecretsSerialized).toBe(false);
    expect(snapshot.summary.workspaceMutationPerformed).toBe(false);
    expect(snapshot.summary.externalIoPerformed).toBe(false);
    expect(snapshot.liveCompletion.scheduledLiveTicksUseGateway).toBe(true);
    expect(snapshot.liveCompletion.androidAdbRequiresHostAuthorization).toBe(true);
    expect(snapshot.liveCompletion.browserLiveRequiresSidecarReadiness).toBe(true);
    expect(snapshot.liveCompletion.computerMutationRequiresApproval).toBe(true);
    expect(snapshot.safety.noDirectSchedulerDispatch).toBe(true);
    expect(snapshot.safety.noTerminalAutomationBypass).toBe(true);
    expect(snapshot.safety.noSecretScreenAutomation).toBe(true);
    expect(snapshot.entries.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'scheduler.daily-ops',
      'perception.cross-surface',
      'device.native-companion',
      'device.owner-gated-live',
    ]));
  });
});
