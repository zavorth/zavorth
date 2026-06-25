import fs from 'fs';
import os from 'os';
import path from 'path';
import { runZavorthCliQuickStart } from '../../../src/cli/quickstart/ZavorthCliQuickStartCommand.js';
import { ZavorthProviderChannelWizardService } from '../../../src/cli/ZavorthProviderChannelWizardService.js';
import type { ZavorthMutationPlan } from '../../../src/contracts/ZavorthMutationPlaneContract.js';

function createWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cli-quickstart-'));
  fs.mkdirSync(path.join(root, 'src', 'security'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'zavorth-control', 'app', '(dashboard)', 'control'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }, null, 2));
  fs.writeFileSync(path.join(root, 'src', 'security', 'EffectPolicyKernel.ts'), 'export const ready = true;\n');
  fs.writeFileSync(path.join(root, 'scripts', 'effect-boundary-invariants-check.mjs'), 'console.log("ok");\n');
  return root;
}

function pendingPlan(): ZavorthMutationPlan {
  return {
    id: 'plan-quickstart-1',
    domain: 'setup',
    actionId: 'quickstart-test-action',
    title: 'Pending setup mutation',
    summary: 'A pending mutation should be cleared before setup changes.',
    createdAt: '2026-05-22T12:00:00.000Z',
    updatedAt: '2026-05-22T12:00:00.000Z',
    expiresAt: '2026-05-22T13:00:00.000Z',
    payloadHash: 'hash-quickstart-test',
    status: 'waiting_approval',
    requestedBy: 'test',
    sourceSurface: 'cli',
    riskLevel: 'medium',
    approval: {
      required: true,
      status: 'pending',
      defaultScope: 'once',
      availableScopes: ['once'],
      permissionId: 'permission-quickstart-test',
      requestedBy: 'test',
      reason: 'Verify QuickStart approval priority.',
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

describe('Zavorth CLI QuickStart', () => {
  test('recommends provider setup without leaking secrets', () => {
    const root = createWorkspace();
    const result = runZavorthCliQuickStart({
      projectRoot: root,
      mutationPlane: null,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(result.snapshot.status).toBe('needs_provider');
    expect(result.snapshot.nextActions[0]?.command).toContain('zavorth providers add');
    expect(result.output).toContain('QuickStart');
    expect(result.output).toContain('Preview-first setup');
  });

  test('prioritizes pending approvals before setup changes', () => {
    const root = createWorkspace();
    fs.writeFileSync(path.join(root, '.env'), 'ZAVORTH_DEFAULT_PROVIDER=local\nZAVORTH_DEFAULT_MODEL=llama\n');
    const result = runZavorthCliQuickStart({
      projectRoot: root,
      mutationPlane: { listPlans: jest.fn(() => [pendingPlan()]) },
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.snapshot.status).toBe('needs_approval');
    expect(result.snapshot.nextActions[0]?.command).toBe('zavorth approve');
  });

  test('returns stable json output', () => {
    const root = createWorkspace();
    const result = runZavorthCliQuickStart({
      projectRoot: root,
      json: true,
      mutationPlane: null,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    const parsed = JSON.parse(result.output);
    expect(parsed.contractVersion).toBe('zavorth-cli-quickstart/1');
    expect(parsed.safety.writesRequireApply).toBe(true);
    expect(parsed.safety.secretsRedacted).toBe(true);
  });

  test('renders provider/channel wizard output with premium safety panels', () => {
    const secret = 'fixture-quickstart-secret-that-must-not-render';
    const service = new ZavorthProviderChannelWizardService();
    const result = service.buildProvider({
      projectRoot: process.cwd(),
      action: 'add',
      providerId: 'openai',
      modelId: 'gpt-4.1',
      providerSecret: secret,
      apply: false,
    });
    const rendered = service.render(result);

    expect(rendered).toContain('Provider Wizard');
    expect(rendered).toContain('Preview only');
    expect(rendered).toContain('Governed setup');
    expect(rendered).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});
