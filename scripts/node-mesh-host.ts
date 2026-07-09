#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import process from 'process';
import { NodeHostCapabilityService } from '../src/services/NodeHostCapabilityService.js';

export type NodeMeshHostOptions = {
  baseUrl: string;
  token: string | null;
  nodeId: string;
  pairingCode: string | null;
  sharedSecret: string | null;
  capabilities: string[];
  intervalMs: number;
  once: boolean;
  workspace: string | null;
  surface: string;
  hostname: string;
  label: string | null;
  deviceModel?: string | null;
  appVersion?: string | null;
  networkType?: string | null;
  locationLabel?: string | null;
  stateFile: string;
  abortSignal?: AbortSignal | null;
};

type NodeMeshHostRuntime = {
  apiPostImpl?: (baseUrl: string, endpoint: string, token: string | null, body: unknown) => Promise<any>;
  capabilityService?: NodeHostCapabilityService | null;
  sleep?: (ms: number) => Promise<void>;
};

type Assignment = {
  id: string;
  capabilityId: string;
  action: string;
  payload?: Record<string, unknown> | null;
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

function normalizeBaseUrl(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) {
    return '';
  }
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function normalizeNodeId(input: string): string {
  return String(input || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
}

export function parseOptions(argv: string[]): NodeMeshHostOptions {
  const baseUrl = normalizeBaseUrl(getOptionValue(argv, '--base-url') || 'http://127.0.0.1:33333');
  const nodeId = String(getOptionValue(argv, '--node-id') || '').trim();
  const pairingCode = String(getOptionValue(argv, '--pairing-code') || '').trim() || null;
  const sharedSecret = String(getOptionValue(argv, '--shared-secret') || '').trim() || null;
  const capabilities = String(getOptionValue(argv, '--capabilities') || 'system.run,node.maintenance')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!baseUrl) {
    throw new Error('Informe --base-url para o node host.');
  }
  if (!nodeId) {
    throw new Error('Informe --node-id para o node host.');
  }
  if (!pairingCode && !sharedSecret) {
    throw new Error('Informe --pairing-code ou --shared-secret para autenticar o node host.');
  }

  return {
    baseUrl,
    token: String(getOptionValue(argv, '--token') || '').trim() || null,
    nodeId,
    pairingCode,
    sharedSecret,
    capabilities,
    intervalMs: Math.max(3000, Number(getOptionValue(argv, '--interval-ms') || '15000') || 15000),
    once: hasFlag(argv, '--once'),
    workspace: String(getOptionValue(argv, '--workspace') || process.cwd()).trim() || null,
    surface: String(getOptionValue(argv, '--surface') || 'node-host').trim() || 'node-host',
    hostname: String(getOptionValue(argv, '--hostname') || os.hostname()).trim() || os.hostname(),
    label: String(getOptionValue(argv, '--label') || '').trim() || null,
    deviceModel: String(getOptionValue(argv, '--device-model') || '').trim() || null,
    appVersion: String(getOptionValue(argv, '--app-version') || '').trim() || null,
    networkType: String(getOptionValue(argv, '--network-type') || '').trim() || null,
    locationLabel: String(getOptionValue(argv, '--location-label') || '').trim() || null,
    stateFile: String(getOptionValue(argv, '--state-file') || '').trim()
      || path.resolve(process.cwd(), 'data', 'runtime', `node-host-${normalizeNodeId(nodeId)}.json`),
  };
}

function loadPendingResults(stateFile: string): Array<Record<string, unknown>> {
  try {
    if (!fs.existsSync(stateFile)) {
      return [];
    }
    const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return Array.isArray(parsed?.pendingResults) ? parsed.pendingResults : [];
  } catch {
    return [];
  }
}

function savePendingResults(stateFile: string, pendingResults: Array<Record<string, unknown>>): void {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify({ pendingResults }, null, 2)}\n`, 'utf8');
}

async function apiPost(baseUrl: string, endpoint: string, token: string | null, body: unknown): Promise<any> {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Falha HTTP ${response.status} ao chamar ${endpoint}.`);
  }
  return payload;
}

export async function runNodeMeshHost(
  options: NodeMeshHostOptions,
  runtime: NodeMeshHostRuntime = {},
): Promise<void> {
  const workspaceRoot = path.resolve(options.workspace || process.cwd());
  const tempRoot = path.resolve(workspaceRoot, 'data', 'runtime', 'node-host');
  const capabilityService = runtime.capabilityService || new NodeHostCapabilityService({
    workspaceRoot,
    tempRoot,
    stateFile: options.stateFile,
    allowedRoots: [workspaceRoot, tempRoot],
    env: {
      ...process.env,
      ...(options.deviceModel ? { ZAVORTH_NODE_HOST_DEVICE_MODEL: options.deviceModel } : {}),
      ...(options.appVersion ? { ZAVORTH_NODE_HOST_APP_VERSION: options.appVersion } : {}),
      ...(options.networkType ? { ZAVORTH_NODE_HOST_NETWORK_TYPE: options.networkType } : {}),
      ...(options.locationLabel ? { ZAVORTH_NODE_HOST_LOCATION_LABEL: options.locationLabel } : {}),
    },
  });
  const apiPostCall = runtime.apiPostImpl || apiPost;
  const sleep = runtime.sleep || (async (ms: number) => await new Promise((resolve) => setTimeout(resolve, ms)));
  let stopped = false;
  const abortListener = () => {
    stopped = true;
  };
  process.on('SIGINT', () => {
    stopped = true;
  });
  process.on('SIGTERM', () => {
    stopped = true;
  });
  options.abortSignal?.addEventListener('abort', abortListener);

  const hostHints = {
    hostname: options.hostname,
    platform: process.platform,
    workspace: options.workspace,
    surface: options.surface,
    arch: process.arch,
    osRelease: os.release(),
    nodeVersion: process.version,
    deviceModel: options.deviceModel,
    appVersion: options.appVersion,
    networkType: options.networkType,
    locationLabel: options.locationLabel,
  };

  let sharedSecret = options.sharedSecret;
  if (!sharedSecret) {
    const claimPayload = await apiPostCall(
      options.baseUrl,
      '/api/node-mesh/pairing/claim',
      options.token,
      {
        nodeId: options.nodeId,
        pairingCode: options.pairingCode,
        capabilityIds: options.capabilities,
        hostHints,
        operatorSummary: options.label
          ? `${options.label} autenticado e aguardando workload remoto.`
          : null,
      },
    );
    sharedSecret = String(claimPayload?.claim?.sharedSecret || '').trim() || null;
    if (!sharedSecret) {
      throw new Error('O claim nao retornou shared secret para este node host.');
    }
    console.log(`[node-mesh-host] claim concluido para ${options.nodeId}.`);
  }

  let pendingResults: Array<Record<string, unknown>> = loadPendingResults(options.stateFile);
  let cycles = 0;

  try {
    while (!stopped) {
      const heartbeatPayload = await apiPostCall(
        options.baseUrl,
        '/api/node-mesh/heartbeat',
        options.token,
        {
          nodeId: options.nodeId,
          sharedSecret,
          status: 'online',
          capabilityIds: options.capabilities,
          hostHints,
          results: pendingResults,
        },
      );
      pendingResults = [];
      savePendingResults(options.stateFile, pendingResults);
      const heartbeat = heartbeatPayload?.heartbeat || heartbeatPayload || {};
      const assignments = Array.isArray(heartbeat.assignments) ? heartbeat.assignments : [];

      if (assignments.length > 0) {
        console.log(`[node-mesh-host] ${assignments.length} atribuicao(oes) recebida(s) para ${options.nodeId}.`);
        for (const assignment of assignments) {
          const result = await capabilityService.executeAssignment(assignment as Assignment);
          pendingResults.push(result);
          savePendingResults(options.stateFile, pendingResults);
        }
        if (options.once) {
          await apiPostCall(
            options.baseUrl,
            '/api/node-mesh/heartbeat',
            options.token,
            {
              nodeId: options.nodeId,
              sharedSecret,
              status: 'online',
              capabilityIds: options.capabilities,
              hostHints,
              results: pendingResults,
            },
          );
          pendingResults = [];
          savePendingResults(options.stateFile, pendingResults);
          break;
        }
      } else if (options.once && cycles > 0) {
        break;
      }

      cycles += 1;
      await sleep(Number(heartbeat.heartbeatIntervalMs || options.intervalMs));
    }
  } finally {
    options.abortSignal?.removeEventListener('abort', abortListener);
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseOptions(argv);
  await runNodeMeshHost(options);
}

const executedAsScript =
  typeof require !== 'undefined'
  && typeof module !== 'undefined'
  && require.main === module;

if (executedAsScript) {
  main().catch((error: unknown) => {
    console.error(`[node-mesh-host] erro: ${error?.message || String(error)}`);
    process.exitCode = 1;
  });
}
