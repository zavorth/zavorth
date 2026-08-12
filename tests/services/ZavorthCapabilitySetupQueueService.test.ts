import fs from 'node:fs';
import path from 'node:path';
import { CAPABILITY_SETUP_QUEUE_CONTRACT_VERSION } from '../../src/contracts/CapabilitySetupQueueContract';
import { ZavorthCapabilitySetupQueueApiService } from '../../src/services/ZavorthCapabilitySetupQueueApiService';
import { ZavorthCapabilitySetupQueueService } from '../../src/services/ZavorthCapabilitySetupQueueService';

describe('ZavorthCapabilitySetupQueueService', () => {
  const testDir = path.join(process.cwd(), 'data', '__test-capability-setup-queue');
  const statePath = path.join(testDir, 'queue.json');
  const ledgerPath = path.join(testDir, 'queue-ledger.jsonl');

  beforeEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('persists setup tickets without serializing raw secrets', () => {
    const service = createService();
    const ticket = service.createTicket({
      packId: 'official-ops-skills',
      targetItemId: 'skill:zavorth-pulse',
      text: 'configure zavorth pulse with token sk-test-secret-value-1234567890',
      audience: 'everyday',
      actorLabel: 'owner',
    });

    expect(ticket.status).toBe('needs_secret');
    expect(ticket.safety.rawSecretsSerialized).toBe(false);
    expect(ticket.secureRequests.some((request) => request.inputMode === 'secure-secret-entry')).toBe(true);
    expect(fs.existsSync(statePath)).toBe(true);
    expect(fs.existsSync(ledgerPath)).toBe(true);
    expect(fs.readFileSync(statePath, 'utf8')).not.toContain('sk-test-secret-value-1234567890');
    expect(fs.readFileSync(ledgerPath, 'utf8')).toContain('ticket-created');
  });

  it('refreshes persisted tickets through readiness and approval progress', () => {
    const service = createService();
    const created = service.createTicket({
      packId: 'official-ops-skills',
      targetItemId: 'skill:release-readiness',
      text: 'ative release readiness',
      audience: 'owner',
    });
    const withManualStep = service.updateTicket({
      ticketId: created.id,
      action: 'complete-manual-step',
      manualStep: 'review scope and approval budget',
      actorLabel: 'owner',
    });
    const withFirstCheck = service.updateTicket({
      ticketId: created.id,
      action: 'complete-readiness-check',
      readinessCheck: 'release-readiness-readiness',
      actorLabel: 'owner',
    });
    const withSecondCheck = service.updateTicket({
      ticketId: created.id,
      action: 'complete-readiness-check',
      readinessCheck: 'artifact-receipt-policy',
      actorLabel: 'owner',
    });
    const ready = service.updateTicket({
      ticketId: created.id,
      action: 'attach-approval',
      approvalId: 'approval-release',
      actorLabel: 'owner',
    });

    expect(withManualStep.status).toBe('needs_readiness');
    expect(withFirstCheck.status).toBe('needs_readiness');
    expect(withSecondCheck.status).toBe('needs_approval');
    expect(ready.status).toBe('ready_for_owner');
    expect(ready.approvalId).toBe('approval-release');
    expect(ready.events.map((event) => event.action)).toContain('approval-attached');
  });

  it('lists tickets with queue policy and supports API facade', () => {
    const api = new ZavorthCapabilitySetupQueueApiService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      statePath,
      ledgerPath,
    });
    const ticket = api.createTicket({
      packId: 'official-ai-access',
      targetItemId: 'provider:anthropic',
      text: 'configure Claude',
      audience: 'technical',
    });

    const snapshot = api.listTickets({ status: 'open' });
    const report = api.renderReport();

    expect(snapshot.contractVersion).toBe(CAPABILITY_SETUP_QUEUE_CONTRACT_VERSION);
    expect(snapshot.policy).toMatchObject({
      persistentQueue: true,
      appendOnlyLedger: true,
      rawSecretsSerialized: false,
      liveActivationApplied: false,
    });
    expect(snapshot.summary.open).toBe(1);
    expect(snapshot.tickets[0].id).toBe(ticket.id);
    expect(report).toContain('Fila de configuracao');
  });

  it('keeps queue storage inside the Zavorth root', () => {
    expect(() => new ZavorthCapabilitySetupQueueService({
      statePath: path.resolve(process.cwd(), '..', 'outside-queue.json'),
    })).toThrow('must stay inside Zavorth root');
  });

  function createService(): ZavorthCapabilitySetupQueueService {
    return new ZavorthCapabilitySetupQueueService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      statePath,
      ledgerPath,
    });
  }
});

