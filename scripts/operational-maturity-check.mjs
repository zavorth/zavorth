#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const matrixPath = path.join(root, 'config', 'operational-maturity.json');
const packagePath = path.join(root, 'package.json');
const docsToCheck = [
  'docs/architecture.md',
];
const allowedCliCommands = new Set([
  'ai-first',
  'browser',
  'budget',
  'capability',
  'chat',
  'core',
  'doctor',
  'echo',
  'go',
  'help',
  'mode',
  'onboard',
  'serve',
  'setup',
  'sidecar',
  'start',
  'ui',
  'voice',
  'voz',
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function collectDocText() {
  return docsToCheck
    .map((relativePath) => ({
      relativePath,
      text: fs.existsSync(path.join(root, relativePath))
        ? fs.readFileSync(path.join(root, relativePath), 'utf8')
        : '',
    }));
}

function unique(values) {
  return Array.from(new Set(values));
}

function extractMatches(text, regex) {
  const values = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    values.push(match[1]);
  }
  return values;
}

function statusCounts(capabilities) {
  const counts = {
    stable: 0,
    'official-but-provisioned': 0,
    experimental: 0,
    draft: 0,
    deprecated: 0,
  };
  for (const capability of capabilities) {
    counts[capability.status] = (counts[capability.status] || 0) + 1;
  }
  return counts;
}

function main() {
  const matrix = readJson(matrixPath);
  const pkg = readJson(packagePath);
  const scripts = pkg.scripts || {};
  const issues = [];
  const allowedStatuses = new Set(matrix.statuses || []);
  const seenIds = new Set();

  if (matrix.schemaVersion !== 'operational-maturity.v1') {
    issues.push(`schemaVersion invalido: ${matrix.schemaVersion}`);
  }

  for (const status of ['stable', 'official-but-provisioned', 'experimental', 'draft', 'deprecated']) {
    if (!allowedStatuses.has(status)) {
      issues.push(`status canonico ausente da matriz: ${status}`);
    }
  }

  for (const capability of matrix.capabilities || []) {
    if (seenIds.has(capability.id)) {
      issues.push(`capability duplicada: ${capability.id}`);
    }
    seenIds.add(capability.id);

    if (!allowedStatuses.has(capability.status)) {
      issues.push(`${capability.id}: status invalido ${capability.status}`);
    }

    for (const evidence of capability.evidence || []) {
      if (!exists(evidence)) {
        issues.push(`${capability.id}: evidencia ausente ${evidence}`);
      }
    }

    for (const command of capability.commands || []) {
      if (command.kind === 'npm-script' && !scripts[command.value]) {
        issues.push(`${capability.id}: npm script inexistente ${command.value}`);
      }
      if (command.kind === 'cli') {
        const parts = String(command.value || '').trim().split(/\s+/g);
        if (parts[0] !== 'zavorth' || !allowedCliCommands.has(parts[1])) {
          issues.push(`${capability.id}: comando CLI nao canonico ${command.value}`);
        }
      }
    }

    if ((capability.id === 'nexus-surface' || capability.id === 'echo-edge-layer')
      && (capability.isPrimaryBrain || capability.isParallelRuntime)) {
      issues.push(`${capability.id}: nao pode ser cerebro principal nem runtime paralelo`);
    }
  }

  for (const requiredId of [
    'browser-mcp',
    'local-voice-dictation',
    'swarm-executor',
    'session-v2-pty',
    'session-recorder-dvr',
    'nexus-surface',
    'echo-edge-layer',
  ]) {
    if (!seenIds.has(requiredId)) {
      issues.push(`capability obrigatoria ausente: ${requiredId}`);
    }
  }

  const docs = collectDocText();
  for (const doc of docs) {
    if (!doc.text) {
      issues.push(`documento ausente: ${doc.relativePath}`);
      continue;
    }

    const npmScripts = unique(extractMatches(doc.text, /npm run ([a-zA-Z0-9:_-]+)/g));
    for (const scriptName of npmScripts) {
      if (!scripts[scriptName]) {
        issues.push(`${doc.relativePath}: cita npm script inexistente ${scriptName}`);
      }
    }

    const cliCommands = unique(extractMatches(doc.text, /(?:^|`|\n)(zavorth\s+([a-zA-Z0-9:_-]+))/g).map((value) => value.split(/\s+/g)[1]));
    for (const command of cliCommands) {
      if (!allowedCliCommands.has(command)) {
        issues.push(`${doc.relativePath}: cita comando CLI nao canonico zavorth ${command}`);
      }
    }
  }

  const architectureDoc = fs.readFileSync(path.join(root, 'docs', 'architecture.md'), 'utf8');
  for (const capability of matrix.capabilities || []) {
    if (!architectureDoc.includes(`\`${capability.id}\``)) {
      issues.push(`docs/architecture.md nao referencia capability canonica ${capability.id}`);
    }
  }
  if (!architectureDoc.includes('Nexus nao e runtime paralelo')) {
    issues.push('docs/architecture.md precisa declarar que Nexus nao e runtime paralelo');
  }
  if (!architectureDoc.includes('Intelligence Fabric')) {
    issues.push('docs/architecture.md precisa apontar o cerebro real para o Intelligence Fabric');
  }
  if (architectureDoc.toLowerCase().includes('nexus e o cerebro')) {
    issues.push('docs/architecture.md contem claim proibido: Nexus e o cerebro');
  }
  if (architectureDoc.toLowerCase().includes('echo e o cerebro principal')) {
    issues.push('docs/architecture.md contem claim proibido: Echo e o cerebro principal');
  }

  const serviceSource = fs.readFileSync(
    path.join(root, 'src', 'domain', 'platform-ecosystem', 'application', 'OperationalMaturityService.ts'),
    'utf8',
  );
  if (!serviceSource.includes('buildSnapshot') || !serviceSource.includes('renderConsole')) {
    issues.push('OperationalMaturityService precisa expor buildSnapshot e renderConsole');
  }

  const coreRouteSource = fs.readFileSync(path.join(root, 'src', 'services', 'DashboardCoreRouteService.ts'), 'utf8');
  if (!coreRouteSource.includes('/api/v2/maturity/snapshot')) {
    issues.push('DashboardCoreRouteService precisa expor /api/v2/maturity/snapshot');
  }

  const counts = statusCounts(matrix.capabilities || []);
  const payload = {
    ok: issues.length === 0,
    schemaVersion: matrix.schemaVersion,
    total: (matrix.capabilities || []).length,
    counts,
    issues,
  };

  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write([
      '[operational-maturity] checking truth gate',
      `[operational-maturity] capabilities: ${payload.total} | stable ${counts.stable} | provisioned ${counts['official-but-provisioned']} | experimental ${counts.experimental}`,
      issues.length
        ? issues.map((issue) => `[operational-maturity] error ${issue}`).join('\n')
        : '[operational-maturity] ok maturity matrix, docs, scripts and API route are consistent',
    ].join('\n') + '\n');
  }

  process.exit(issues.length ? 1 : 0);
}

main();
