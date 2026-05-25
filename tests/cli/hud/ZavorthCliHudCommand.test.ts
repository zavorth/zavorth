import fs from 'fs';
import os from 'os';
import path from 'path';
import { runZavorthCliHud } from '../../../src/cli/hud/ZavorthCliHudCommand.js';
import { ZavorthMutationPlaneService } from '../../../src/services/ZavorthMutationPlaneService.js';

function createMutationPlane() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-hud-'));
  const plansDir = path.join(root, 'plans');
  const mutationPlane = new ZavorthMutationPlaneService({
    plansDir,
    now: () => new Date('2026-05-22T12:00:00.000Z'),
  });
  return { root, mutationPlane };
}

function createPendingPlan(mutationPlane: ZavorthMutationPlaneService, title = 'Update CLI HUD') {
  return mutationPlane.createPlan({
    domain: 'selfmod',
    actionId: 'write_file',
    title,
    summary: 'Preview a governed terminal UX change.',
    requestedBy: 'test',
    sourceSurface: 'cli',
    riskLevel: 'medium',
    approvalRequired: true,
    approvalReason: 'Workspace mutation requires operator approval.',
    validationPlan: ['npm run runtime:check'],
    rollbackPlan: ['restore previous file snapshot'],
    payload: {
      title,
      files: ['src/cli/hud/ZavorthCliHudCommand.ts'],
      diffPreview: {
        entries: [
          {
            path: 'src/cli/hud/ZavorthCliHudCommand.ts',
            summary: 'Add double confirmation shortcut.',
            before: 'single key',
            after: 'double key',
          },
        ],
      },
    },
  });
}

describe('Zavorth CLI HUD', () => {
  test('renders the daily TUI by default with runtime shortcuts', () => {
    const { root, mutationPlane } = createMutationPlane();
    const plan = createPendingPlan(mutationPlane);

    const result = runZavorthCliHud({
      projectRoot: root,
      args: ['--once'],
      mutationPlane,
      tty: false,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(result.snapshot.contractVersion).toBe('zavorth-cli-hud/1');
    expect(result.snapshot.selectedPlanId).toBe(plan.id);
    expect(result.output).toContain('Daily terminal');
    expect(result.output).toContain('Today');
    expect(result.output).toContain('Approvals & Diff');
    expect(result.output).toContain('zavorth chat');
  });

  test('exports daily TUI json without requiring a TTY', () => {
    const { root, mutationPlane } = createMutationPlane();
    createPendingPlan(mutationPlane);

    const result = runZavorthCliHud({
      projectRoot: root,
      args: ['--json'],
      json: true,
      mutationPlane,
      tty: false,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    const parsed = JSON.parse(result.output);
    expect(parsed.contractVersion).toBe('zavorth-cli-runtime-tui/1');
    expect(parsed.safety.readOnlySnapshot).toBe(true);
    expect(parsed.safety.noHostApply).toBe(true);
  });

  test('arms approval without --yes and does not approve the plan', () => {
    const { root, mutationPlane } = createMutationPlane();
    const plan = createPendingPlan(mutationPlane);

    const result = runZavorthCliHud({
      projectRoot: root,
      args: ['--action', 'approve', '--plan', plan.id],
      mutationPlane,
      tty: false,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(result.snapshot.decision.status).toBe('armed');
    expect(mutationPlane.readPlan(plan.id)?.status).toBe('waiting_approval');
  });

  test('approves only after explicit confirmation or double-key replay', () => {
    const { root, mutationPlane } = createMutationPlane();
    const plan = createPendingPlan(mutationPlane);

    const result = runZavorthCliHud({
      projectRoot: root,
      inputKeys: ['y', 'y'],
      mutationPlane,
      tty: true,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(result.snapshot.decision.status).toBe('approved');
    expect(mutationPlane.readPlan(plan.id)?.status).toBe('approved');
    expect(mutationPlane.readPlan(plan.id)?.status).not.toBe('applied');
  });

  test('selects a pending plan by index', () => {
    const { root, mutationPlane } = createMutationPlane();
    createPendingPlan(mutationPlane, 'First plan');
    createPendingPlan(mutationPlane, 'Second plan');

    const result = runZavorthCliHud({
      projectRoot: root,
      args: ['--select', '2'],
      mutationPlane,
      tty: false,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(result.snapshot.selectedIndex).toBe(2);
    expect(result.snapshot.selectedPlanId).toBe(result.snapshot.planQueue[1]?.id);
    expect(result.output).toContain('Pending work');
  });

  test('rejects a selected plan only with explicit confirmation', () => {
    const { root, mutationPlane } = createMutationPlane();
    const plan = createPendingPlan(mutationPlane);

    const armed = runZavorthCliHud({
      projectRoot: root,
      args: ['--action', 'reject', '--plan', plan.id],
      mutationPlane,
      tty: false,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });
    expect(armed.snapshot.decision.status).toBe('armed');
    expect(mutationPlane.readPlan(plan.id)?.status).toBe('waiting_approval');

    const rejected = runZavorthCliHud({
      projectRoot: root,
      args: ['--action', 'reject', '--plan', plan.id, '--yes'],
      mutationPlane,
      tty: false,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });
    expect(rejected.snapshot.decision.status).toBe('rejected');
    expect(rejected.snapshot.decision.receiptId).toContain('hud-rejected');
    expect(mutationPlane.readPlan(plan.id)?.status).toBe('blocked');
    expect(mutationPlane.readPlan(plan.id)?.approval.status).toBe('rejected');
  });

  test('defers a selected plan with audit while keeping it pending', () => {
    const { root, mutationPlane } = createMutationPlane();
    const plan = createPendingPlan(mutationPlane);

    const result = runZavorthCliHud({
      projectRoot: root,
      args: ['--action', 'defer', '--plan', plan.id, '--yes', '--reason', 'Later today'],
      mutationPlane,
      tty: false,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    const updated = mutationPlane.readPlan(plan.id);
    expect(result.snapshot.decision.status).toBe('deferred');
    expect(result.snapshot.decision.receiptId).toContain('hud-deferred');
    expect(updated?.status).toBe('waiting_approval');
    expect(updated?.audit.some((entry) => entry.event === 'plan.deferred')).toBe(true);
  });

  test('renders review mode focused on plan queue and selected decision surface', () => {
    const { root, mutationPlane } = createMutationPlane();
    createPendingPlan(mutationPlane);

    const result = runZavorthCliHud({
      projectRoot: root,
      args: ['review', '--once'],
      mutationPlane,
      tty: false,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(result.snapshot.mode).toBe('review');
    expect(result.output).toContain('Review Mode');
    expect(result.output).toContain('Pending work');
    expect(result.output).toContain('Review keys');
    expect(result.output).not.toContain('Live HUD');
  });

  test('renders guided review flow with steps and receipt placeholder', () => {
    const { root, mutationPlane } = createMutationPlane();
    createPendingPlan(mutationPlane);

    const result = runZavorthCliHud({
      projectRoot: root,
      args: ['guide', '--once'],
      mutationPlane,
      tty: false,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Guided review flow');
    expect(result.output).toContain('Select plan');
    expect(result.output).toContain('Review diff');
    expect(result.output).toContain('Decision evidence');
    expect(result.output).toContain('no host apply: true');
  });

  test('exports guided review json contract', () => {
    const { root, mutationPlane } = createMutationPlane();
    createPendingPlan(mutationPlane);

    const result = runZavorthCliHud({
      projectRoot: root,
      args: ['guide', '--json'],
      json: true,
      mutationPlane,
      tty: false,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    const parsed = JSON.parse(result.output);
    expect(parsed.contractVersion).toBe('zavorth-cli-guided-review/1');
    expect(parsed.steps.map((step: { id: string }) => step.id)).toContain('decide');
    expect(parsed.receipt.noHostApply).toBe(true);
  });

  test('renders unified runtime TUI with gateway, chat, tools, channels, sessions, logs and diffs', () => {
    const { root, mutationPlane } = createMutationPlane();
    createPendingPlan(mutationPlane);
    fs.mkdirSync(path.join(root, '.zavorth', 'logs'), { recursive: true });
    fs.writeFileSync(path.join(root, '.zavorth', 'gateway.json'), JSON.stringify({ status: 'running', pid: 1234 }));
    fs.writeFileSync(path.join(root, '.zavorth', 'messages.json'), JSON.stringify([{ id: 'message-1', channel: 'telegram', target: 'chat-1', status: 'draft', message: 'hello world' }]));
    fs.writeFileSync(path.join(root, '.zavorth', 'mcp-runtime.json'), JSON.stringify({ servers: [{ id: 'fs', status: 'available', toolsCount: 2, resourcesCount: 1 }] }));
    fs.writeFileSync(path.join(root, '.zavorth', 'skills-runtime.json'), JSON.stringify({ enabled: [{ id: 'debugging', name: 'Debugging' }] }));
    fs.writeFileSync(path.join(root, '.zavorth', 'plugins-runtime.json'), JSON.stringify({ plugins: [{ id: 'workspace', status: 'enabled' }] }));
    fs.writeFileSync(path.join(root, '.zavorth', 'sessions.json'), JSON.stringify([{ id: 'session-1', label: 'Main session', status: 'ready' }]));
    fs.writeFileSync(path.join(root, '.zavorth', 'logs', 'tasks.json'), JSON.stringify([{ id: 'log-1', taskId: 'task-1', event: 'completed', status: 'completed', createdAt: '2026-05-22T12:00:00.000Z' }]));

    const result = runZavorthCliHud({
      projectRoot: root,
      args: ['runtime', '--once'],
      mutationPlane,
      tty: false,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Daily terminal');
    expect(result.output).toContain('Connection');
    expect(result.output).toContain('Today');
    expect(result.output).toContain('Chat & Timeline');
    expect(result.output).toContain('Approvals & Diff');
    expect(result.output).toContain('Integrations');
    expect(result.output).toContain('Sessions');
  });

  test('exports unified runtime TUI json contract', () => {
    const { root, mutationPlane } = createMutationPlane();
    createPendingPlan(mutationPlane);

    const result = runZavorthCliHud({
      projectRoot: root,
      args: ['runtime', '--json'],
      json: true,
      mutationPlane,
      tty: false,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    const parsed = JSON.parse(result.output);
    expect(parsed.contractVersion).toBe('zavorth-cli-runtime-tui/1');
    expect(parsed.safety.readOnlySnapshot).toBe(true);
    expect(parsed.approvals.pending).toBe(1);
  });
});
