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

  it('creates a setup ticket from natural language without serializing raw secrets', () => {
    const service = new ZavorthCapabilityNaturalOperatorService(runtime());
    const result = service.execute({
      text: 'quero configurar meu Slack com token xoxb-redact-fixture',
      actorLabel: 'owner',
    });

    expect(result.contractVersion).toBe(CAPABILITY_NATURAL_OPERATOR_CONTRACT_VERSION);
    expect(result.decision.action).toBe('create_setup_ticket');
    expect(result.decision.packId).toBe('official-communication-channels');
    expect(result.createdTicket?.status).toBe('needs_readiness');
    expect(result.createdTicket?.secureRequests.some((request) => request.inputMode === 'secure-secret-entry')).toBe(true);
    expect(result.safety).toMatchObject({
      rawSecretsSerialized: false,
      liveActivationApplied: false,
      naturalLanguageMayOnlyPlan: true,
    });
    expect(fs.readFileSync(statePath, 'utf8')).not.toContain('xoxb-redact-fixture');
  });

  it('runs readiness view from natural language without creating tickets', () => {
    const result = new ZavorthCapabilityNaturalOperatorService(runtime()).execute({
      text: 'verifique release readiness',
      targetItemId: 'skill:release-readiness',
      packId: 'official-ops-skills',
    });

    expect(result.decision.action).toBe('run_readiness');
    expect(result.console.view).toBe('readiness');
    expect(result.createdTicket).toBeNull();
    expect(result.console.readiness?.summary.items).toBe(1);
  });

  it('prepares controlled activation request from natural language only with owner approval', () => {
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

    const result = new ZavorthCapabilityNaturalOperatorService(runtime()).execute({
      text: `crie o pedido controlado para ${ticket.id}`,
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

  it('renders a plain reply through API facade', () => {
    const api = new ZavorthCapabilityNaturalOperatorApiService(runtime());
    const reply = api.renderReply({
      text: 'mostre a fila de configuracao',
    });

    expect(reply).toContain('Mostrei a fila');
    expect(reply).toContain('sem ativacao live');
    expect(reply).not.toContain('ThirdPartyAgent');
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
