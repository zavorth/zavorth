import {
  failFromSmokeAction,
  readSmokeStringArrayMetadata,
  shouldSkipOptionalSmokeRuntime,
  skipFromSmokeAction,
} from './smokeActions.js';
import type { ExecuteSmokeAction, SystemOverlordSmokeItem } from './smokeTypes.js';
import type { SystemOverlordActionRecord } from '../../contracts/SystemOverlordContract.js';
import { logger } from '../../logger.js';
import { asErrorLike } from '../../utils/errorLike';

async function inspectDockerRuntime(
  executeSmokeAction: ExecuteSmokeAction,
) {
  return await executeSmokeAction({
    capability: 'docker.exec',
    profile: 'trusted',
    autonomyLevel: 3,
    approved: true,
    timeoutMs: 15_000,
    objective: 'Inspect Docker containers available for supervised execution.',
    command: JSON.stringify({
      action: 'inspect',
    }),
  });
}

function shouldRetryDockerInspect(action: {
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  stderr?: string | null;
}): boolean {
  return action.status !== 'completed'
    && (
      shouldSkipOptionalSmokeRuntime('docker.exec', action as unknown as SystemOverlordActionRecord)
      || action.errorCode === 'action_timed_out'
    );
}

async function removeDockerProbeContainer(
  container: string,
  executeSmokeAction: ExecuteSmokeAction,
) {
  return await executeSmokeAction({
    capability: 'docker.exec',
    profile: 'trusted',
    autonomyLevel: 3,
    approved: true,
    timeoutMs: 15_000,
    objective: `Remove the temporary container ${container} created only for the supervised smoke.`,
    command: JSON.stringify({
      action: 'rm',
      container,
    }),
  });
}

export async function runDockerSmoke(input: {
  executeSmokeAction: ExecuteSmokeAction;
  ensureDockerDesktop?: (() => Promise<boolean>) | null;
  stopDockerDesktop?: (() => Promise<void>) | null;
  sleep?: ((ms: number) => Promise<void>) | null;
}): Promise<SystemOverlordSmokeItem> {
  const sleep = input.sleep || (async (ms: number) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
  let inspect = await inspectDockerRuntime(input.executeSmokeAction);
  let dockerStartedBySmoke = false;

  try {
    if (
      inspect.status !== 'completed'
      && shouldRetryDockerInspect(inspect)
      && input.ensureDockerDesktop
    ) {
      dockerStartedBySmoke = await input.ensureDockerDesktop();
      if (dockerStartedBySmoke) {
        for (let attempt = 0; attempt < 12 && inspect.status !== 'completed'; attempt += 1) {
          await sleep(5_000);
          inspect = await inspectDockerRuntime(input.executeSmokeAction);
          if (!shouldRetryDockerInspect(inspect)) {
            break;
          }
        }
      }
    }

    if (inspect.status !== 'completed') {
      if (shouldRetryDockerInspect(inspect)) {
        return skipFromSmokeAction(
          'docker.exec',
          inspect,
          dockerStartedBySmoke ? 'Supervised Docker tried to wake Docker Desktop, but the daemon was not ready on this host yet.'
            : 'Supervised Docker skipped because the daemon or CLI is not ready on this host yet.',
          dockerStartedBySmoke ? 'Revise o Docker Desktop e o companion docker-desktop before usar docker.exec supervised.'
            : 'Instale/inicie o Docker Desktop ou daemon equivalente before usar docker.exec supervised.',
        );
      }
      return failFromSmokeAction(
        'docker.exec',
        inspect,
        'Docker supervised failed ainda na stage de inspecao do runtime.',
      );
    }

    const containers = readSmokeStringArrayMetadata(inspect, 'containers');
    let container = containers[0] || '';
    let containerProvisionedBySmoke = false;
    if (!container) {
      const provision = await input.executeSmokeAction({
        capability: 'docker.exec',
        profile: 'trusted',
        autonomyLevel: 3,
        approved: true,
        timeoutMs: 30_000,
        objective: 'Provision a temporary container to validate supervised docker.exec end to end.',
        command: JSON.stringify({
          action: 'run',
          container: `zavorth-overlord-smoke-${Date.now().toString(36)}`,
          image: 'alpine:3.20',
          command: 'sh',
          args: ['-lc', 'sleep 300'],
        }),
      });
      if (provision.status !== 'completed') {
        return failFromSmokeAction(
          'docker.exec',
          provision,
          'Supervised Docker found the daemon, but failed to provision the temporary smoke container.',
        );
      }
      container = String(provision.metadata?.container || '').trim();
      containerProvisionedBySmoke = Boolean(container);
      if (!container) {
        return {
          capability: 'docker.exec',
          status: 'failed',
          actionId: provision.actionId,
          runtimeTarget: provision.decision.runtimeTarget,
          summary: 'Supervised Docker created a temporary run, but did not return a valid container for the smoke check.',
          detail: provision.stdout || null,
          error: provision.errorMessage || 'Temporary container not identified.',
          operatorNextStep: 'Review the supervised Docker adapter before using docker.exec in production.',
        };
      }
    }

    const probeCommands = [
      { command: 'pwd', args: [] as string[] },
      { command: 'sh', args: ['-lc', 'pwd'] },
      { command: 'cmd', args: ['/c', 'cd'] },
      { command: 'powershell', args: ['-Command', 'Get-Location'] },
    ];
    const failures: string[] = [];
    try {
      for (const probe of probeCommands) {
        const exec = await input.executeSmokeAction({
          capability: 'docker.exec',
          profile: 'trusted',
          autonomyLevel: 3,
          approved: true,
          timeoutMs: 15_000,
          objective: `run comando supervised de diagnostic no container ${container}.`,
          command: JSON.stringify({
            action: 'exec',
            container,
            command: probe.command,
            args: probe.args,
          }),
        });
        if (exec.status === 'completed') {
          const cleanup = containerProvisionedBySmoke
            ? await removeDockerProbeContainer(container, input.executeSmokeAction)
            : null;
          if (cleanup && cleanup.status !== 'completed') {
            return {
              capability: 'docker.exec',
              status: 'failed',
              actionId: cleanup.actionId,
              runtimeTarget: cleanup.decision.runtimeTarget,
              summary: `Docker supervised executou ${probe.command} no container ${container}, but could not remove the temporary smoke-check container.`,
              detail: cleanup.stderr || cleanup.stdout || null,
              error: cleanup.errorMessage || 'Failure while removing temporary container.',
              operatorNextStep: `Run "docker rm -f ${container}" e revise o adapter supervised do Docker.`,
            };
          }
          containerProvisionedBySmoke = false;
          return {
            capability: 'docker.exec',
            status: 'passed',
            actionId: exec.actionId,
            runtimeTarget: exec.decision.runtimeTarget,
            summary: `Docker supervised executou ${probe.command} no container ${container}.`,
            detail: String(exec.stdout || '').trim() || `Probe executado com ${probe.command}.`,
            error: null,
            operatorNextStep: null,
          };
        }
        failures.push(`${probe.command}: ${exec.errorMessage || exec.stderr || exec.errorCode || exec.status}`);
      }
    } finally {
      if (containerProvisionedBySmoke) {
        try {
          await removeDockerProbeContainer(container, input.executeSmokeAction);
        } catch (error: unknown) {
          const err = asErrorLike(error);
          logger.warn("[auto-fix] Empty catch block", err); }
      }
    }

    return {
      capability: 'docker.exec',
      status: 'failed',
      actionId: inspect.actionId,
      runtimeTarget: inspect.decision.runtimeTarget,
      summary: `Docker supervised encontrou o container ${container}, mas nenhum probe basico conseguiu run dentro dele.`,
      detail: failures.join(' | ') || null,
      error: failures[0] || 'No probe supervised conseguiu run no container.',
      operatorNextStep: 'Revise o container alvo e garanta que ele aceite ao menos um shell/command basico para smoke supervised.',
    };
  } finally {
    if (dockerStartedBySmoke && input.stopDockerDesktop) {
      try {
        const finalInspect = await inspectDockerRuntime(input.executeSmokeAction);
        const hasContainers =
          finalInspect.status === 'completed'
          && readSmokeStringArrayMetadata(finalInspect, 'containers').length > 0;
        if (!hasContainers) {
          await input.stopDockerDesktop();
        }
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.warn("[auto-fix] Empty catch block", err); }
    }
  }
}
