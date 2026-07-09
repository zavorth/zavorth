import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import { config } from '../config/index.js';
import { sanitizeWindowsEnv } from './HostEnvironment.js';
export type ExternalLauncherReloadInput = {
  reason: string;
  requestedBy: string;
  notifyChatId?: string;
  forceRestart?: boolean;
  autoRepair?: boolean;
  autoRepairReason?: string;
};

export type ExternalLauncherReloadDeps = {
  spawnImpl: typeof spawn;
  processRef: NodeJS.Process;
  projectRoot: string;
  powershellExecutablePath: string;
  supervisedReloadRequestScriptPath: string;
};

export function startExternalLauncherReload(
  input: ExternalLauncherReloadInput,
  deps: ExternalLauncherReloadDeps,
): { accepted: boolean; summary: string } {
  const usingDedicatedAutoRepairScript =
    input.autoRepair && fs.existsSync(config.supervisedAutoRepairRequestScriptPath);
  const requestScriptPath =
    usingDedicatedAutoRepairScript
      ? config.supervisedAutoRepairRequestScriptPath
      : deps.supervisedReloadRequestScriptPath;
  if (!fs.existsSync(requestScriptPath)) {
    return {
      accepted: false,
      summary: `Nao encontrei o script de handoff supervisionado em ${requestScriptPath}.`,
    };
  }

  const powershellPath = deps.powershellExecutablePath;
  if (!powershellPath || !fs.existsSync(powershellPath)) {
    return {
      accepted: false,
      summary: 'PowerShell do Windows nao esta disponivel para assumir o handoff supervisionado.',
    };
  }

  try {
    const args = [
      '-NoLogo',
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      requestScriptPath,
      '-WaitForPid',
      String(deps.processRef.pid || process.pid),
      '-Reason',
      String(input.reason || '').trim() || 'Reload supervisionado solicitado pelo host.',
      '-RequestedBy',
      String(input.requestedBy || '').trim() || 'unknown',
    ];

    if (input.notifyChatId) {
      args.push('-NotifyChatId', input.notifyChatId);
    }

    if (input.forceRestart) {
      args.push('-ForceRestart');
    }

    if (input.autoRepair && !usingDedicatedAutoRepairScript) {
      args.push('-AutoRepair');
    }

    if (input.autoRepairReason) {
      args.push('-AutoRepairReason', input.autoRepairReason);
    }

    const child = deps.spawnImpl(powershellPath, args, {
      cwd: deps.projectRoot,
      env: sanitizeWindowsEnv(deps.processRef.env),
      stdio: 'ignore',
      windowsHide: true,
      detached: true,
    }) as ChildProcess;
    child.unref();

    return {
      accepted: true,
      summary: 'Launcher supervisionado externo preparado com sucesso.',
    };
  } catch (error: unknown) {
    return {
      accepted: false,
      summary: error?.message || String(error),
    };
  }
}
