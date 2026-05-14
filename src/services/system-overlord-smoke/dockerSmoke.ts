import {
  failFromSmokeAction,
  readSmokeStringArrayMetadata,
  shouldSkipOptionalSmokeRuntime,
  skipFromSmokeAction,
} from './smokeActions.js';
import type { ExecuteSmokeAction, SystemOverlordSmokeItem } from './smokeTypes.js';

async function inspectDockerRuntime(
  executeSmokeAction: ExecuteSmokeAction,
) {
  return await executeSmokeAction({
    capability: 'docker.exec',
    profile: 'trusted',
    autonomyLevel: 3,
    approved: true,
    timeoutMs: 15_000,
    objective: 'Inspecionar containers Docker disponiveis para execucao supervisionada.',
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
      shouldSkipOptionalSmokeRuntime('docker.exec', action as any)
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
    objective: `Remover o container temporario ${container} criado apenas para o smoke supervisionado.`,
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
          dockerStartedBySmoke
            ? 'Docker supervisionado tentou acordar o Docker Desktop, mas o daemon ainda nao ficou pronto neste host.'
            : 'Docker supervisionado pulado porque o daemon ou o CLI ainda nao estao prontos neste host.',
          dockerStartedBySmoke
            ? 'Revise o Docker Desktop e o companion docker-desktop antes de usar docker.exec supervisionado.'
            : 'Instale/inicie o Docker Desktop ou daemon equivalente antes de usar docker.exec supervisionado.',
        );
      }
      return failFromSmokeAction(
        'docker.exec',
        inspect,
        'Docker supervisionado falhou ainda na fase de inspecao do runtime.',
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
        objective: 'Provisionar um container temporario para validar docker.exec supervisionado de ponta a ponta.',
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
          'Docker supervisionado encontrou o daemon, mas falhou ao provisionar o container temporario do smoke.',
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
          summary: 'Docker supervisionado criou um run temporario, mas nao devolveu um container valido para o smoke.',
          detail: provision.stdout || null,
          error: provision.errorMessage || 'Container temporario nao identificado.',
          operatorNextStep: 'Revise o adapter docker supervisionado antes de usar docker.exec em producao.',
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
          objective: `Executar comando supervisionado de diagnostico no container ${container}.`,
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
              summary: `Docker supervisionado executou ${probe.command} no container ${container}, mas nao conseguiu remover o container temporario do smoke.`,
              detail: cleanup.stderr || cleanup.stdout || null,
              error: cleanup.errorMessage || 'Falha ao remover container temporario.',
              operatorNextStep: `Rode "docker rm -f ${container}" e revise o adapter supervisionado do Docker.`,
            };
          }
          containerProvisionedBySmoke = false;
          return {
            capability: 'docker.exec',
            status: 'passed',
            actionId: exec.actionId,
            runtimeTarget: exec.decision.runtimeTarget,
            summary: `Docker supervisionado executou ${probe.command} no container ${container}.`,
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
        } catch {}
      }
    }

    return {
      capability: 'docker.exec',
      status: 'failed',
      actionId: inspect.actionId,
      runtimeTarget: inspect.decision.runtimeTarget,
      summary: `Docker supervisionado encontrou o container ${container}, mas nenhum probe basico conseguiu executar dentro dele.`,
      detail: failures.join(' | ') || null,
      error: failures[0] || 'Nenhum probe supervisionado conseguiu executar no container.',
      operatorNextStep: 'Revise o container alvo e garanta que ele aceite ao menos um shell/command basico para smoke supervisionado.',
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
      } catch {}
    }
  }
}
