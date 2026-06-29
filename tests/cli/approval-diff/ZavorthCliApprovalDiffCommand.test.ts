import fs from 'fs';
import os from 'os';
import path from 'path';
import { runZavorthCliApprovalDiff } from '../../../src/cli/approval-diff/ZavorthCliApprovalDiffCommand.js';
import { ZavorthMutationPlaneService } from '../../../src/services/ZavorthMutationPlaneService.js';

function createMutationPlane() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-approval-diff-'));
  const plansDir = path.join(root, 'plans');
  const mutationPlane = new ZavorthMutationPlaneService({
    plansDir,
    now: () => new Date('2026-05-22T12:00:00.000Z'),
  });
  return { root, mutationPlane };
}

function createPendingPlan(mutationPlane: ZavorthMutationPlaneService) {
  return mutationPlane.createPlan({
    domain: 'selfmod',
    actionId: 'write_file',
    title: 'Update runtime policy',
    summary: 'Patch one file after sandbox rehearsal.',
    requestedBy: 'test',
    sourceSurface: 'cli',
    riskLevel: 'medium',
    approvalRequired: true,
    approvalReason: 'Workspace mutation requires operator approval.',
    validationPlan: ['npm run runtime:check'],
    rollbackPlan: ['restore previous file snapshot'],
    payload: {
      files: ['src/security/EffectPolicyKernel.ts'],
      commands: ['npm run runtime:check'],
      diffPreview: {
        entries: [
          {
            path: 'src/security/EffectPolicyKernel.ts',
            riskLevel: 'medium',
            summary: 'Tighten approval policy.',
            before: 'allow: false',
            after: 'allow: true',
          },
        ],
      },
      token: 'fixture-secret-value-that-must-not-render',
    },
  });
}

describe('Zavorth CLI approval/diff premium UX', () => {
  test('renders pending approval cards without leaking payload secrets', () => {
    const { root, mutationPlane } = createMutationPlane();
    const plan = createPendingPlan(mutationPlane);

    const result = runZavorthCliApprovalDiff({
      projectRoot: root,
      view: 'approvals',
      args: [],
      mutationPlane,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(result.snapshot.summary.pending).toBe(1);
    expect(result.snapshot.cards[0]?.id).toBe(plan.id);
    expect(result.output).toContain('Approvals');
    expect(result.output).toContain('Approval is preview-only');
    expect(result.output).toContain(`zavorth approve ${plan.id} --yes`);
    expect(result.output).not.toContain('sk-secret-value');
  });

  test('renders diff review entries for a selected plan', () => {
    const { root, mutationPlane } = createMutationPlane();
    const plan = createPendingPlan(mutationPlane);

    const result = runZavorthCliApprovalDiff({
      projectRoot: root,
      view: 'diff',
      args: [plan.id],
      mutationPlane,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(result.snapshot.summary.diffEntries).toBe(1);
    expect(result.snapshot.diffs[0]?.path).toBe('src/security/EffectPolicyKernel.ts');
    expect(result.output).toContain('Diff Review');
    expect(result.output).toContain('Tighten approval policy');
  });

  test('approves a plan only with explicit --yes and never marks it applied', () => {
    const { root, mutationPlane } = createMutationPlane();
    const plan = createPendingPlan(mutationPlane);

    const preview = runZavorthCliApprovalDiff({
      projectRoot: root,
      view: 'approvals',
      args: [plan.id],
      mutationPlane,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });
    expect(preview.snapshot.decision.status).toBe('none');
    expect(mutationPlane.readPlan(plan.id)?.status).toBe('waiting_approval');

    const approved = runZavorthCliApprovalDiff({
      projectRoot: root,
      view: 'approvals',
      args: [plan.id, '--yes', '--by', 'operator@test'],
      mutationPlane,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(approved.snapshot.decision.status).toBe('approved');
    expect(mutationPlane.readPlan(plan.id)?.status).toBe('approved');
    expect(mutationPlane.readPlan(plan.id)?.status).not.toBe('applied');
    expect(approved.output).toContain('No host apply was performed');
  });

  test('returns stable json output', () => {
    const { root, mutationPlane } = createMutationPlane();
    createPendingPlan(mutationPlane);

    const result = runZavorthCliApprovalDiff({
      projectRoot: root,
      view: 'approvals',
      args: ['--json'],
      mutationPlane,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    const parsed = JSON.parse(result.output);
    expect(parsed.contractVersion).toBe('zavorth-cli-approval-diff/1');
    expect(parsed.safety.noHostApply).toBe(true);
    expect(parsed.safety.approvalRequiresYes).toBe(true);
  });
});
