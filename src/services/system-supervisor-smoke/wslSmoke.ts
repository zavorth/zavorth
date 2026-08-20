import { failFromSmokeAction, readSmokeStringArrayMetadata, shouldSkipOptionalSmokeRuntime, skipFromSmokeAction } from './smokeActions.js';
import type { ExecuteSmokeAction, SystemOverlordSmokeItem } from './smokeTypes.js';

export async function runWslSmoke(input: {
  platform: NodeJS.Platform;
  executeSmokeAction: ExecuteSmokeAction;
}): Promise<SystemOverlordSmokeItem> {
  if (input.platform !== 'win32') {
    return {
      capability: 'wsl.exec',
      status: 'skipped',
      actionId: null,
      runtimeTarget: 'wsl',
      summary: 'Supervised WSL skipped because this host is not Windows.',
      detail: `Host current: ${input.platform}.`,
      error: null,
      operatorNextStep: 'Run este smoke em um host Windows com WSL para validate wsl.exec de ponta a ponta.',
    };
  }

  const inspect = await input.executeSmokeAction({
    capability: 'wsl.exec',
    profile: 'trusted',
    autonomyLevel: 4,
    approved: true,
    timeoutMs: 15_000,
    objective: 'Inspect WSL distros available for supervised execution.',
    command: JSON.stringify({
      action: 'inspect',
    }),
  });
  if (inspect.status !== 'completed') {
    if (shouldSkipOptionalSmokeRuntime('wsl.exec', inspect)) {
      return skipFromSmokeAction(
        'wsl.exec',
        inspect,
        'Supervised WSL skipped because WSL runtime is not ready on this host yet.',
        'Install/configure WSL and at least one distribution before using supervised wsl.exec.',
      );
    }
    return failFromSmokeAction(
      'wsl.exec',
      inspect,
      'Supervised WSL failed during the runtime inspection step.',
    );
  }

  const distributions = readSmokeStringArrayMetadata(inspect, 'distributions');
  const distribution = distributions[0] || '';
  if (!distribution) {
    return {
      capability: 'wsl.exec',
      status: 'skipped',
      actionId: inspect.actionId,
      runtimeTarget: inspect.decision.runtimeTarget,
      summary: 'Supervised WSL skipped because no distribution is available.',
      detail: inspect.stdout || null,
      error: null,
      operatorNextStep: 'Instale e inicialize ao menos uma distro WSL before usar wsl.exec supervised.',
    };
  }

  const exec = await input.executeSmokeAction({
    capability: 'wsl.exec',
    profile: 'trusted',
    autonomyLevel: 4,
    approved: true,
    timeoutMs: 15_000,
    objective: 'run supervised pwd inside the WSL distribution.',
    command: JSON.stringify({
      action: 'exec',
      distribution,
      command: 'pwd',
    }),
  });
  if (exec.status !== 'completed') {
    return failFromSmokeAction(
      'wsl.exec',
      exec,
      `WSL supervised encontrou a distro ${distribution}, mas failed ao run pwd.`,
    );
  }

  return {
    capability: 'wsl.exec',
    status: 'passed',
    actionId: exec.actionId,
    runtimeTarget: exec.decision.runtimeTarget,
    summary: `WSL supervised executou pwd na distro ${distribution}.`,
    detail: String(exec.stdout || '').trim() || null,
    error: null,
    operatorNextStep: null,
  };
}
