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
  let repairSummary = 'not needed';
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
        repairSummary = 'failed';
        throw new Error(failedBlockingStep.error || repair.summary);
      }

      repairSummary = failedNonBlockingSteps.length > 0
        ? 'aplicado-com-avisos'
        : hasExecutedStep ? 'aplicado'
          : 'not needed';
      if (hasExecutedStep) {
        logProgress(`safe repair applied (${repairStepsExecuted} step(s)).`);
      } else {
        logProgress('no safe correction needed to be applied.');
      }
      if (failedNonBlockingSteps.length > 0) {
        for (const step of failedNonBlockingSteps) {
          logProgress(`non-blocking warning in ${step.title}: ${step.error || 'failure without details.'}`);
        }
      }
    },
    readinessService,
    launchRuntime: async () => {
      logProgress('checking whether the host needs to start...');
      const readiness = await readinessService.inspectLive();
      if (readiness.local.ready && (!requireMutableAccess || readiness.runtime.hostAuthorized !== false)) {
        logProgress('o host already estava ready.');
        return;
      }
      launchAttempted = true;
      logProgress('subindo o host supervised...');
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

  console.log('[zavorth-up] bootstrap operational');
  console.log(`[zavorth-up] summary: ${result.summary}`);
  console.log(`[zavorth-up] safe repair: ${repairSummary} | steps=${repairStepsExecuted}`);
  if (result.ok && !result.readiness.local.ready) {
    console.log('[zavorth-up] local console ready in read-only mode; only mutable/remote items are missing.');
  }
  console.log(
    `[zavorth-up] launch: ${launchAttempted ? 'attempted' : 'not needed'} | attempts=${result.attempts} | duration=${result.durationMs}ms`,
  );
  console.log(
    `[zavorth-up] local: ${result.readiness.local.ready ? 'ready' : result.ok ? 'readonly' : 'pending'} | ${result.manifest.local.appUrl}`,
  );
  console.log(
    `[zavorth-up] remote: ${result.readiness.remote.ready ? 'ready' : 'pending'} | ${result.manifest.remote.appUrl || 'not configured'}`,
  );
  console.log(
    `[zavorth-up] auth: ${result.manifest.auth.required ? result.manifest.auth.source : 'absent'} | host approved: ${
      result.manifest.auth.authorizedHost === false ? 'no' : 'yes'
    }`,
  );
  if (launchSelection) {
    console.log(`[zavorth-up] open: ${launchSelection.url || 'not available'} | ${launchSelection.reason}`);
    if (launchResult?.attempted) {
      console.log(`[zavorth-up] launch: ${launchResult.ok ? 'ok' : 'failed'}${launchResult.error ? ` (${launchResult.error})` : ''}`);
    }
  }
  if (result.manifest.surfaces.length > 0) {
    console.log('[zavorth-up] entradas recomendadas:');
    for (const surface of result.manifest.surfaces.filter((entry) => entry.primary || entry.id === 'telegram' || entry.id === 'cli')) {
      console.log(
        `- ${surface.label}: ${surface.entry}${surface.remoteEntry ? ` | remote: ${surface.remoteEntry}` : ''}`,
      );
    }
  }

  if (result.readiness.nextSteps.length > 0) {
    console.log('[zavorth-up] next steps:');
    for (const step of result.readiness.nextSteps) {
      console.log(`- ${step.title}: ${step.description}`);
    }
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[zavorth-up] failure ao subir o runtime.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
