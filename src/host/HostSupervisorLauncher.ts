import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import { config } from '../config/index.js';
import { sanitizeWindowsEnv } from './HostEnvironment.js';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';
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
      summary: `Could not find the supervised handoff script at ${requestScriptPath}.`,
    };
  }

  const powershellPath = deps.powershellExecutablePath;
  if (!powershellPath || !fs.existsSync(powershellPath)) {
    return {
      accepted: false,
      summary: 'Windows PowerShell is not available to take the supervised handoff.',
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
      String(input.reason || '').trim() || 'Supervised reload requested by the host.',
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
      summary: 'External supervised launcher prepared successfully.',
    };
  } catch (error: unknown) {
    asErrorLike(error);
    return {
      accepted: false,
      summary: errorMessage(error),
    };
  }
}
