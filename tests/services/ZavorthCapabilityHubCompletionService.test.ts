import fs from 'node:fs';
import path from 'node:path';
import { CAPABILITY_HUB_COMPLETION_CONTRACT_VERSION } from '../../src/contracts/CapabilityHubCompletionContract';
import { ZavorthCapabilityHubCompletionApiService } from '../../src/services/ZavorthCapabilityHubCompletionApiService';
import { ZavorthCapabilityHubCompletionService } from '../../src/services/ZavorthCapabilityHubCompletionService';


describe('ZavorthCapabilityHubCompletionService', () => {
  const testDir = path.join(__dirname, 'data', '__test-capability-hub-completion');
  const statePath = path.join(testDir, 'queue.json');
  const ledgerPath = path.join(testDir, 'queue-ledger.jsonl');
  const requestLedgerPath = path.join(testDir, 'activation-requests.jsonl');

  beforeEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('accepts phases 0-11 and natural journeys with no live or secret violations', () => {
    const service = new ZavorthCapabilityHubCompletionService(runtime());
    const snapshot = service.buildSnapshot();
    const secondSnapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe(CAPABILITY_HUB_COMPLETION_CONTRACT_VERSION);
    expect(snapshot.status).toBe('passed');
    expect(secondSnapshot.status).toBe('passed');
    expect(snapshot.summary.phases).toBe(12);
    expect(snapshot.summary.phasesPassed).toBe(12);
    expect(snapshot.summary.journeysPassed).toBe(snapshot.summary.journeys);
    expect(snapshot.summary.liveViolations).toBe(0);
    expect(snapshot.summary.secretSerializationViolations).toBe(0);
    expect(snapshot.journeys.map((journey) => journey.id)).toEqual(expect.arrayContaining([
      'journey-create-slack-ticket',
      'journey-approval-guard',
      'journey-controlled-request',
    ]));
  });

  it('renders concise completion report through API facade', () => {
    const api = new ZavorthCapabilityHubCompletionApiService(runtime());
    const report = api.renderReport();

    expect(report).toContain('Capability Hub completo');
    expect(report).toContain('checkpoint-11 passed');
    expect(report).not.toContain('xoxb-redact-fixture');
  });

  function runtime() {
    return {
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      statePath,
      ledgerPath,
      requestLedgerPath,
      env: {},
    };
  }
});
