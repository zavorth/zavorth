import { ZavorthLiveCertificationMatrixService } from '../../src/services/ZavorthLiveCertificationMatrixService.js';

describe('ZavorthLiveCertificationMatrixService', () => {
  it('builds the Intent model3 daily runtime certification matrix', async () => {
    const service = new ZavorthLiveCertificationMatrixService({
      now: () => new Date('2026-05-14T13:00:00.000Z'),
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-14.checkpoint-13-live-certification-matrix');
    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary.dashboardCertified).toBe(true);
    expect(snapshot.summary.cliCertified).toBe(true);
    expect(snapshot.summary.providerP0Certified).toBe(true);
    expect(snapshot.summary.channelMeshCertified).toBe(true);
    expect(snapshot.summary.sandboxCertified).toBe(true);
    expect(snapshot.summary.approvalsCertified).toBe(true);
    expect(snapshot.summary.receiptsCertified).toBe(true);
    expect(snapshot.summary.subagentsCertified).toBe(true);
    expect(snapshot.summary.skillsCertified).toBe(true);
    expect(snapshot.summary.schedulerCertified).toBe(true);
    expect(snapshot.summary.perceptionDeviceCertified).toBe(true);
    expect(snapshot.summary.abuseCases).toBeGreaterThanOrEqual(8);
    expect(snapshot.summary.abuseCasesControlled).toBe(snapshot.summary.abuseCases);
    expect(snapshot.summary.rawSecretsSerialized).toBe(false);
    expect(snapshot.summary.workspaceMutationPerformed).toBe(false);
    expect(snapshot.summary.externalIoPerformed).toBe(false);
    expect(snapshot.matrix.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'dashboard',
      'cli',
      'providers-p0',
      'channels',
      'sandbox',
      'approvals',
      'receipts',
      'subagents',
      'skills',
      'scheduler',
      'perception-device',
    ]));
    expect(snapshot.abuseCases.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'prompt-injection',
      'malicious-skill',
      'approval-replay',
      'cron-escalation',
      'subagent-infinite-spawn',
      'mutation-without-sandbox',
    ]));
  });
});
