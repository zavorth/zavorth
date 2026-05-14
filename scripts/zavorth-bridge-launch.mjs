import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function quoteWindowsArg(value) {
  const normalized = String(value ?? '');
  if (!normalized) {
    return '""';
  }

  if (!/[\s"&()<>^|%!]/.test(normalized)) {
    return normalized;
  }

  const escaped = normalized.replace(/(["^&|<>()%!])/g, '^$1');
  return `"${escaped}"`;
}

function isPathLike(value) {
  return /^[A-Za-z]:/.test(value) || value.includes('/') || value.includes('\\');
}

function normalizeWindowFlag(rawValue) {
  const normalized = String(rawValue || 'reuse-window').trim().toLowerCase();
  return normalized === 'new-window' || normalized === '--new-window' || normalized === '-n'
    ? '--new-window'
    : '--reuse-window';
}

export function getProjectRoot() {
  return path.resolve(__dirname, '..');
}

export function loadProjectEnv(projectRoot = getProjectRoot()) {
  dotenv.config({ path: path.join(projectRoot, '.env') });
  return projectRoot;
}

export function resolveZavorthBridgeLaunchConfig(projectRoot = getProjectRoot()) {
  loadProjectEnv(projectRoot);

  return {
    projectRoot,
    command:
      process.env.ZAVORTH_BRIDGE_CLI_PATH ||
      path.join(
        process.env.LOCALAPPDATA || 'C:\\Users\\ermys\\AppData\\Local',
        'Programs',
        'ZavorthBridge',
        'bin',
        'zavorthBridge.cmd',
      ),
    workspace:
      process.env.ZAVORTH_BRIDGE_START_WORKSPACE ||
      process.env.DEFAULT_WORKSPACE ||
      projectRoot,
    profileName: process.env.ZAVORTH_BRIDGE_PROFILE_NAME || 'zavorth-model-test',
    windowFlag: normalizeWindowFlag(process.env.ZAVORTH_BRIDGE_WINDOW_STRATEGY || 'reuse-window'),
    remoteDebuggingPort: Number.parseInt(process.env.ZAVORTH_BRIDGE_REMOTE_DEBUGGING_PORT || '7800', 10) || 7800,
    zavorthStartDelayMs: Number.parseInt(process.env.ZAVORTH_BRIDGE_START_DELAY_MS || '4000', 10) || 4000,
    remoteBaseUrl: process.env.ZAVORTH_BRIDGE_REMOTE_BASE_URL || 'http://127.0.0.1:4747',
  };
}

export function buildZavorthBridgeArgs(config) {
  const args = [];

  if (config.profileName) {
    args.push('--profile', config.profileName);
  }

  args.push(config.windowFlag);
  args.push(config.workspace);
  args.push(`--remote-debugging-port=${config.remoteDebuggingPort}`);

  return args;
}

export function launchZavorthBridgeDetached(config) {
  if (isPathLike(config.command) && !fs.existsSync(config.command)) {
    throw new Error(`Nao encontrei o executavel do ZavorthBridge em ${config.command}.`);
  }

  if (!fs.existsSync(config.workspace)) {
    throw new Error(`A workspace configurada para abrir no ZavorthBridge nao existe: ${config.workspace}.`);
  }

  const args = buildZavorthBridgeArgs(config);

  const child =
    process.platform === 'win32'
      ? spawn(
          process.env.ComSpec || 'cmd.exe',
          ['/d', '/s', '/c', [config.command, ...args].map(quoteWindowsArg).join(' ')],
          {
            cwd: config.workspace,
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
            env: process.env,
            shell: false,
          },
        )
      : spawn(config.command, args, {
          cwd: config.workspace,
          detached: true,
          stdio: 'ignore',
          env: process.env,
          shell: false,
        });

  child.unref();

  return {
    pid: child.pid ?? null,
    args,
  };
}

export function formatZavorthBridgeLaunchSummary(config, args, pid = null) {
  const lines = [
    'ZavorthBridge launch',
    '',
    `CLI: ${config.command}`,
    `Workspace: ${config.workspace}`,
    `Perfil: ${config.profileName || '(sem perfil)'}`,
    `Janela: ${config.windowFlag}`,
    `CDP: http://127.0.0.1:${config.remoteDebuggingPort}`,
    `Remoto Zavorth: ${config.remoteBaseUrl}`,
    `Comando: ${[config.command, ...args].join(' ')}`,
  ];

  if (pid) {
    lines.push(`PID: ${pid}`);
  }

  return lines.join(os.EOL);
}
