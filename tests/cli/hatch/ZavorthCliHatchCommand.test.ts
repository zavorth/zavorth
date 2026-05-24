import fs from 'fs';
import os from 'os';
import path from 'path';
import { runZavorthCliHatch } from '../../../src/cli/hatch/ZavorthCliHatchCommand.js';
import type { ZavorthMutationPlan } from '../../../src/contracts/ZavorthMutationPlaneContract.js';

function createWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cli-hatch-'));
  fs.mkdirSync(path.join(root, 'src', 'security'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'ai-gateway', 'app', '(dashboard)', 'control'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }, null, 2));
  fs.writeFileSync(path.join(root, 'src', 'security', 'EffectPolicyKernel.ts'), 'export const ready = true;\n');
  fs.writeFileSync(path.join(root, 'scripts', 'effect-boundary-invariants-check.mjs'), 'console.log("ok");\n');
  return root;
}

function pendingPlan(): ZavorthMutationPlan {
  return {
    id: 'plan-hatch-1',
    domain: 'selfmod',
    actionId: 'hatch-test-action',
    title: 'Review sandbox mutation',
    summary: 'A pending mutation blocks first-run hatch.',
    createdAt: '2026-05-22T12:00:00.000Z',
    updatedAt: '2026-05-22T12:00:00.000Z',
    expiresAt: '2026-05-22T13:00:00.000Z',
    payloadHash: 'hash-hatch-test',
    status: 'waiting_approval',
    requestedBy: 'test',
    sourceSurface: 'cli',
    riskLevel: 'medium',
    approval: {
      required: true,
      status: 'pending',
      defaultScope: 'once',
      availableScopes: ['once'],
      permissionId: 'permission-hatch-test',
      requestedBy: 'test',
      reason: 'Verify hatch approval gating.',
    },
    resourceImpact: {
      ramMb: 0,
      diskMb: 0,
      processCount: 0,
      externalExposure: 'none',
      recurring: false,
      notes: [],
    },
    readinessGates: [],
    retentionPolicy: {
      ttlMs: null,
      maxBytes: null,
      cleanupOnSuccess: false,
      cleanupOnBoot: false,
      notes: [],
    },
    validationPlan: [],
    rollbackPlan: [],
    payload: {},
    audit: [],
  };
}

describe('Zavorth CLI hatch', () => {
  test('renders a first-run cockpit when the agent is ready', () => {
    const root = createWorkspace();
    fs.writeFileSync(
      path.join(root, '.env'),
      [
        'ZAVORTH_DEFAULT_PROVIDER=openai',
        'ZAVORTH_DEFAULT_MODEL=gpt-test',
        'OPENAI_API_KEY=fixture-secret-value-that-must-not-render',
      ].join('\n'),
    );

    const result = runZavorthCliHatch({
      projectRoot: root,
      mutationPlane: null,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(result.snapshot.status).toBe('ready');
    expect(result.snapshot.launch.recommended).toContain('zavorth ask');
    expect(result.output).toContain('Hatch');
    expect(result.output).toContain('First-run cockpit');
    expect(result.output).toContain('zavorth ask');
    expect(result.output).not.toContain('sk-secret-value');
  });

  test('routes missing provider to Setup Studio', () => {
    const root = createWorkspace();

    const result = runZavorthCliHatch({
      projectRoot: root,
      mutationPlane: null,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(result.snapshot.status).toBe('needs_setup');
    expect(result.snapshot.launch.recommended).toBe('zavorth setup');
    expect(result.snapshot.nextActions[0]?.command).toBe('zavorth setup');
  });

  test('gates hatching on pending approvals', () => {
    const root = createWorkspace();
    fs.writeFileSync(path.join(root, '.env'), 'ZAVORTH_DEFAULT_PROVIDER=local\nZAVORTH_DEFAULT_MODEL=llama\n');
    const mutationPlane = {
      listPlans: jest.fn(() => [pendingPlan()]),
    };

    const result = runZavorthCliHatch({
      projectRoot: root,
      mutationPlane,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(result.snapshot.status).toBe('needs_approval');
    expect(result.snapshot.launch.approve).toBe('zavorth approve');
    expect(result.snapshot.nextActions[0]?.command).toBe('zavorth approve');
  });

  test('returns stable json output for automation', () => {
    const root = createWorkspace();
    const result = runZavorthCliHatch({
      projectRoot: root,
      json: true,
      mutationPlane: null,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    const parsed = JSON.parse(result.output);
    expect(parsed.contractVersion).toBe('zavorth-cli-hatch/1');
    expect(parsed.generatedAt).toBe('2026-05-22T12:00:00.000Z');
    expect(parsed.guardrails).toContain('Secrets and tokens are shown only as present or missing.');
  });
});
