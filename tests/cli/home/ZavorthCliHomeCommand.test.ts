import fs from 'fs';
import os from 'os';
import path from 'path';
import { runZavorthCliHome } from '../../../src/cli/home/ZavorthCliHomeCommand.js';
import { buildZavorthCliHomeSnapshot } from '../../../src/cli/home/ZavorthCliHomeProjection.js';
import type { ZavorthMutationPlan } from '../../../src/contracts/ZavorthMutationPlaneContract.js';

function createWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cli-home-'));
  fs.mkdirSync(path.join(root, 'src', 'security'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'ai-gateway', 'app', '(dashboard)', 'control'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }, null, 2));
  fs.writeFileSync(path.join(root, 'src', 'security', 'EffectPolicyKernel.ts'), 'export const ready = true;\n');
  fs.writeFileSync(path.join(root, 'scripts', 'effect-boundary-invariants-check.mjs'), 'console.log("ok");\n');
  return root;
}

function pendingPlan(overrides: Partial<ZavorthMutationPlan> = {}): ZavorthMutationPlan {
  return {
    id: 'plan-home-1',
    domain: 'selfmod',
    actionId: 'home-test-action',
    title: 'Apply governed workspace patch',
    summary: 'A sandboxed mutation is ready for review.',
    createdAt: '2026-05-22T12:00:00.000Z',
    updatedAt: '2026-05-22T12:00:00.000Z',
    expiresAt: '2026-05-22T13:00:00.000Z',
    payloadHash: 'hash-home-test',
    status: 'waiting_approval',
    requestedBy: 'test',
    sourceSurface: 'cli',
    riskLevel: 'medium',
    approval: {
      required: true,
      status: 'pending',
      defaultScope: 'once',
      availableScopes: ['once'],
      permissionId: 'permission-home-test',
      requestedBy: 'test',
      reason: 'Verify pending approvals render in the CLI home.',
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
    ...overrides,
  };
}

describe('Zavorth CLI home', () => {
  test('renders a premium home without leaking provider secrets', () => {
    const root = createWorkspace();
    fs.writeFileSync(
      path.join(root, '.env'),
      [
        'ZAVORTH_DEFAULT_PROVIDER=openai',
        'ZAVORTH_DEFAULT_MODEL=gpt-test',
        'OPENAI_API_KEY=fixture-secret-value-that-must-not-render',
        'ZAVORTH_WEB_AUTH_TOKEN=local-token-that-must-not-render',
      ].join('\n'),
    );

    const result = runZavorthCliHome({
      projectRoot: root,
      mutationPlane: null,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(result.snapshot.status).toBe('ready');
    expect(result.output).toContain('ZAVORTH');
    expect(result.output).toContain('Daily path');
    expect(result.output).toContain('Next actions');
    expect(result.output).toContain('zavorth ask');
    expect(result.output).not.toContain('sk-secret-value');
    expect(result.output).not.toContain('local-token');
  });

  test('projects pending mutation approvals into next actions', () => {
    const root = createWorkspace();
    fs.writeFileSync(path.join(root, '.env'), 'ZAVORTH_DEFAULT_PROVIDER=local\nZAVORTH_DEFAULT_MODEL=llama\n');
    const mutationPlane = {
      listPlans: jest.fn(() => [pendingPlan()]),
    };

    const snapshot = buildZavorthCliHomeSnapshot({
      projectRoot: root,
      mutationPlane,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(snapshot.status).toBe('warning');
    expect(snapshot.approvals.pending).toBe(1);
    expect(snapshot.approvals.latest[0]?.title).toBe('Apply governed workspace patch');
    expect(snapshot.nextActions.some((action) => action.command === 'zavorth approve')).toBe(true);
  });

  test('returns stable json output for automation', () => {
    const root = createWorkspace();
    const result = runZavorthCliHome({
      projectRoot: root,
      json: true,
      mutationPlane: null,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    const parsed = JSON.parse(result.output);
    expect(parsed.contractVersion).toBe('zavorth-cli-home/1');
    expect(parsed.generatedAt).toBe('2026-05-22T12:00:00.000Z');
    expect(parsed.safety.secretsRedacted).toBe(true);
  });
});
