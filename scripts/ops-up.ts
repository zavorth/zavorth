#!/usr/bin/env node

import fs from 'fs';
import { spawn, spawnSync } from 'child_process';
import path from 'path';
import { config } from '../src/config/index.js';
import { RuntimeAccessLaunchService } from '../src/runtime/access/RuntimeAccessLaunchService.js';
import { RuntimeBootstrapRepairService } from '../src/runtime/access/RuntimeBootstrapRepairService.js';
import { RuntimeAccessReadinessService } from '../src/runtime/access/RuntimeAccessReadinessService.js';
import { RuntimeStartupService } from '../src/runtime/access/RuntimeStartupService.js';

function parseNumericFlag(argv: string[], name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const inline = argv.find((entry) => entry.startsWith(prefix));
  if (inline) {
    const value = Number(inline.slice(prefix.length));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  const index = argv.findIndex((entry) => entry === `--${name}`);
  if (index >= 0) {
    const value = Number(argv[index + 1]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  return fallback;
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

function resolvePowerShellExecutable(): string {
  if (process.platform !== 'win32') {
    return '';
  }

  const systemRoot = String(process.env.SystemRoot || 'C:\\Windows').trim() || 'C:\\Windows';
  const resolved = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  if (fs.existsSync(resolved)) {
    return resolved;
  }

  return 'powershell.exe';
}

function launchDetachedRuntime(): void {
  const projectRoot = config.projectRoot;

  if (process.platform === 'win32') {
    const launcherScript = String((config as any).supervisedLauncherScriptPath || '').trim();
    if (launcherScript && fs.existsSync(launcherScript)) {
      const powershellExecutable = resolvePowerShellExecutable();
      const launcherResult = spawnSync(
        powershellExecutable,
        [
          '-ExecutionPolicy',
          'Bypass',
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-File',
          launcherScript,
          '-Headless',
          '-Reason',
          'ops-up',
        ],
        {
          cwd: projectRoot,
          stdio: 'ignore',
          windowsHide: true,
          timeout: 240_000,
          env: {
            ...process.env,
            ZAVORTH_SUPERVISED: 'true',
            ZAVORTH_LAUNCH_SOURCE: 'ops-up',
          },
        },
      );

      if (!launcherResult.error && launcherResult.status === 0) {
        return;
      }
    }

    const runtimeDir = path.join(projectRoot, 'data', 'runtime');
    const stdoutLog = path.join(runtimeDir, 'supervised-runtime.out.log');
    const stderrLog = path.join(runtimeDir, 'supervised-runtime.err.log');
    const hostScript = path.join(projectRoot, 'dist', 'host.js');
    fs.mkdirSync(runtimeDir, { recursive: true });
    const stdoutFd = fs.openSync(stdoutLog, 'a');
    const stderrFd = fs.openSync(stderrLog, 'a');
    const child = spawn(process.execPath, [hostScript], {
      cwd: projectRoot,
      detached: true,
      stdio: ['ignore', stdoutFd, stderrFd],
      windowsHide: true,
      env: {
        ...process.env,
        ZAVORTH_SUPERVISED: 'true',
      },
    });
    fs.closeSync(stdoutFd);
    fs.closeSync(stderrFd);
    child.unref();
    return;
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(
    npmCommand,
    ['run', 'dev:supervised'],
    {
      cwd: projectRoot,
      detached: true,
      stdio: 'ignore',
    },
  );
  child.unref();
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const requireMutableAccess = !argv.includes('--allow-readonly');
  const timeoutMs = parseNumericFlag(argv, 'timeout-ms', 120_000);
  const pollIntervalMs = parseNumericFlag(argv, 'poll-ms', 2_000);
  const openLocal = hasFlag(argv, 'open-local');
  const openRemote = hasFlag(argv, 'open-remote');
  const openBest = hasFlag(argv, 'open-best');
  const readinessService = new RuntimeAccessReadinessService();
  const bootstrapRepairService = new RuntimeBootstrapRepairService();
  const launchService = new RuntimeAccessLaunchService();
  const logProgress = (message: string) => {
    if (!asJson) {
      console.log(`[zavorth-up] ${message}`);
    }
  };
  let launchAttempted = false;
  let repairSummary = 'nao necessario';
  let repairStepsExecuted = 0;

  const startup = new RuntimeStartupService({
    prepareRuntime: async () => {
      logProgress('preparando runtime com correcoes seguras...');
      const repair = bootstrapRepairService.repair();
      repairStepsExecuted = repair.steps.filter((step) => step.status === 'executed').length;
      const failedBlockingStep = repair.steps.find((step) => step.status === 'failed' && step.blocking);
      const failedNonBlockingSteps = repair.steps.filter((step) => step.status === 'failed' && !step.blocking);
      const hasExecutedStep = repairStepsExecuted > 0;
      if (failedBlockingStep) {
        repairSummary = 'falhou';
        throw new Error(failedBlockingStep.error || repair.summary);
      }

      repairSummary = failedNonBlockingSteps.length > 0
        ? 'aplicado-com-avisos'
        : hasExecutedStep
          ? 'aplicado'
          : 'nao necessario';
      if (hasExecutedStep) {
        logProgress(`reparo seguro aplicado (${repairStepsExecuted} passo(s)).`);
      } else {
        logProgress('nenhuma correcao segura precisou ser aplicada.');
      }
      if (failedNonBlockingSteps.length > 0) {
        for (const step of failedNonBlockingSteps) {
          logProgress(`aviso nao bloqueante em ${step.title}: ${step.error || 'falha sem detalhe.'}`);
        }
      }
    },
    readinessService,
    launchRuntime: async () => {
      logProgress('verificando se o host precisa subir...');
      const readiness = await readinessService.inspectLive();
      if (readiness.local.ready && (!requireMutableAccess || readiness.runtime.hostAuthorized !== false)) {
        logProgress('o host ja estava pronto.');
        return;
      }
      launchAttempted = true;
      logProgress('subindo o host supervisionado...');
      launchDetachedRuntime();
    },
  });

  const result = await startup.startAndWait({
    timeoutMs,
    pollIntervalMs,
    requireMutableAccess,
  });
  const launchPreference = openRemote ? 'remote' : (openLocal ? 'local' : (openBest ? 'best' : null));
  const launchSelection = launchPreference
    ? launchService.selectTarget(
      {
        local: {
          ready: result.readiness.local.ready,
          appUrl: result.manifest.local.appUrl,
        },
        remote: {
          ready: result.readiness.remote.ready,
          appUrl: result.manifest.remote.appUrl || null,
        },
      },
      launchPreference,
    )
    : null;
  const launchResult = launchSelection
    ? await launchService.openSelected(launchSelection)
    : null;

  if (asJson) {
    process.stdout.write(
      `${JSON.stringify({ ...result, launchAttempted, repairSummary, repairStepsExecuted, launch: launchResult }, null, 2)}\n`,
    );
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  console.log('[zavorth-up] bootstrap operacional');
  console.log(`[zavorth-up] resumo: ${result.summary}`);
  console.log(`[zavorth-up] reparo seguro: ${repairSummary} | passos=${repairStepsExecuted}`);
  if (result.ok && !result.readiness.local.ready) {
    console.log('[zavorth-up] console local pronta em modo readonly; faltam apenas itens mutaveis/remotos.');
  }
  console.log(
    `[zavorth-up] launch: ${launchAttempted ? 'tentado' : 'nao necessario'} | tentativas=${result.attempts} | duracao=${result.durationMs}ms`,
  );
  console.log(
    `[zavorth-up] local: ${result.readiness.local.ready ? 'pronto' : result.ok ? 'readonly' : 'pendente'} | ${result.manifest.local.appUrl}`,
  );
  console.log(
    `[zavorth-up] remoto: ${result.readiness.remote.ready ? 'pronto' : 'pendente'} | ${result.manifest.remote.appUrl || 'nao configurado'}`,
  );
  console.log(
    `[zavorth-up] auth: ${result.manifest.auth.required ? result.manifest.auth.source : 'ausente'} | host autorizado: ${
      result.manifest.auth.authorizedHost === false ? 'nao' : 'sim'
    }`,
  );
  if (launchSelection) {
    console.log(`[zavorth-up] abrir: ${launchSelection.url || 'nao disponivel'} | ${launchSelection.reason}`);
    if (launchResult?.attempted) {
      console.log(`[zavorth-up] launch: ${launchResult.ok ? 'ok' : 'falhou'}${launchResult.error ? ` (${launchResult.error})` : ''}`);
    }
  }
  if (result.manifest.surfaces.length > 0) {
    console.log('[zavorth-up] entradas recomendadas:');
    for (const surface of result.manifest.surfaces.filter((entry) => entry.primary || entry.id === 'telegram' || entry.id === 'cli')) {
      console.log(
        `- ${surface.label}: ${surface.entry}${surface.remoteEntry ? ` | remoto: ${surface.remoteEntry}` : ''}`,
      );
    }
  }

  if (result.readiness.nextSteps.length > 0) {
    console.log('[zavorth-up] proximos passos:');
    for (const step of result.readiness.nextSteps) {
      console.log(`- ${step.title}: ${step.description}`);
    }
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[zavorth-up] falha ao subir o runtime.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
