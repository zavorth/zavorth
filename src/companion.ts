import os from 'os';
import process from 'process';
import path from 'path';
import { CompanionBootstrapper } from './nodes/companion/CompanionBootstrapper.js';
import { NodePairingManager } from './nodes/pairing/NodePairingManager.js';

export type CompanionCliOptions = {
  passcode: string | null;
  once: boolean;
  baseUrl: string;
  token: string | null;
  nodeId: string | null;
  label: string | null;
  workspace: string;
  stateFile: string | null;
  surface: string;
  deviceModel: string | null;
  appVersion: string | null;
  networkType: string | null;
  locationLabel: string | null;
  intervalMs: number;
  capabilities: string[];
};

function getOptionValue(argv: string[], name: string): string | null {
  const prefix = `${name}=`;
  const direct = argv.find((entry) => entry.startsWith(prefix));
  if (direct) {
    return direct.slice(prefix.length);
  }
  const index = argv.findIndex((entry) => entry === name);
  if (index >= 0) {
    return argv[index + 1] || null;
  }
  return null;
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

function normalizeBaseUrl(input: string | null | undefined): string {
  const raw = String(input || '').trim();
  if (!raw) {
    return 'http://127.0.0.1:33333';
  }
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function normalizeNodeId(input: string | null | undefined): string | null {
  const normalized = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || null;
}

export function parseCompanionArgs(argv: string[]): CompanionCliOptions {
  const positional = argv.filter((entry) => !entry.startsWith('--'));
  const passcode = String(getOptionValue(argv, '--passcode') || positional[0] || '').trim() || null;
  const workspace = path.resolve(String(getOptionValue(argv, '--workspace') || process.cwd()).trim() || process.cwd());
  return {
    passcode,
    once: hasFlag(argv, '--once'),
    baseUrl: normalizeBaseUrl(getOptionValue(argv, '--base-url') || process.env.ZAVORTH_NODE_MESH_BASE_URL || ''),
    token: String(getOptionValue(argv, '--token') || process.env.ZAVORTH_NODE_MESH_TOKEN || '').trim() || null,
    nodeId: normalizeNodeId(getOptionValue(argv, '--node-id') || process.env.ZAVORTH_NODE_ID || `desktop-${os.hostname()}`),
    label: String(getOptionValue(argv, '--label') || process.env.ZAVORTH_NODE_LABEL || '').trim() || null,
    workspace,
    stateFile: String(getOptionValue(argv, '--state-file') || '').trim() || null,
    surface: String(getOptionValue(argv, '--surface') || process.env.ZAVORTH_NODE_SURFACE || 'desktop-companion').trim() || 'desktop-companion',
    deviceModel: String(getOptionValue(argv, '--device-model') || process.env.ZAVORTH_NODE_HOST_DEVICE_MODEL || '').trim() || null,
    appVersion: String(getOptionValue(argv, '--app-version') || process.env.ZAVORTH_NODE_HOST_APP_VERSION || '').trim() || null,
    networkType: String(getOptionValue(argv, '--network-type') || process.env.ZAVORTH_NODE_HOST_NETWORK_TYPE || '').trim() || null,
    locationLabel: String(getOptionValue(argv, '--location-label') || process.env.ZAVORTH_NODE_HOST_LOCATION_LABEL || '').trim() || null,
    intervalMs: Math.max(3000, Number(getOptionValue(argv, '--interval-ms') || process.env.ZAVORTH_NODE_HEARTBEAT_INTERVAL_MS || '15000') || 15000),
    capabilities: String(getOptionValue(argv, '--capabilities') || process.env.ZAVORTH_NODE_CAPABILITIES || 'device.info,system.run,files.read,files.write,files.watch,browser.proxy,clipboard.read,clipboard.write,notifications.send,screen.capture')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  };
}

export async function runCompanionCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  const options = parseCompanionArgs(argv);
  const pairingManager = new NodePairingManager({
    baseUrl: options.baseUrl,
    token: options.token,
    nodeId: options.nodeId,
    label: options.label,
    capabilityIds: options.capabilities,
    workspace: options.workspace,
    surface: options.surface,
    stateFile: options.stateFile || undefined,
  });
  const bootstrapper = new CompanionBootstrapper({
    pairingManager,
    once: options.once,
    workspaceRoot: options.workspace,
    stateFile: options.stateFile || undefined,
    capabilities: options.capabilities,
    intervalMs: options.intervalMs,
    token: options.token,
    surface: options.surface,
    hostname: os.hostname(),
    deviceModel: options.deviceModel || options.label,
    appVersion: options.appVersion,
    networkType: options.networkType,
    locationLabel: options.locationLabel,
  });

  const stop = async () => {
    await bootstrapper.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => {
    void stop();
  });
  process.on('SIGTERM', () => {
    void stop();
  });

  try {
    await bootstrapper.startCompanion(options.passcode || undefined);
    if (options.once) {
      return 0;
    }
    return await new Promise<number>((resolve, reject) => {
      process.once('SIGINT', () => resolve(0));
      process.once('SIGTERM', () => resolve(0));
      process.once('uncaughtException', (error) => reject(error));
    });
  } catch (error: any) {
    console.error('[Companion] Falha ao iniciar o Zavorth Desktop Companion:', error?.message || error);
    return 1;
  }
}

const invokedAsCompanionScript = (() => {
  const entry = path.resolve(process.argv[1] || '');
  return entry.endsWith(`${path.sep}companion.js`) || entry.endsWith(`${path.sep}companion.ts`);
})();

if (invokedAsCompanionScript) {
  runCompanionCli().then((code) => {
    process.exitCode = code;
  });
}
