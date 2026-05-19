import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ZAVORTH_BREAK_GLASS_CONFIRMATION_PHRASE,
  ZAVORTH_BREAK_GLASS_SECOND_CONFIRMATION,
  ZavorthPersistentApprovalPolicyService,
} from '../../src/services/ZavorthPersistentApprovalPolicyService.js';

describe('ZavorthPersistentApprovalPolicyService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-persistent-approval-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('grants scoped reusable approval with ttl, receipts and no broad critical mode', () => {
    const service = new ZavorthPersistentApprovalPolicyService({
      projectRoot: root,
      now: () => new Date('2026-05-18T10:00:00.000Z'),
    });

    const policy = service.grant({
      surface: 'skill-curator-live-loop',
      actions: ['metadata-repair'],
      maxRisk: 'low',
      ttlDays: 7,
      reason: 'Allow routine metadata upkeep.',
    });
    const snapshot = service.buildSnapshot();

    expect(policy.id).toContain('pap-skill-curator-live-loop');
    expect(policy.actions).toEqual(['metadata-repair']);
    expect(policy.maxRisk).toBe('low');
    expect(policy.expiresAt).toBe('2026-05-25T10:00:00.000Z');
    expect(snapshot.summary.enabled).toBe(1);
    expect(snapshot.safety).toEqual(expect.objectContaining({
      noCriticalAutoApproval: true,
      destructivePreviewMustBeExplicit: true,
      receiptRequired: true,
    }));
    expect(() => service.grant({
      surface: 'skill-curator-live-loop',
      maxRisk: 'critical',
    })).toThrow(/critical/i);
    expect(findReceipts(root).length).toBe(1);
  });

  it('resolves only matching action, risk and destructive preview scope', () => {
    const service = new ZavorthPersistentApprovalPolicyService({
      projectRoot: root,
      now: () => new Date('2026-05-18T10:00:00.000Z'),
    });

    service.grant({
      surface: 'skill-curator-live-loop',
      actions: ['metadata-repair'],
      maxRisk: 'low',
      ttlDays: 30,
    });

    expect(service.resolve({
      surface: 'skill-curator-live-loop',
      actions: ['metadata-repair'],
      maxRisk: 'low',
      destructivePreview: false,
    }).allowed).toBe(true);
    expect(service.resolve({
      surface: 'skill-curator-live-loop',
      actions: ['merge-candidates'],
      maxRisk: 'medium',
      destructivePreview: true,
    }).allowed).toBe(false);
  });

  it('can be revoked and no longer resolves after revocation', () => {
    const service = new ZavorthPersistentApprovalPolicyService({ projectRoot: root });
    const policy = service.grant({
      surface: 'skill-curator-live-loop',
      actions: ['metadata-repair'],
      maxRisk: 'low',
    });

    expect(service.revoke(policy.id)).toBe(true);
    expect(service.resolve({
      surface: 'skill-curator-live-loop',
      actions: ['metadata-repair'],
      maxRisk: 'low',
      destructivePreview: false,
    }).allowed).toBe(false);
  });

  it('activates governed break glass only with double confirmation, ttl and hard stops', () => {
    const service = new ZavorthPersistentApprovalPolicyService({
      projectRoot: root,
      now: () => new Date('2026-05-18T10:00:00.000Z'),
    });

    expect(() => service.grantBreakGlass({
      surface: 'skill-curator-live-loop',
      confirmationPhrase: 'permito tudo',
      secondConfirmation: ZAVORTH_BREAK_GLASS_SECOND_CONFIRMATION,
      acknowledgeHardStops: true,
    })).toThrow(/confirmation/i);

    const policy = service.grantBreakGlass({
      surface: 'skill-curator-live-loop',
      actions: ['*'],
      maxRisk: 'high',
      ttlHours: 48,
      confirmationPhrase: ZAVORTH_BREAK_GLASS_CONFIRMATION_PHRASE,
      secondConfirmation: ZAVORTH_BREAK_GLASS_SECOND_CONFIRMATION,
      acknowledgeHardStops: true,
    });
    const snapshot = service.buildSnapshot();

    expect(policy.mode).toBe('break-glass');
    expect(policy.expiresAt).toBe('2026-05-19T10:00:00.000Z');
    expect(policy.hardStops).toContain('raw-secret-read');
    expect(snapshot.summary.breakGlassActive).toBe(1);
    expect(snapshot.safety.breakGlassStillHasHardStops).toBe(true);
    expect(service.resolve({
      surface: 'skill-curator-live-loop',
      actions: ['merge-candidates'],
      maxRisk: 'medium',
      destructivePreview: true,
    }).allowed).toBe(true);
    expect(service.resolve({
      surface: 'skill-curator-live-loop',
      actions: ['raw-secret-read'],
      maxRisk: 'high',
      destructivePreview: false,
    })).toEqual(expect.objectContaining({
      allowed: false,
      reason: expect.stringContaining('hard stop'),
    }));
  });

  it('refuses break glass for critical risk', () => {
    const service = new ZavorthPersistentApprovalPolicyService({ projectRoot: root });

    expect(() => service.grantBreakGlass({
      surface: 'operator-break-glass',
      maxRisk: 'critical',
      confirmationPhrase: ZAVORTH_BREAK_GLASS_CONFIRMATION_PHRASE,
      secondConfirmation: ZAVORTH_BREAK_GLASS_SECOND_CONFIRMATION,
      acknowledgeHardStops: true,
    })).toThrow(/critical/i);
  });
});

function findReceipts(root: string): string[] {
  const receiptDir = path.join(root, 'data', 'approval-policies', 'receipts');
  return fs.existsSync(receiptDir) ? fs.readdirSync(receiptDir) : [];
}
