import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { UniversalPowerFabricService } from '../../src/services/UniversalPowerFabricService.js';
import { TrustedOperatorModeService } from '../../src/services/power/TrustedOperatorModeService.js';
import { LearningPromoteService } from '../../src/services/power/LearningPromoteService.js';
import { ExternalHarnessRegistryService } from '../../src/services/power/ExternalHarnessRegistryService.js';
import { ContextDisciplineService } from '../../src/services/power/ContextDisciplineService.js';

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('TrustedOperatorModeService', () => {
  let root: string;

  beforeEach(() => {
    root = tempDir('zavorth-trusted-');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('never auto-approves red/high risk even when enabled', () => {
    const svc = new TrustedOperatorModeService({
      stateFile: path.join(root, 'trusted.json'),
    });
    svc.enable('test', 'unit');
    const decision = svc.decide({
      description: 'disable approval policy and run rm -rf /',
      risk: 'high',
      mutation: true,
    });
    expect(decision.autoApprove).toBe(false);
    expect(decision.lane).toBe('red');
    expect(decision.receiptsRequired).toBe(true);
  });

  it('auto-approves green read-only when enabled', () => {
    const svc = new TrustedOperatorModeService({
      stateFile: path.join(root, 'trusted.json'),
    });
    svc.enable('test');
    const decision = svc.decide({
      description: 'summarize the repository status and explain next steps',
      risk: 'low',
      mutation: false,
    });
    expect(decision.autoApprove).toBe(true);
    expect(decision.lane).toBe('green');
  });
});

describe('LearningPromoteService', () => {
  let root: string;

  beforeEach(() => {
    root = tempDir('zavorth-learn-');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('stages and promotes with consent only', () => {
    const svc = new LearningPromoteService({ storeDir: path.join(root, 'learn') });
    const staged = svc.stage({
      kind: 'shadow-skill',
      title: 'pr-review-loop',
      summary: 'Repeated PR review workflow',
      evidenceRefs: ['obs-1'],
    });
    expect(staged.candidate.status).toBe('staged');

    const denied = svc.promote(staged.candidate.id, false);
    expect(denied.receipt.status).toBe('deny');

    const promoted = svc.promote(staged.candidate.id, true);
    expect(promoted.candidate?.status).toBe('promoted');
    expect(promoted.materialPath && fs.existsSync(promoted.materialPath)).toBe(true);
  });
});

describe('ExternalHarnessRegistryService', () => {
  let root: string;

  beforeEach(() => {
    root = tempDir('zavorth-harness-');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('registers generic harness and keeps mutation preview blocked', () => {
    const svc = new ExternalHarnessRegistryService({
      storeFile: path.join(root, 'harnesses.json'),
    });
    const adapter = svc.register({
      label: 'local-runner',
      commandOrEndpoint: 'runner --stdio',
    });
    expect(adapter.readOnlyDefault).toBe(true);
    expect(adapter.mutationRequiresApproval).toBe(true);

    const mut = svc.previewInvoke({
      harnessId: adapter.id,
      prompt: 'do something',
      mutation: true,
    });
    expect(mut.allowed).toBe(false);
    expect(mut.dryRun).toBe(true);
  });
});

describe('ContextDisciplineService', () => {
  it('defers tools beyond budget', () => {
    const svc = new ContextDisciplineService();
    const selection = svc.selectToolsForTurn({
      toolIds: Array.from({ length: 40 }, (_, i) => `tool-${i}`),
      alwaysInclude: ['tool-0'],
      maxVisibleTools: 10,
    });
    expect(selection.selected).toHaveLength(10);
    expect(selection.selected).toContain('tool-0');
    expect(selection.deferred.length).toBe(30);
  });
});

describe('UniversalPowerFabricService', () => {
  let root: string;

  beforeEach(() => {
    root = tempDir('zavorth-power-');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('builds inventory with modal/daytona as configurable elastic backends (not fake planned-only)', () => {
    const service = new UniversalPowerFabricService({
      projectRoot: root,
      env: {},
      terminalBackends: {
        execute: () => ({
          contractVersion: 'test' as any,
          generatedAt: new Date().toISOString(),
          source: 'ZavorthTerminalBackendsService' as any,
          action: 'terminal.status',
          status: 'preview',
          selectedBackend: 'local',
          command: { raw: null, redacted: null, risk: 'read-only', approvalRequired: false, timeoutMs: 1000, workspace: root },
          plan: { mode: 'status-only', executable: null, args: [], displayCommand: null, backendConfigured: true, willExecute: false, reason: 'status' },
          execution: { attempted: false, performed: false, exitCode: null, stdoutPreview: null, stderrPreview: null, error: null },
          backends: [
            {
              id: 'local',
              label: 'Local',
              status: 'ready',
              isolation: 'host-process',
              installed: true,
              dormant: false,
              activationMode: 'always',
              liveCapable: true,
              liveReady: true,
              requiresConfiguration: [],
              defaultCommand: 'sh',
              nextCommand: 'local',
              limitations: [],
              readinessProof: { kind: 'local-host', observed: true, summary: 'ok', command: null, rawSecretSerialized: false },
            },
            {
              id: 'modal',
              label: 'Modal cloud function',
              status: 'needs-configuration',
              isolation: 'cloud-function',
              installed: false,
              dormant: false,
              activationMode: 'manual',
              liveCapable: true,
              liveReady: false,
              requiresConfiguration: ['token'],
              defaultCommand: 'modal run',
              nextCommand: 'configure modal',
              limitations: [],
              readinessProof: { kind: 'not-configured', observed: false, summary: 'need config', command: null, rawSecretSerialized: false },
            },
            {
              id: 'daytona',
              label: 'Daytona workspace',
              status: 'needs-configuration',
              isolation: 'cloud-dev-workspace',
              installed: false,
              dormant: false,
              activationMode: 'manual',
              liveCapable: true,
              liveReady: false,
              requiresConfiguration: ['api key'],
              defaultCommand: 'daytona workspace exec',
              nextCommand: 'configure daytona',
              limitations: [],
              readinessProof: { kind: 'not-configured', observed: false, summary: 'need config', command: null, rawSecretSerialized: false },
            },
          ],
          receipts: [],
          nextSafeAction: 'ok',
          policy: {} as any,
        }) as any,
      },
    });

    const snap = service.buildSnapshot();
    expect(snap.policy.brandAgnostic).toBe(true);
    expect(snap.policy.trustedModeDoesNotBypassRedLane).toBe(true);
    const modal = snap.backends.find((b) => b.id === 'modal');
    const daytona = snap.backends.find((b) => b.id === 'daytona');
    expect(modal?.elastic).toBe(true);
    expect(daytona?.elastic).toBe(true);
    expect(modal?.hibernateWhenIdle).toBe(true);
    expect(modal?.posture).not.toBe('planned');
    expect(daytona?.posture).not.toBe('planned');
  });

  it('toggles trusted mode and stages/promotes learning', async () => {
    const service = new UniversalPowerFabricService({
      projectRoot: root,
      env: {},
      adaptiveLearning: {
        ingestObservation: async () => ({
          shadowSkills: [{ title: 'review-loop', summary: 'review workflow', evidence: ['e1'] }],
          procedures: [{ title: 'morning-brief', summary: 'daily brief', evidence: ['e2'] }],
        }) as any,
      },
    });

    const trusted = service.setTrustedOperator({ enabled: true, updatedBy: 'test' });
    expect(trusted.state.enabled).toBe(true);
    expect(trusted.state.redLaneIntact).toBe(true);

    const observed = await service.observeLearning({
      observation: 'After successful runs, create a skill for github pull request review',
    });
    expect(observed.staged.length).toBeGreaterThan(0);

    const id = observed.staged[0].id;
    const promoted = service.promoteLearning({ candidateId: id, consent: true });
    expect(promoted.receipt.status).toBe('pass');
    expect(promoted.materialPath && fs.existsSync(promoted.materialPath)).toBe(true);
  });

  it('registers harness and reports context discipline', () => {
    const service = new UniversalPowerFabricService({ projectRoot: root, env: {} });
    const harness = service.registerHarness({
      label: 'stdio-worker',
      commandOrEndpoint: 'worker --stdio',
    });
    expect(harness.adapter.mutationRequiresApproval).toBe(true);

    const ctx = service.contextSnapshot({ visibleToolCount: 50, skillBytesInPrompt: 50_000 });
    expect(ctx.snapshot.progressiveSkillDisclosure).toBe(true);
    expect(ctx.snapshot.recommendations.length).toBeGreaterThan(0);
  });
});
