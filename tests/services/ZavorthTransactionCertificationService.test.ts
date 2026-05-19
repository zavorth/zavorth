import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthTransactionCertificationService } from '../../src/services/ZavorthTransactionCertificationService.js';

const now = new Date('2026-05-11T12:00:00.000Z');

describe('ZavorthTransactionCertificationService', () => {
  let tempDir: string;
  let service: ZavorthTransactionCertificationService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-transaction-certification-test-'));
    service = new ZavorthTransactionCertificationService({
      now: () => now,
      ledgerFile: path.join(tempDir, 'approval-ledger.jsonl'),
      credentialStoreFile: path.join(tempDir, 'credential-refs.jsonl'),
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('certifies the transaction plane across surfaces without live execution', () => {
    const report = service.certify();

    expect(report.version).toBe('zavorth-transaction-certification/checkpoint-9');
    expect(report.status).toBe('passed');
    expect(report.scenarioCount).toBe(5);
    expect(report.passedScenarioCount).toBe(5);
    expect(report.failedScenarioCount).toBe(0);
    expect(report.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'approval-gate', passed: true }),
        expect.objectContaining({ kind: 'credential-ref-gate', passed: true }),
        expect.objectContaining({ kind: 'typed-connector-simulation', passed: true }),
        expect.objectContaining({ kind: 'command-center-projection', passed: true }),
        expect.objectContaining({ kind: 'secret-redaction', passed: true }),
        expect.objectContaining({ kind: 'no-live-execution', passed: true }),
      ]),
    );
    expect(report.safety).toEqual(expect.objectContaining({
      noLiveExecution: true,
      noHiddenLiveAction: true,
      externalSideEffects: false,
      liveActionApplied: false,
    }));
  });

  it('records the expected scenario outcomes and enabled actions', () => {
    const report = service.certify();

    expect(report.scenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'web-trade-approval',
          observedStatus: 'approval-required',
          observedTone: 'attention',
          enabledActions: expect.arrayContaining(['request-approval', 'reject-preview', 'simulate', 'open-ledger']),
        }),
        expect.objectContaining({
          id: 'api-approved-paper-trade',
          observedStatus: 'simulated',
          connectorStatus: 'simulated',
        }),
        expect.objectContaining({
          id: 'cli-credential-required',
          observedStatus: 'credential-required',
          enabledActions: expect.arrayContaining(['provide-credential-ref']),
        }),
        expect.objectContaining({
          id: 'telegram-price-monitor',
          observedStatus: 'simulated',
          naturalFirstRoute: 'tool-preview',
        }),
        expect.objectContaining({
          id: 'web-raw-secret-blocked',
          observedStatus: 'blocked',
          observedTone: 'blocked',
        }),
      ]),
    );
  });

  it('does not serialize raw secrets into the certification report', () => {
    const report = service.certify();

    expect(JSON.stringify(report)).not.toContain('sk-super-secret-value-123456');
    expect(report.scenarios.find((scenario) => scenario.id === 'web-raw-secret-blocked')?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'redaction',
          passed: true,
        }),
      ]),
    );
  });
});
