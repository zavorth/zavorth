import fs from 'node:fs';
import path from 'node:path';
import { CAPABILITY_NATURAL_OPERATOR_CONTRACT_VERSION } from '../../src/contracts/CapabilityNaturalOperatorContract';
import { ZavorthCapabilityNaturalOperatorApiService } from '../../src/services/ZavorthCapabilityNaturalOperatorApiService';
import { ZavorthCapabilityNaturalOperatorService } from '../../src/services/ZavorthCapabilityNaturalOperatorService';
import { ZavorthCapabilitySetupQueueService } from '../../src/services/ZavorthCapabilitySetupQueueService';

describe('ZavorthCapabilityNaturalOperatorService', () => {
  const testDir = path.join(process.cwd(), 'data', '__test-capability-natural-operator');
  const statePath = path.join(testDir, 'queue.json');
  const ledgerPath = path.join(testDir, 'queue-ledger.jsonl');
  const requestLedgerPath = path.join(testDir, 'activation-requests.jsonl');

  beforeEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('creates a setup ticket from structured action (not free-text keywords) and redacts secrets', () => {
    const service = new ZavorthCapabilityNaturalOperatorService(runtime());
    const result = service.execute({
      text: 'configure Slack with token redacted-slack-token-fixture',
      action: 'create_setup_ticket',
      packId: 'official-communication-channels',
      targetItemId: 'channel:slack',
      createTicket: true,
      actorLabel: 'owner',
    });

    expect(result.contractVersion).toBe(CAPABILITY_NATURAL_OPERATOR_CONTRACT_VERSION);
    expect(result.decision.action).toBe('create_setup_ticket');
    expect(result.decision.packId).toBe('official-communication-channels');
    expect(result.createdTicket?.status).toBe('needs_readiness');
    expect(result.createdTicket?.secureRequests.some((request) => request.inputMode === 'secure-secret-entry')).toBe(
      true,
    );
    expect(result.safety).toMatchObject({
      rawSecretsSerialized: false,
      liveActivationApplied: false,
      naturalLanguageMayOnlyPlan: true,
    });
    expect(fs.readFileSync(statePath, 'utf8')).not.toContain('redacted-slack-token-fixture');
  });

  it('does not create tickets from free-text setup phrases alone', () => {
    const result = new ZavorthCapabilityNaturalOperatorService(runtime()).execute({
      text: 'I want to configure Slack with token redacted-slack-token-fixture',
      actorLabel: 'owner',
    });
    expect(result.decision.action).toBe('show_console');
    expect(result.createdTicket).toBeNull();
  });

  it('runs readiness from structured action without creating tickets', () => {
    const result = new ZavorthCapabilityNaturalOperatorService(runtime()).execute({
      text: 'check release readiness',
      action: 'run_readiness',
      targetItemId: 'skill:release-readiness',
      packId: 'official-ops-skills',
    });

    expect(result.decision.action).toBe('run_readiness');
    expect(result.console.view).toBe('readiness');
    expect(result.createdTicket).toBeNull();
    expect(result.console.readiness?.summary.items).toBe(1);
  });

  it('prepares controlled activation from structured flags only with owner approval', () => {
    const queue = new ZavorthCapabilitySetupQueueService(runtime());
    const ticket = queue.createTicket({
      packId: 'official-ops-skills',
      targetItemId: 'skill:release-readiness',
      text: 'activate release readiness',
      audience: 'owner',
      approvalId: 'approval-release',
      completedManualSteps: ['review scope and approval budget'],
      completedReadinessChecks: ['release-readiness-readiness', 'artifact-receipt-policy'],
    });

    const result = new ZavorthCapabilityNaturalOperatorService(runtime()).execute({
      text: `controlled request for ${ticket.id}`,
      action: 'prepare_activation_request',
      ticketId: ticket.id,
      ownerApprovalId: 'approval-release',
      confirmOwnerControlledActivation: true,
      execute: true,
    });

    expect(result.decision.action).toBe('prepare_activation_request');
    expect(result.executorResult?.status).toBe('activation_request_created');
    expect(result.executorResult?.safety.liveActivationApplied).toBe(false);
    expect(fs.readFileSync(requestLedgerPath, 'utf8')).toContain('approval-release');
  });

  it('renders a plain reply through API facade (EN)', () => {
    const api = new ZavorthCapabilityNaturalOperatorApiService(runtime());
    const reply = api.renderReply({
      text: 'show setup queue',
      action: 'show_queue',
    });

    expect(reply).toMatch(/queue|Setup|console|Showed/i);
    expect(reply).toMatch(/Safety|Decision|no live activation/i);
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
