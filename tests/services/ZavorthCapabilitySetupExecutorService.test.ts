import fs from 'node:fs';
import path from 'node:path';
import { CAPABILITY_SETUP_EXECUTOR_CONTRACT_VERSION } from '../../src/contracts/CapabilitySetupExecutorContract';
import { ZavorthCapabilitySetupExecutorApiService } from '../../src/services/ZavorthCapabilitySetupExecutorApiService';
import { ZavorthCapabilitySetupQueueService } from '../../src/services/ZavorthCapabilitySetupQueueService';
import { ZavorthCapabilitySetupExecutorService } from '../../src/services/ZavorthCapabilitySetupExecutorService';


describe('ZavorthCapabilitySetupExecutorService', () => {
  const testDir = path.join(__dirname, 'data', '__test-capability-setup-executor');
  const statePath = path.join(testDir, 'queue.json');
  const queueLedgerPath = path.join(testDir, 'queue-ledger.jsonl');
  const requestLedgerPath = path.join(testDir, 'activation-requests.jsonl');

  beforeEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('blocks tickets that are not ready for owner handoff', () => {
    const queue = createQueue();
    const ticket = queue.createTicket({
      packId: 'official-ops-skills',
      targetItemId: 'skill:zavorth-pulse',
      text: 'configure zavorth pulse',
      audience: 'everyday',
    });
    const executor = createExecutor();

    const result = executor.execute({
      ticketId: ticket.id,
      ownerApprovalId: 'approval-1',
      confirmOwnerControlledActivation: true,
      dryRun: false,
    });

    expect(result.contractVersion).toBe(CAPABILITY_SETUP_EXECUTOR_CONTRACT_VERSION);
    expect(result.status).toBe('blocked_not_ready');
    expect(result.activationRequest).toBeNull();
    expect(result.safety.liveActivationApplied).toBe(false);
    expect(fs.existsSync(requestLedgerPath)).toBe(false);
  });

  it('plans a dry-run activation request without consuming ready tickets', () => {
    const readyTicketId = createReadyReleaseTicket();
    const executor = createExecutor();

    const result = executor.execute({
      ticketId: readyTicketId,
      ownerApprovalId: 'approval-release',
      confirmOwnerControlledActivation: true,
    });
    const storedTicket = createQueue().getTicket(readyTicketId);

    expect(result.status).toBe('dry_run_ready');
    expect(result.dryRun).toBe(true);
    expect(result.activationRequest?.policy).toMatchObject({
      ownerApprovalBeforeLive: true,
      rawSecretsSerialized: false,
      liveActivationApplied: false,
      externalRootsAllowed: false,
    });
    expect(result.activationRequest?.command).toContain('capability-activation-flow');
    expect(storedTicket?.status).toBe('ready_for_owner');
    expect(fs.existsSync(requestLedgerPath)).toBe(false);
  });

  it('creates owner-controlled activation request and closes queue ticket when executed', () => {
    const readyTicketId = createReadyReleaseTicket();
    const executor = createExecutor();

    const result = executor.execute({
      ticketId: readyTicketId,
      ownerApprovalId: 'approval-release',
      confirmOwnerControlledActivation: true,
      dryRun: false,
      actorLabel: 'owner',
    });
    const storedTicket = createQueue().getTicket(readyTicketId);
    const ledger = fs.readFileSync(requestLedgerPath, 'utf8');

    expect(result.status).toBe('activation_request_created');
    expect(result.dryRun).toBe(false);
    expect(result.activationRequest?.ownerApprovalId).toBe('approval-release');
    expect(storedTicket?.status).toBe('approved');
    expect(ledger).toContain('approval-release');
    expect(ledger).not.toContain('SECRET_REF_PRESENT');
  });

  it('lists activation requests through API facade', () => {
    const readyTicketId = createReadyReleaseTicket();
    const api = new ZavorthCapabilitySetupExecutorApiService(runtime());
    api.execute({
      ticketId: readyTicketId,
      ownerApprovalId: 'approval-release',
      confirmOwnerControlledActivation: true,
      dryRun: false,
    });

    const snapshot = api.listRequests();
    const report = api.renderReport();

    expect(snapshot.summary.totalRequests).toBe(1);
    expect(snapshot.policy.requestLedgerAppendOnly).toBe(true);
    expect(snapshot.policy.liveActivationApplied).toBe(false);
    expect(report).toContain('Executor governado');
  });

  function createReadyReleaseTicket(): string {
    const queue = createQueue();
    const ticket = queue.createTicket({
      packId: 'official-ops-skills',
      targetItemId: 'skill:release-readiness',
      text: 'ative release readiness',
      audience: 'owner',
      approvalId: 'approval-release',
      completedManualSteps: ['review scope and approval budget'],
      completedReadinessChecks: ['release-readiness-readiness', 'artifact-receipt-policy'],
    });
    expect(ticket.status).toBe('ready_for_owner');
    return ticket.id;
  }

  function createQueue(): ZavorthCapabilitySetupQueueService {
    return new ZavorthCapabilitySetupQueueService(runtime());
  }

  function createExecutor(): ZavorthCapabilitySetupExecutorService {
    return new ZavorthCapabilitySetupExecutorService(runtime());
  }

  function runtime() {
    return {
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      statePath,
      ledgerPath: queueLedgerPath,
      requestLedgerPath,
    };
  }
});

