#!/usr/bin/env node

import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { describeExternalSurfaceRoots } from './lib/external-surface-roots.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const externalRoots = describeExternalSurfaceRoots();
const runtimeDir = path.join(projectRoot, 'data', 'runtime');
const reportPath = path.join(runtimeDir, 'essential-trim-last.json');
const args = new Set(process.argv.slice(2));
const dryRun = !args.has('--apply');

const targets = [
  {
    id: 'ai-gateway-node-modules',
    label: 'AI Gateway node_modules',
    relativePath: path.join('src', 'ai-gateway', 'node_modules'),
    guard: 'ai-gateway',
  },
  {
    id: 'ai-gateway-next-cache',
    label: 'AI Gateway .next',
    relativePath: path.join('src', 'ai-gateway', '.next'),
    guard: 'ai-gateway',
  },
  {
    id: 'ai-gateway-logs',
    label: 'AI Gateway logs',
    relativePath: path.join('src', 'ai-gateway', 'logs'),
    guard: 'ai-gateway',
  },
  {
    id: 'zavorth-terminal-node-modules',
    label: 'Zavorth Terminal node_modules',
    relativePath: path.join('apps', 'zavorth-terminal', 'node_modules'),
    guard: 'zavorth-terminal',
  },
  {
    id: 'site-build',
    label: 'Docs site build',
    relativePath: path.relative(projectRoot, path.join(externalRoots.docsRoot, 'build')),
    absolutePath: path.join(externalRoots.docsRoot, 'build'),
    guard: null,
  },
  {
    id: 'site-docusaurus-cache',
    label: 'Docs .docusaurus',
    relativePath: path.relative(projectRoot, path.join(externalRoots.docsRoot, '.docusaurus')),
    absolutePath: path.join(externalRoots.docsRoot, '.docusaurus'),
    guard: null,
  },
  {
    id: 'remote-dist',
    label: 'Remote dist artifacts',
    relativePath: 'remote-dist',
    guard: null,
  },
];

function readSidecarSnapshot(relativeFile) {
  const absolute = path.join(projectRoot, relativeFile);
  try {
    if (!fs.existsSync(absolute)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== 'ESRCH';
  }
}

function readPortFromUrl(baseUrl, fallbackPort) {
  try {
    const parsed = new URL(baseUrl);
    const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;
    return Number.isFinite(port) && port > 0 ? port : fallbackPort;
  } catch {
    return fallbackPort;
  }
}

function isPortListening(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    let settled = false;

    const finalize = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(1200);
    socket.once('connect', () => finalize(true));
    socket.once('timeout', () => finalize(false));
    socket.once('error', () => finalize(false));
  });
}

async function readGuards() {
  const aiGateway = readSidecarSnapshot(path.join('data', 'runtime', 'ai-gateway-sidecar.json'));
  const zavorthTerminal = readSidecarSnapshot(
    path.join('data', 'runtime', 'zavorth-terminal-sidecar.json'),
  );

  const aiGatewayLive =
    Boolean(aiGateway?.pid && isProcessAlive(Number(aiGateway.pid))) ||
    (await isPortListening(readPortFromUrl(aiGateway?.baseUrl || 'http://127.0.0.1:20128/v1', 20128)));
  const zavorthTerminalLive =
    Boolean(
      zavorthTerminal?.pid && isProcessAlive(Number(zavorthTerminal.pid)),
    ) ||
    (await isPortListening(
      readPortFromUrl(zavorthTerminal?.baseUrl || 'http://127.0.0.1:4747', 4747),
    ));

  return {
    'ai-gateway': aiGatewayLive,
    'zavorth-terminal': zavorthTerminalLive,
  };
}

function getEntrySize(absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    return 0;
  }

  const stats = fs.lstatSync(absolutePath);
  if (!stats.isDirectory()) {
    return stats.size;
  }

  let total = 0;
  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    total += getEntrySize(path.join(absolutePath, entry.name));
  }
  return total;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function ensureRuntimeDir() {
  fs.mkdirSync(runtimeDir, { recursive: true });
}

async function main() {
  const guardStatus = await readGuards();
  const report = {
    generatedAt: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'apply',
    totalReclaimableBytes: 0,
    totalRemovedBytes: 0,
    targets: [],
  };

  console.log('===========================================');
  console.log('  Zavorth Essential Trim');
  console.log('===========================================');
  console.log(dryRun ? 'Modo: simulacao (--dry-run implícito)' : 'Modo: aplicar limpeza segura');
  console.log('');

  for (const target of targets) {
    const absolutePath = target.absolutePath || path.join(projectRoot, target.relativePath);
    const exists = fs.existsSync(absolutePath);
    const sizeBytes = exists ? getEntrySize(absolutePath) : 0;
    const guarded = target.guard ? guardStatus[target.guard] : false;

    const entry = {
      id: target.id,
      label: target.label,
      relativePath: target.relativePath,
      exists,
      guarded,
      reclaimedBytes: 0,
      sizeBytes,
      action: 'kept',
      note: '',
    };

    if (!exists) {
      entry.note = 'Nao encontrado.';
      report.targets.push(entry);
      continue;
    }

    report.totalReclaimableBytes += sizeBytes;

    if (guarded) {
      entry.note = 'Pulado porque o sidecar correspondente esta em execucao.';
      entry.action = 'skipped-live';
      report.targets.push(entry);
      continue;
    }

    if (dryRun) {
      entry.note = 'Rebuildavel e elegivel para limpeza.';
      entry.action = 'would-remove';
      entry.reclaimedBytes = sizeBytes;
      report.targets.push(entry);
      continue;
    }

    fs.rmSync(absolutePath, { recursive: true, force: true });
    entry.note = 'Removido com seguranca; pode ser recriado pelo Zavorth.';
    entry.action = 'removed';
    entry.reclaimedBytes = sizeBytes;
    report.totalRemovedBytes += sizeBytes;
    report.targets.push(entry);
  }

  ensureRuntimeDir();
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  for (const entry of report.targets) {
    const verb =
      entry.action === 'removed'
        ? 'REMOVEU'
        : entry.action === 'would-remove'
          ? 'REMOVERIA'
          : entry.action === 'skipped-live'
            ? 'PULOU'
            : 'MANTEVE';
    console.log(
      `${verb.padEnd(9, ' ')} ${entry.label} (${entry.relativePath}) - ${formatBytes(entry.sizeBytes)}. ${entry.note}`,
    );
  }

  console.log('');
  console.log(`Reclaimable total: ${formatBytes(report.totalReclaimableBytes)}`);
  console.log(`Removed total:     ${formatBytes(report.totalRemovedBytes)}`);
  console.log(`Report:            ${reportPath}`);
}

await main();
