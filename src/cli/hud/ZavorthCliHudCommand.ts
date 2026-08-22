import readline from 'readline';
import { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import { runZavorthCliApprovalDiff } from '../approval-diff/ZavorthCliApprovalDiffCommand.js';
import {
  buildZavorthCliGuidedReviewSnapshot,
  renderZavorthCliGuidedReview,
} from './ZavorthCliGuidedReview.js';
import { buildZavorthCliHudSnapshot } from './ZavorthCliHudProjection.js';

import { renderZavorthCliHud } from './ZavorthCliHudRenderer.js';
import { buildZavorthCliRuntimeTuiSnapshot } from './ZavorthCliRuntimeTuiProjection.js';
import { renderZavorthCliRuntimeTui } from './ZavorthCliRuntimeTuiRenderer.js';
import type { ZavorthCliHudDecision, ZavorthCliHudSnapshot } from './ZavorthCliHudTypes.js';

export type RunZavorthCliHudInput = {
  projectRoot: string;
  args?: string[];
  json?: boolean;
  now?: () => Date;
  tty?: boolean;
  mutationPlane?: Pick<ZavorthMutationPlaneService, 'listPlans' | 'readPlan' | 'approvePlan'> & Partial<Pick<ZavorthMutationPlaneService, 'rejectPlan' | 'deferPlan'>>;
  inputKeys?: string[];
};

export type RunZavorthCliHudResult = {
  exitCode: number;
  output: string;
  snapshot: ZavorthCliHudSnapshot;
};

export function runZavorthCliHud(input: RunZavorthCliHudInput): RunZavorthCliHudResult {
  const args = input.args || [];
  const mutationPlane = input.mutationPlane || new ZavorthMutationPlaneService();
  const runtimeMode = shouldRenderRuntimeTui(args, input.inputKeys || []);
  if (runtimeMode) {
    const runtimeRenderMode = args.includes('--technical') || args.includes('--full') || args.includes('--diagnostics') ? 'technical'
      : 'daily';
    const snapshot = buildZavorthCliRuntimeTuiSnapshot({
      projectRoot: input.projectRoot,
      mode: args.includes('--watch') ? 'watch' : input.tty ? 'interactive' : 'snapshot',
      now: input.now,
      mutationPlane,
      homeRoot: readFlag(args, 'home'),
    });
    const output = input.json || args.includes('--json') ? `${JSON.stringify(snapshot, null, 2)}\n`
      : `${renderZavorthCliRuntimeTui(snapshot, { mode: runtimeRenderMode })}\n`;
    const hudSnapshot = buildZavorthCliHudSnapshot({
      projectRoot: input.projectRoot,
      mode: 'snapshot',
      now: input.now,
      tty: input.tty,
      mutationPlane,
    });
    return { exitCode: 0, output, snapshot: hudSnapshot };
  }
  const action = readFlag(args, 'action');
  const reviewMode = args.includes('--review') || args[0] === 'review';
  const guideMode = args.includes('--guide') || args[0] === 'guide';
  const selectedIndex = readIntegerFlag(args, 'select') || readPositionalIndex(args);
  const targetPlanId = readFlag(args, 'plan') || readPositionalPlanId(args);
  const decision = action
    ? executeHudAction({
      projectRoot: input.projectRoot,
      action,
      targetPlanId,
      selectedIndex,
      mutationPlane,
      confirm: args.includes('--yes'),
      reason: readFlag(args, 'reason') || 'Operator decision from Zavorth HUD.',
    })
    : replayInputKeys({
      projectRoot: input.projectRoot,
      keys: input.inputKeys || [],
      targetPlanId,
      selectedIndex,
      mutationPlane,
    });
  const snapshot = buildZavorthCliHudSnapshot({
    projectRoot: input.projectRoot,
    mode: action ? 'action' : (reviewMode || guideMode) ? 'review' : 'snapshot',
    targetPlanId,
    selectedIndex,
    now: input.now,
    tty: input.tty,
    mutationPlane,
    decision,
  });
  const guided = guideMode ? buildZavorthCliGuidedReviewSnapshot(snapshot) : null;
  const output = input.json || args.includes('--json') ? `${JSON.stringify(guided || snapshot, null, 2)}\n`
    : guided
      ? renderZavorthCliGuidedReview(guided)
      : `${renderZavorthCliHud(snapshot)}\n`;

  return {
    exitCode: decision.status === 'unsupported' || decision.status === 'missing_target' ? 1 : 0,
    output,
    snapshot,
  };
}

export async function runZavorthCliHudInteractive(input: RunZavorthCliHudInput): Promise<RunZavorthCliHudResult> {
  const args = input.args || [];
  const shouldInteract = !input.json
    && !args.includes('--json')
    && !args.includes('--once')
    && !readFlag(args, 'action')
    && Boolean(process.stdin?.isTTY && process.stdout?.isTTY);
  if (shouldRenderRuntimeTui(args, input.inputKeys || [])) {
    const result = runZavorthCliHud({ ...input, tty: shouldInteract });
    if (!shouldInteract) {
      return result;
    }
    process.stdout.write(result.output);
    process.stdout.write('\nKeys: / commands, Tab sections, v voice arm/disarm, a approvals, d diffs, t tasks, q quit.\n');
    const message = await waitForRuntimeTuiDecision({
      projectRoot: input.projectRoot,
      args,
      now: input.now,
    });
    const refreshed = runZavorthCliHud({ ...input, args: ['runtime', '--once'], tty: true });
    const output = `\n${message}\n${refreshed.output}`;
    process.stdout.write(output);
    return {
      exitCode: 0,
      output,
      snapshot: {
        ...refreshed.snapshot,
        mode: 'interactive',
      },
    };
  }
  if (!shouldInteract) {
    return runZavorthCliHud(input);
  }

  const mutationPlane = input.mutationPlane || new ZavorthMutationPlaneService();
  let snapshot = runZavorthCliHud({ ...input, mutationPlane, tty: true }).snapshot;
  process.stdout.write(`${renderZavorthCliHud(snapshot)}\n`);
  process.stdout.write('\nPress h/d/o/r/q, or y twice to approve selected plan.\n');

  const decision = await waitForInteractiveDecision({
    projectRoot: input.projectRoot,
    mutationPlane,
    selectedPlanId: snapshot.selectedPlanId,
    selectedIndex: snapshot.selectedIndex,
  });
  snapshot = buildZavorthCliHudSnapshot({
    projectRoot: input.projectRoot,
    mode: 'interactive',
    targetPlanId: snapshot.selectedPlanId,
    selectedIndex: snapshot.selectedIndex,
    now: input.now,
    tty: true,
    mutationPlane,
    decision,
  });
  const output = `${renderZavorthCliHud(snapshot)}\n`;
  process.stdout.write(output);
  return {
    exitCode: decision.status === 'unsupported' || decision.status === 'missing_target' ? 1 : 0,
    output,
    snapshot,
  };
}

async function waitForRuntimeTuiDecision(input: {
  projectRoot: string;
  args: string[];
  now?: () => Date;
}): Promise<string> {
  readline.emitKeypressEvents(process.stdin);
  const stdin = process.stdin;
  const previousRawMode = stdin.isRaw;
  if (stdin.setRawMode) {
    stdin.setRawMode(true);
  }
  stdin.resume();

  return new Promise((resolve) => {
    const cleanup = () => {
      stdin.off('keypress', onKeypress);
      if (stdin.setRawMode) {
        stdin.setRawMode(Boolean(previousRawMode));
      }
      stdin.pause();
    };
    const onKeypress = async (_chunk: string, key: { name?: string; ctrl?: boolean; sequence?: string }) => {
      const name = String(key.name || key.sequence || '').toLowerCase();
      if ((key.ctrl && name === 'c') || name === 'q') {
        cleanup();
        resolve('Runtime TUI closed.');
        return;
      }
      if (name === 'v') {
        const { ZavorthHomePathService } = await import('../../services/ZavorthHomePathService.js');
        const { VoiceWakeRuntimeService } = await import('../../services/VoiceWakeRuntimeService.js');
        const home = new ZavorthHomePathService({
          projectRoot: input.projectRoot,
          explicitHome: readFlag(input.args, 'home'),
          env: process.env,
          now: input.now,
        }).resolveSnapshot();
        const wake = new VoiceWakeRuntimeService({
          stateFile: `${home.resolvedPaths.runtimeDir}/voice-wake-session.json`,
          env: process.env,
          now: input.now,
        });
        const current = wake.status();
        const next = current.mode === 'off' ? wake.arm() : wake.disarm();
        cleanup();
        resolve(`Voice wake is now ${next.mode}.`);
        return;
      }
      if (name === 'a') {
        cleanup();
        resolve('Open approvals with: zavorth approve');
        return;
      }
      if (name === 'd') {
        cleanup();
        resolve('Open diffs with: zavorth diff');
        return;
      }
      if (name === 't') {
        cleanup();
        resolve('Open tasks with: zavorth tasks list');
      }
    };
    stdin.on('keypress', onKeypress);
  });
}

function executeHudAction(input: {
  projectRoot: string;
  action: string;
  targetPlanId: string | null;
  selectedIndex?: number | null;
  mutationPlane: Pick<ZavorthMutationPlaneService, 'listPlans' | 'readPlan' | 'approvePlan'> & Partial<Pick<ZavorthMutationPlaneService, 'rejectPlan' | 'deferPlan'>>;
  confirm: boolean;
  reason?: string | null;
}): ZavorthCliHudDecision {
  const action = input.action.toLowerCase();
  if (action === 'select') {
    const planId = resolvePlanId(input.mutationPlane, input.targetPlanId, input.selectedIndex);
    if (!planId) {
      return { attempted: true, key: '1-9', status: 'missing_target', message: 'No plan is available for this selection.' };
    }
    return {
      attempted: true,
      key: String(input.selectedIndex || '...'),
      status: 'selected',
      command: `zavorth hud --plan ${planId}`,
      message: `Selected plan ${planId}.`,
      receiptId: `hud-selected:${planId}`,
    };
  }
  if (action === 'home') {
    return { attempted: true, key: 'h', status: 'shown', command: 'zavorth', message: 'Home shortcut selected.' };
  }
  if (action === 'open') {
    return { attempted: true, key: 'o', status: 'opened', command: 'zavorth open', message: 'ZavorthControl shortcut selected.' };
  }
  if (action === 'diff') {
    const planId = resolvePlanId(input.mutationPlane, input.targetPlanId, input.selectedIndex);
    if (!planId) {
      return { attempted: true, key: 'd', status: 'missing_target', message: 'No pending plan is available for diff.' };
    }
    return { attempted: true, key: 'd', status: 'shown', command: `zavorth diff ${planId}`, message: `Diff shortcut selected for ${planId}.` };
  }
  if (action === 'approve') {
    const planId = resolvePlanId(input.mutationPlane, input.targetPlanId, input.selectedIndex);
    if (!planId) {
      return { attempted: true, key: 'y', status: 'missing_target', message: 'No pending plan is available for approval.' };
    }
    if (!input.confirm) {
      return {
        attempted: true,
        key: 'y',
        status: 'armed',
        command: `zavorth approve ${planId} --yes`,
        message: 'Approval armed. Re-run with --yes, or press y twice in interactive mode.',
      };
    }
    const result = runZavorthCliApprovalDiff({
      projectRoot: input.projectRoot,
      view: 'approvals',
      args: [planId, '--yes'],
      mutationPlane: input.mutationPlane,
    });
    return {
      attempted: true,
      key: 'y',
      status: result.snapshot.decision.status === 'approved' ? 'approved' : 'unsupported',
      command: `zavorth approve ${planId} --yes`,
      message: result.snapshot.decision.message,
      receiptId: result.snapshot.decision.status === 'approved' ? `hud-approved:${planId}` : null,
    };
  }
  if (action === 'reject') {
    const planId = resolvePlanId(input.mutationPlane, input.targetPlanId, input.selectedIndex);
    if (!planId) {
      return { attempted: true, key: 'x', status: 'missing_target', message: 'No pending plan is available for rejection.' };
    }
    if (!input.confirm) {
      return {
        attempted: true,
        key: 'x',
        status: 'armed',
        command: `zavorth hud --action reject --plan ${planId} --yes`,
        message: 'Rejection armed. Re-run with --yes, or press x twice in interactive mode.',
      };
    }
    if (!input.mutationPlane.rejectPlan) {
      return { attempted: true, key: 'x', status: 'unsupported', message: 'Mutation plane does not support rejectPlan.' };
    }
    const rejected = input.mutationPlane.rejectPlan(planId, input.reason || 'Rejected from Zavorth HUD.', 'cli-hud');
    return {
      attempted: true,
      key: 'x',
      status: 'rejected',
      command: `zavorth hud --action reject --plan ${planId} --yes`,
      message: `Plan rejected and blocked: ${rejected.title}.`,
      receiptId: `hud-rejected:${planId}:${rejected.audit.length}`,
    };
  }
  if (action === 'defer') {
    const planId = resolvePlanId(input.mutationPlane, input.targetPlanId, input.selectedIndex);
    if (!planId) {
      return { attempted: true, key: 's', status: 'missing_target', message: 'No pending plan is available for defer.' };
    }
    if (!input.confirm) {
      return {
        attempted: true,
        key: 's',
        status: 'armed',
        command: `zavorth hud --action defer --plan ${planId} --yes`,
        message: 'Defer armed. Re-run with --yes, or press s twice in interactive mode.',
      };
    }
    if (!input.mutationPlane.deferPlan) {
      return { attempted: true, key: 's', status: 'unsupported', message: 'Mutation plane does not support deferPlan.' };
    }
    const deferred = input.mutationPlane.deferPlan(planId, input.reason || 'Deferred from Zavorth HUD.', 'cli-hud');
    return {
      attempted: true,
      key: 's',
      status: 'deferred',
      command: `zavorth hud --action defer --plan ${planId} --yes`,
      message: `Plan deferred and kept pending: ${deferred.title}.`,
      receiptId: `hud-deferred:${planId}:${deferred.audit.length}`,
    };
  }
  if (action === 'quit') {
    return { attempted: true, key: 'q', status: 'quit', command: null, message: 'HUD closed.' };
  }
  return { attempted: true, key: null, status: 'unsupported', message: `Unsupported HUD action: ${input.action}.` };
}

function replayInputKeys(input: {
  projectRoot: string;
  keys: string[];
  targetPlanId: string | null;
  selectedIndex?: number | null;
  mutationPlane: Pick<ZavorthMutationPlaneService, 'listPlans' | 'readPlan' | 'approvePlan'> & Partial<Pick<ZavorthMutationPlaneService, 'rejectPlan' | 'deferPlan'>>;
}): ZavorthCliHudDecision {
  if (input.keys.length === 0) {
    return {
      attempted: false,
      key: null,
      status: 'none',
      message: 'HUD ready. Use shortcuts for the next safe action.',
    };
  }
  let armed = false;
  let armedAction: 'approve' | 'reject' | 'defer' | null = null;
  for (const rawKey of input.keys) {
    const key = rawKey.toLowerCase();
    if (/^[1-9]$/.test(key)) {
      return executeHudAction({
        projectRoot: input.projectRoot,
        action: 'select',
        targetPlanId: input.targetPlanId,
        selectedIndex: Number(key),
        mutationPlane: input.mutationPlane,
        confirm: false,
      });
    }
    if (['y', 'x', 's'].includes(key)) {
      const action = key === 'y' ? 'approve' : key === 'x' ? 'reject' : 'defer';
      if (!armed || armedAction !== action) {
        armed = true;
        armedAction = action;
        continue;
      }
      return executeHudAction({
        projectRoot: input.projectRoot,
        action,
        targetPlanId: input.targetPlanId,
        selectedIndex: input.selectedIndex,
        mutationPlane: input.mutationPlane,
        confirm: true,
      });
    }
    if (['h', 'd', 'o', 'q'].includes(key)) {
      const action = key === 'h' ? 'home' : key === 'd' ? 'diff' : key === 'o' ? 'open' : 'quit';
      return executeHudAction({
        projectRoot: input.projectRoot,
        action,
        targetPlanId: input.targetPlanId,
        selectedIndex: input.selectedIndex,
        mutationPlane: input.mutationPlane,
        confirm: false,
      });
    }
  }
  return {
    attempted: true,
    key: input.keys[input.keys.length - 1] || null,
    status: armed ? 'armed' : 'unsupported',
    message: armed ? `Decision armed. Press ${armedAction === 'reject' ? 'x' : armedAction === 'defer' ? 's' : 'y'} again to confirm.` : 'No supported HUD shortcut was selected.',
  };
}

async function waitForInteractiveDecision(input: {
  projectRoot: string;
  selectedPlanId: string | null;
  selectedIndex?: number | null;
  mutationPlane: Pick<ZavorthMutationPlaneService, 'listPlans' | 'readPlan' | 'approvePlan'> & Partial<Pick<ZavorthMutationPlaneService, 'rejectPlan' | 'deferPlan'>>;
}): Promise<ZavorthCliHudDecision> {
  readline.emitKeypressEvents(process.stdin);
  const stdin = process.stdin;
  const previousRawMode = stdin.isRaw;
  if (stdin.setRawMode) {
    stdin.setRawMode(true);
  }
  stdin.resume();

  return new Promise((resolve) => {
    let armed = false;
    let armedAction: 'approve' | 'reject' | 'defer' | null = null;
    const cleanup = () => {
      stdin.off('keypress', onKeypress);
      if (stdin.setRawMode) {
        stdin.setRawMode(Boolean(previousRawMode));
      }
      stdin.pause();
    };
    const onKeypress = (_chunk: string, key: { name?: string; ctrl?: boolean }) => {
      const name = String(key.name || '').toLowerCase();
      if (key.ctrl && name === 'c') {
        cleanup();
        resolve({ attempted: true, key: 'ctrl+c', status: 'quit', message: 'HUD interrupted by operator.' });
        return;
      }
      if (/^[1-9]$/.test(name)) {
        cleanup();
        resolve(executeHudAction({
          projectRoot: input.projectRoot,
          action: 'select',
          targetPlanId: input.selectedPlanId,
          selectedIndex: Number(name),
          mutationPlane: input.mutationPlane,
          confirm: false,
        }));
        return;
      }
      if (['y', 'x', 's'].includes(name)) {
        const action = name === 'y' ? 'approve' : name === 'x' ? 'reject' : 'defer';
        if (!armed || armedAction !== action) {
          armed = true;
          armedAction = action;
          process.stdout.write(`\n${action} armed. Press ${name} again to confirm, or q to cancel.\n`);
          return;
        }
        cleanup();
        resolve(executeHudAction({
          projectRoot: input.projectRoot,
          action,
          targetPlanId: input.selectedPlanId,
          selectedIndex: input.selectedIndex,
          mutationPlane: input.mutationPlane,
          confirm: true,
        }));
        return;
      }
      if (['h', 'd', 'o', 'q'].includes(name)) {
        cleanup();
        resolve(executeHudAction({
          projectRoot: input.projectRoot,
          action: name === 'h' ? 'home' : name === 'd' ? 'diff' : name === 'o' ? 'open' : 'quit',
          targetPlanId: input.selectedPlanId,
          selectedIndex: input.selectedIndex,
          mutationPlane: input.mutationPlane,
          confirm: false,
        }));
      }
    };
    stdin.on('keypress', onKeypress);
  });
}


function resolvePlanId(
  mutationPlane: Pick<ZavorthMutationPlaneService, 'listPlans'>,
  targetPlanId?: string | null,
  selectedIndex?: number | null,
): string | null {
  if (targetPlanId) {
    return targetPlanId;
  }
  const plans = mutationPlane.listPlans({ limit: 20, includeExpired: false })
    .filter((plan) => plan.status === 'waiting_approval' || plan.approval.status === 'pending');
  if (typeof selectedIndex === 'number' && selectedIndex > 0) {
    return plans[selectedIndex - 1]?.id || null;
  }
  return plans[0]?.id || null;
}

function readFlag(args: string[], name: string): string | null {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) {
    return inline.slice(name.length + 3);
  }
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : null;
}

function shouldRenderRuntimeTui(args: string[], inputKeys: string[]): boolean {
  const first = String(args[0] || '').trim().toLowerCase();
  if (args.includes('--runtime') || first === 'runtime' || args.includes('--tui') || first === 'tui') {
    return true;
  }
  if (inputKeys.length > 0) {
    return false;
  }
  const hasApprovalAction = args.includes('--action')
    || args.some((arg) => arg.startsWith('--action='))
    || args.includes('--plan')
    || args.some((arg) => arg.startsWith('--plan='))
    || args.includes('--select')
    || args.some((arg) => arg.startsWith('--select='))
    || first === 'review'
    || first === 'guide';
  return !hasApprovalAction;
}

function readIntegerFlag(args: string[], name: string): number | null {
  const raw = readFlag(args, name);
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function readPositionalIndex(args: string[]): number | null {
  const value = readRawPositional(args);
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  return Number(value);
}

function readPositionalPlanId(args: string[]): string | null {
  const value = readRawPositional(args);
  return value && /^[1-9]\d*$/.test(value) ? null : value;
}

function readRawPositional(args: string[]): string | null {
  const flagValueIndexes = new Set<number>();
  for (let index = 0; index < args.length; index += 1) {
    if (['--action', '--plan', '--select', '--reason'].includes(args[index]) && args[index + 1] && !args[index + 1].startsWith('--')) {
      flagValueIndexes.add(index + 1);
    }
  }
  return args.find((arg, index) => !flagValueIndexes.has(index) && !arg.startsWith('--') && !['hud', 'review', 'guide'].includes(arg)) || null;
}
