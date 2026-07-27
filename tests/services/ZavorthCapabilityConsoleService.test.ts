import fs from 'node:fs';
import path from 'node:path';
import { CAPABILITY_CONSOLE_CONTRACT_VERSION } from '../../src/contracts/CapabilityConsoleContract';
import { ZavorthCapabilityConsoleApiService } from '../../src/services/ZavorthCapabilityConsoleApiService';
import { ZavorthCapabilityConsoleService } from '../../src/services/ZavorthCapabilityConsoleService';
import { ZavorthCapabilitySetupExecutorService } from '../../src/services/ZavorthCapabilitySetupExecutorService';
import { ZavorthCapabilitySetupQueueService } from '../../src/services/ZavorthCapabilitySetupQueueService';

describe('ZavorthCapabilityConsoleService', () => {
  const testDir = path.join(process.cwd(), 'data', '__test-capability-console');
  const statePath = path.join(testDir, 'queue.json');
  const ledgerPath = path.join(testDir, 'queue-ledger.jsonl');
  const requestLedgerPath = path.join(testDir, 'activation-requests.jsonl');

  beforeEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('aggregates catalog, packs, readiness, queue and request ledger in one snapshot', () => {
    const service = new ZavorthCapabilityConsoleService(runtime());
    const snapshot = service.buildSnapshot({
      packId: 'official-ops-skills',
      targetItemId: 'skill:release-readiness',
      view: 'overview',
    });

    expect(snapshot.contractVersion).toBe(CAPABILITY_CONSOLE_CONTRACT_VERSION);
    expect(snapshot.policy).toMatchObject({
      singleUserSurface: true,
      rawSecretsSerialized: false,
      liveActivationApplied: false,
      ownerApprovalBeforeLive: true,
    });
    expect(snapshot.summary.totalCatalogItems).toBeGreaterThan(0);
    expect(snapshot.summary.packs).toBe(1);
    expect(snapshot.readiness?.summary.items).toBe(1);
    expect(snapshot.queue.summary.total).toBe(0);
    expect(snapshot.requests.summary.totalRequests).toBe(0);
    expect(snapshot.commandHints.some((hint) => hint.id === 'setup-executor')).toBe(true);
    expect(snapshot.approvalSurface).toEqual(expect.objectContaining({
      diffPreviewSupported: true,
      runObservatoryCommand: 'zavorth observatory --json',
    }));
  });

  it('surfaces open tickets and activation requests together', () => {
    const queue = new ZavorthCapabilitySetupQueueService(runtime());
    const ticket = queue.createTicket({
      packId: 'official-ops-skills',
      targetItemId: 'skill:release-readiness',
      text: 'ative release readiness',
      audience: 'owner',
      approvalId: 'approval-release',
      completedManualSteps: ['review scope and approval budget'],
      completedReadinessChecks: ['release-readiness-readiness', 'artifact-receipt-policy'],
    });
    new ZavorthCapabilitySetupExecutorService(runtime()).execute({
      ticketId: ticket.id,
      ownerApprovalId: 'approval-release',
      confirmOwnerControlledActivation: true,
      dryRun: false,
    });

    const snapshot = new ZavorthCapabilityConsoleService(runtime()).buildSnapshot({
      view: 'requests',
      status: 'closed',
    });

    expect(snapshot.queue.summary.closed).toBe(1);
    expect(snapshot.requests.summary.totalRequests).toBe(1);
    expect(JSON.stringify(snapshot)).not.toContain('SECRET_REF_PRESENT');
  });

  it('renders a concise operator console through API facade', () => {
    const api = new ZavorthCapabilityConsoleApiService(runtime());
    const output = api.renderConsole({
      view: 'overview',
      packId: 'official-ai-access',
      targetItemId: 'provider:ollama-local',
      localRoutes: {
        'provider:ollama-local': true,
      },
    });

    expect(output).toContain('Zavorth Capability Console');
    expect(output).toContain('Catalog:');
    expect(output).toContain('Preview e approval:');
    expect(output).toContain('aplicar rascunho <planId>');
    expect(output).toContain('Comandos uteis:');
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
