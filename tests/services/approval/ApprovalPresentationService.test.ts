import {
  APPROVAL_PRESENTATION_CONTRACT_VERSION,
  type ApprovalPresentationCard,
} from '../../../src/contracts/approval/ApprovalPresentationContract.js';
import {
  formatLeaseExpiry,
  formatRiskLabel,
  formatScopeLine,
  mapLeaseRiskToProofRisk,
  buildEffectsSummaryFromLease,
  normalizePresentationRisk,
} from '../../../src/services/approval/approvalPresentationFormatters.js';
import {
  ApprovalPresentationService,
  decisionActionToProofStatus,
  isOpenCard,
  type ApprovalLeaseLike,
} from '../../../src/services/approval/ApprovalPresentationService.js';
import {
  InMemoryProofLedgerAdapter,
  ProofLedgerService,
} from '../../../src/services/proof/ProofLedgerService.js';
import type { ApprovalLease } from '../../../src/approval-leases/ApprovalLeaseTypes.js';

const FIXED_NOW = new Date('2026-07-11T12:00:00.000Z');

function createService(options: {
  ledger?: ProofLedgerService | null;
  emitProofByDefault?: boolean;
} = {}): ApprovalPresentationService {
  let counter = 0;
  return new ApprovalPresentationService({
    now: () => FIXED_NOW,
    idFactory: (prefix) => `${prefix}-${++counter}`,
    proofLedger: options.ledger ?? null,
    emitProofByDefault: options.emitProofByDefault,
  });
}

function createLedger(): ProofLedgerService {
  let counter = 0;
  return new ProofLedgerService({
    now: () => FIXED_NOW,
    idFactory: (prefix) => `${prefix}-${++counter}`,
    ledgerId: 'ledger-approval-test',
    adapter: new InMemoryProofLedgerAdapter(),
  });
}

function sampleLease(overrides: Partial<ApprovalLease> = {}): ApprovalLease {
  return {
    leaseId: 'lease-1',
    subjectId: 'user-1',
    workspaceId: 'ws-1',
    channelId: 'desktop',
    toolQualifiedName: 'fs.write',
    toolFingerprint: 'fp-1',
    riskClassAtGrant: 'medium',
    allowedOperations: ['write', 'create'],
    createdAt: '2026-07-11T11:00:00.000Z',
    expiresAt: '2026-07-11T14:00:00.000Z',
    grantReason: 'Need to update config',
    grantSource: 'user_confirmed',
    auditCorrelationId: 'audit-1',
    ...overrides,
  };
}

describe('approvalPresentationFormatters', () => {
  test('formatLeaseExpiry remaining vs expired', () => {
    const remaining = formatLeaseExpiry('2026-07-11T13:00:00.000Z', FIXED_NOW);
    expect(remaining.expired).toBe(false);
    expect(remaining.remainingMs).toBe(60 * 60 * 1000);
    expect(remaining.label).toMatch(/Expires in/i);

    const expired = formatLeaseExpiry('2026-07-11T10:00:00.000Z', FIXED_NOW);
    expect(expired.expired).toBe(true);
    expect(expired.remainingMs).toBeLessThan(0);
    expect(expired.label).toMatch(/Expired/i);

    const none = formatLeaseExpiry(null, FIXED_NOW);
    expect(none.expired).toBe(false);
    expect(none.label).toBe('No expiry');
  });

  test('formatRiskLabel + mapLeaseRiskToProofRisk', () => {
    expect(formatRiskLabel('safe')).toBe('None');
    expect(formatRiskLabel('medium')).toBe('Medium');
    expect(formatRiskLabel('unknown')).toBe('Unknown');
    expect(mapLeaseRiskToProofRisk('safe')).toBe('none');
    expect(mapLeaseRiskToProofRisk('high')).toBe('high');
    expect(mapLeaseRiskToProofRisk('critical')).toBe('critical');
    expect(mapLeaseRiskToProofRisk('unknown')).toBe('none');
    expect(normalizePresentationRisk('safe')).toBe('none');
  });

  test('formatScopeLine + buildEffectsSummaryFromLease', () => {
    const line = formatScopeLine({
      subjectId: 'u1',
      workspaceId: 'ws-1',
      channelId: 'cli',
      toolName: 'fs.write',
      allowedOperations: ['write'],
    });
    expect(line).toContain('tool=fs.write');
    expect(line).toContain('workspace=ws-1');
    expect(line).toContain('ops=write');

    const effects = buildEffectsSummaryFromLease({
      toolQualifiedName: 'fs.write',
      allowedOperations: ['write', 'create'],
      riskClassAtGrant: 'high',
      workspaceId: 'ws-1',
      grantReason: 'demo',
      expiresAt: '2026-07-11T14:00:00.000Z',
    });
    expect(effects.some((e) => e.includes('fs.write'))).toBe(true);
    expect(effects.some((e) => e.includes('High') || e.includes('Risk'))).toBe(true);
  });
});

describe('ApprovalPresentationService', () => {
  test('fromLease maps risk/scope/expiry', () => {
    const service = createService();
    const card = service.fromLease(sampleLease(), {
      surface: 'runtime',
      approvalId: 'appr-9',
      runId: 'run-1',
    });

    expect(card.leaseId).toBe('lease-1');
    expect(card.approvalId).toBe('appr-9');
    expect(card.runId).toBe('run-1');
    expect(card.riskLevel).toBe('medium');
    expect(card.scope.toolName).toBe('fs.write');
    expect(card.scope.workspaceId).toBe('ws-1');
    expect(card.scope.allowedOperations).toEqual(['write', 'create']);
    expect(card.expiresAt).toBe('2026-07-11T14:00:00.000Z');
    expect(card.stage).toBe('leased');
    expect(card.surface).toBe('runtime');
    expect(card.effectsSummary.length).toBeGreaterThan(0);
    expect(card.decision.action).toBeNull();
  });

  test('fromLease marks revoked and expired stages', () => {
    const service = createService();
    const revoked = service.fromLease(sampleLease({
      revokedAt: '2026-07-11T11:30:00.000Z',
    }));
    expect(revoked.stage).toBe('revoked');

    const expired = service.fromLease(sampleLease({
      expiresAt: '2026-07-11T10:00:00.000Z',
    }));
    expect(expired.stage).toBe('expired');
  });

  test('fromLooseRequest builds card from partial fields', () => {
    const service = createService();
    const card = service.fromLooseRequest({
      id: 'loose-1',
      title: 'Write temp file',
      summary: 'Agent wants to write',
      risk: 'low',
      toolName: 'workspace.temp',
      workspaceId: 'ws-x',
      allowedOperations: ['write'],
      surface: 'desktop',
    });

    expect(card.id).toBe('loose-1');
    expect(card.title).toBe('Write temp file');
    expect(card.riskLevel).toBe('low');
    expect(card.scope.toolName).toBe('workspace.temp');
    expect(card.scope.workspaceId).toBe('ws-x');
    expect(card.stage).toBe('scoped');
    expect(card.surface).toBe('desktop');
  });

  test('listOpenCards filters revoked/expired', () => {
    const service = createService();
    const leases: ApprovalLeaseLike[] = [
      sampleLease({ leaseId: 'open-1' }),
      sampleLease({
        leaseId: 'expired-1',
        expiresAt: '2026-07-11T09:00:00.000Z',
      }),
      sampleLease({
        leaseId: 'revoked-1',
        revokedAt: '2026-07-11T11:00:00.000Z',
      }),
    ];

    const open = service.listOpenCards(leases);
    expect(open).toHaveLength(1);
    expect(open[0].leaseId).toBe('open-1');
  });

  test('recordDecision appends proof event when ledger injected', () => {
    const ledger = createLedger();
    const service = createService({ ledger });
    const card = service.fromLease(sampleLease(), {
      id: 'card-1',
      approvalId: 'appr-1',
      runId: 'run-1',
    });

    const decided = service.recordDecision(
      card,
      { action: 'approve', decidedBy: 'owner', reason: 'looks good' },
      { proofLedger: ledger, emitProof: true },
    );

    expect(decided.decision.action).toBe('approve');
    expect(decided.decision.decidedBy).toBe('owner');
    expect(decided.decision.reason).toBe('looks good');
    expect(decided.decision.decidedAt).toBe('2026-07-11T12:00:00.000Z');
    expect(decided.proofEventId).toBeTruthy();
    expect(decided.stage).toBe('receipted');

    const events = ledger.list({ kind: 'approval' });
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('approval');
    expect(events[0].status).toBe('ok');
    expect(events[0].title).toBe('Approval approve');
    expect(events[0].approvalId).toBe('appr-1');
    expect(events[0].riskLevel).toBe('medium');
    expect(events[0].id).toBe(decided.proofEventId);
  });

  test('decision status mapping', () => {
    expect(decisionActionToProofStatus('approve')).toBe('ok');
    expect(decisionActionToProofStatus('deny')).toBe('failed');
    expect(decisionActionToProofStatus('defer')).toBe('pending');
    expect(decisionActionToProofStatus('revoke')).toBe('info');
    expect(decisionActionToProofStatus('expire')).toBe('info');

    const ledger = createLedger();
    const service = createService({ ledger });
    const base = service.fromLooseRequest({
      id: 'd1',
      title: 'Test',
      risk: 'high',
      toolName: 'shell.exec',
    });

    const deny = service.recordDecision(base, { action: 'deny' }, { proofLedger: ledger });
    expect(ledger.get(deny.proofEventId!)?.status).toBe('failed');

    const defer = service.recordDecision(
      { ...base, id: 'd2' },
      { action: 'defer' },
      { proofLedger: ledger },
    );
    expect(ledger.get(defer.proofEventId!)?.status).toBe('pending');
    expect(defer.stage).toBe('request');

    const revoke = service.recordDecision(
      { ...base, id: 'd3' },
      { action: 'revoke' },
      { proofLedger: ledger },
    );
    expect(ledger.get(revoke.proofEventId!)?.status).toBe('info');
    expect(revoke.stage).toBe('revoked');
  });

  test('recordDecision without proof when emitProof false', () => {
    const service = createService();
    const card = service.fromLooseRequest({ id: 'np-1', title: 'No proof' });
    const decided = service.recordDecision(
      card,
      { action: 'approve' },
      { emitProof: false },
    );
    expect(decided.decision.action).toBe('approve');
    expect(decided.proofEventId).toBeNull();
    expect(decided.stage).toBe('decided');
  });

  test('toDesktopApprovalHint', () => {
    const service = createService();
    const card = service.fromLease(sampleLease(), { id: 'hint-1', approvalId: 'a1' });
    const hint = service.toDesktopApprovalHint(card);
    expect(hint.id).toBe('hint-1');
    expect(hint.risk).toBe('medium');
    expect(hint.status).toBe('pending');
    expect(hint.leaseId).toBe('lease-1');

    const approved = service.recordDecision(card, { action: 'approve' }, { emitProof: false });
    expect(service.toDesktopApprovalHint(approved).status).toBe('approved');
  });

  test('isOpenCard rejects decided/expired', () => {
    const open: ApprovalPresentationCard = {
      id: 'o1',
      stage: 'leased',
      title: 't',
      summary: 's',
      riskLevel: 'low',
      scope: {
        subjectId: null,
        workspaceId: null,
        channelId: null,
        toolName: 'x',
        allowedOperations: [],
      },
      expiresAt: '2026-07-11T14:00:00.000Z',
      leaseId: 'l1',
      approvalId: null,
      runId: null,
      surface: 'cli',
      effectsSummary: [],
      decision: { action: null, decidedAt: null, decidedBy: null, reason: null },
      proofEventId: null,
    };
    expect(isOpenCard(open, FIXED_NOW)).toBe(true);
    expect(isOpenCard({ ...open, stage: 'revoked' }, FIXED_NOW)).toBe(false);
    expect(isOpenCard({
      ...open,
      stage: 'decided',
      decision: { action: 'approve', decidedAt: FIXED_NOW.toISOString(), decidedBy: 'u', reason: null },
    }, FIXED_NOW)).toBe(false);
  });

  test('buildSnapshot includes contract version', () => {
    const service = createService();
    const cards = [service.fromLease(sampleLease())];
    const snap = service.buildSnapshot(cards);
    expect(snap.contractVersion).toBe(APPROVAL_PRESENTATION_CONTRACT_VERSION);
    expect(snap.summary.total).toBe(1);
    expect(snap.summary.open).toBe(1);
  });

  test('listCards filters by query and openOnly', () => {
    const service = createService();
    const a = service.fromLease(sampleLease({ leaseId: 'q-write', toolQualifiedName: 'fs.write' }));
    const b = service.fromLease(sampleLease({
      leaseId: 'q-exp',
      toolQualifiedName: 'shell.exec',
      expiresAt: '2026-07-11T09:00:00.000Z',
    }));
    const listed = service.listCards([a, b], { query: 'fs.write' });
    expect(listed).toHaveLength(1);
    expect(listed[0].leaseId).toBe('q-write');

    const openOnly = service.listCards([a, b], { openOnly: true });
    expect(openOnly).toHaveLength(1);
  });
});
