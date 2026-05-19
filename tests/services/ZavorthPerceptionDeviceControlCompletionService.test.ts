import { ZavorthPerceptionDeviceControlCompletionService } from '../../src/services/ZavorthPerceptionDeviceControlCompletionService.js';

describe('ZavorthPerceptionDeviceControlCompletionService Intent model0', () => {
  it('certifies PC, browser and Android perception/control without unsafe defaults', async () => {
    const snapshot = await new ZavorthPerceptionDeviceControlCompletionService({
      now: () => new Date('2026-05-14T14:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-14.checkpoint-10-perception-device-control-completion');
    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary.pcScreenshotReadOnlyReady).toBe(true);
    expect(snapshot.summary.browserViewReady).toBe(true);
    expect(snapshot.summary.browserControlPolicyGated).toBe(true);
    expect(snapshot.summary.androidObserveReady).toBe(true);
    expect(snapshot.summary.androidControlPolicyGated).toBe(true);
    expect(snapshot.summary.naturalRoutingReady).toBe(true);
    expect(snapshot.summary.visualArtifactsInReceipts).toBe(true);
    expect(snapshot.summary.rawSecretsSerialized).toBe(false);
    expect(snapshot.summary.workspaceMutationPerformed).toBe(false);
    expect(snapshot.summary.externalIoPerformed).toBe(false);
    expect(snapshot.safety.pcObservationReadOnlyByDefault).toBe(true);
    expect(snapshot.safety.browserControlRequiresReadinessAndApproval).toBe(true);
    expect(snapshot.safety.androidTapTypeInstallRequiresApproval).toBe(true);
    expect(snapshot.safety.terminalAutomationBypassBlocked).toBe(true);
    expect(snapshot.safety.secretScreenAutomationBlocked).toBe(true);
    expect(snapshot.safety.noLiveDeviceMutationDuringCertification).toBe(true);
    expect('tap/type/click/install/control stays gated').toContain('tap/type/click/install/control');
    expect(snapshot.entries.map((entry) => entry.label)).toEqual(expect.arrayContaining([
      'PC screenshot/read-only vision',
      'Browser DOM/screenshot view',
      'Android ADB observe/read-only evidence',
      'Android tap/type/install control remains approval-gated',
    ]));
    expect(snapshot.naturalCommands.map((command) => command.utterance)).toEqual(expect.arrayContaining([
      'look at my screen',
      'check this website visually',
      'look at my connected phone',
      'tap/type on my phone to fix this',
    ]));
  });
});
