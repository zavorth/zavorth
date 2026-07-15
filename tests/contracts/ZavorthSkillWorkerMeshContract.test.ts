import {
  ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION,
  ZAVORTH_SKILL_WORKER_GLOSSARY,
  formatSkillWorkerMeshPitch,
  type SkillInstallPlan,
  type SkillInstallReceipt,
  type WorkerProfile,
  type WorkerInvokeReceipt,
} from '../../src/contracts/skill/ZavorthSkillWorkerMeshContract.js';

describe('ZavorthSkillWorkerMeshContract', () => {
  it('exports stable contract version', () => {
    expect(ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION).toMatch(/skill-worker-mesh/);
  });

  it('defines brand-agnostic glossary entries', () => {
    expect(ZAVORTH_SKILL_WORKER_GLOSSARY.skill.id).toBe('skill');
    expect(ZAVORTH_SKILL_WORKER_GLOSSARY.worker.id).toBe('worker');
    expect(ZAVORTH_SKILL_WORKER_GLOSSARY.tool.en).toMatch(/ToolRegistry/i);
    expect(ZAVORTH_SKILL_WORKER_GLOSSARY.skill.pt).toMatch(/instrução|instrucao/i);
    const blob = JSON.stringify(ZAVORTH_SKILL_WORKER_GLOSSARY);
    expect(blob.toLowerCase()).not.toMatch(/openclaw|hermes/);
  });

  it('accepts structural SkillInstallPlan and SkillInstallReceipt samples', () => {
    const plan: SkillInstallPlan = {
      contractVersion: ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION,
      kind: 'skill-install-plan',
      generatedAt: '2026-07-13T00:00:00.000Z',
      source: { raw: './skills/demo', detectedType: 'local-path', resolved: './skills/demo' },
      skillId: 'demo',
      skillName: 'Demo',
      version: '1.0.0',
      files: ['SKILL.md', 'manifest.json'],
      declaredTools: [{ name: 'read_file' }],
      risks: [],
      trust: {
        score: 0.8,
        band: 'allow-with-preview',
        reasons: ['local path'],
        signals: [{ id: 'local_path', present: true, weight: 1 }],
      },
      previewOnly: true,
      applyBlockedWithoutConsent: true,
      nextSafeAction: 'Review plan then apply with consent',
    };
    expect(plan.previewOnly).toBe(true);

    const receipt: SkillInstallReceipt = {
      contractVersion: ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION,
      kind: 'skill-install-receipt',
      id: 'rcpt-1',
      generatedAt: plan.generatedAt,
      status: 'preview',
      source: plan.source,
      skillId: plan.skillId,
      targetDir: null,
      materialized: false,
      toolBinds: [],
      smoke: { ran: false, ok: null, detail: null },
      trust: plan.trust,
      secretLikePresent: false,
      approvalGranted: false,
      reason: 'preview only',
    };
    expect(receipt.kind).toBe('skill-install-receipt');
  });

  it('accepts structural WorkerProfile and WorkerInvokeReceipt samples', () => {
    const worker: WorkerProfile = {
      contractVersion: ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION,
      kind: 'worker-profile',
      id: 'worker-local-cli',
      label: 'Local CLI worker',
      adapter: 'cli',
      how: {
        command: 'node',
        args: ['--version'],
        endpoint: null,
        root: null,
        internalRole: null,
      },
      capabilities: ['shell.version'],
      health: { status: 'unknown', checkedAt: null, detail: null },
      policy: {
        liveEnabled: false,
        requiresApprovalPerInvoke: true,
        allowNetwork: false,
        isolation: 'local-supervised',
      },
      createdAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z',
    };
    expect(worker.adapter).toBe('cli');

    const invoke: WorkerInvokeReceipt = {
      contractVersion: ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION,
      kind: 'worker-invoke-receipt',
      id: 'inv-1',
      generatedAt: worker.createdAt,
      workerId: worker.id,
      mode: 'dry-run',
      status: 'completed',
      exitCode: 0,
      stdoutSummary: 'v22',
      stderrSummary: null,
      isolation: 'local-supervised',
      approvalGranted: true,
      durationMs: 12,
      reason: 'dry-run ok',
    };
    expect(invoke.mode).toBe('dry-run');
  });

  it('formatSkillWorkerMeshPitch is short and brand-agnostic', () => {
    const en = formatSkillWorkerMeshPitch('en');
    const pt = formatSkillWorkerMeshPitch('pt');
    expect(en.toLowerCase()).toMatch(/skill/);
    expect(en.toLowerCase()).toMatch(/worker/);
    expect(pt.toLowerCase()).toMatch(/skill|instru/);
  });
});
