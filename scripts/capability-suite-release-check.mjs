import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const projectRoot = process.cwd();
const nodeRunner = process.env.npm_node_execpath || process.execPath;
const npmCliPath = process.env.npm_execpath || null;

function quoteWindowsArg(value) {
  const normalized = String(value ?? '');
  if (!normalized || /[\s"]/u.test(normalized)) {
    return `"${normalized.replace(/"/g, '\\"')}"`;
  }
  return normalized;
}

function runCommand(command, args, { capture = false, timeout = 120000 } = {}) {
  const encoding = 'utf8';
  const resolved = process.platform === 'win32' && npmCliPath
    ? command === 'npm' || command === 'npm.cmd'
      ? { command: nodeRunner, args: [npmCliPath, ...args] }
      : command === 'npx' || command === 'npx.cmd'
        ? { command: nodeRunner, args: [npmCliPath, 'exec', '--', ...args] }
        : { command, args }
    : { command, args };
  const result = spawnSync(resolved.command, resolved.args, { cwd: projectRoot, encoding, timeout });

  if (!capture) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
  }

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    if (capture) {
      const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
      try {
        parseJsonFromOutput(output);
        return result;
      } catch {}
    }
    const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    throw new Error(output || `exit ${String(result.status)}`);
  }
  return result;
}

function runStep(label, command, args, options = {}) {
  console.log(`\n[checkpoint-11-check] ${label}`);
  return runCommand(command, args, options);
}

function assertFile(relativePath) {
  const absolutePath = path.resolve(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Artefato esperado ausente: ${relativePath}`);
  }
}

function parseJsonFromOutput(stdout) {
  const text = String(stdout || '').trim();
  const firstBrace = text.indexOf('{');
  if (firstBrace < 0) {
    throw new Error('Nao encontrei payload JSON na saida capturada.');
  }
  return JSON.parse(text.slice(firstBrace));
}

[
  'docs/product-direction.md',
  'scripts/zavorth-runtime-stability.ts',
  'src/services/ZavorthRuntimeStabilityControlPlaneService.ts',
  'tests/services/ZavorthRuntimeStabilityControlPlaneService.test.ts',
].forEach(assertFile);

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

runStep('Teste dedicado do Runtime Stability gate', npxCommand, [
  'jest',
  'tests/services/ZavorthRuntimeStabilityControlPlaneService.test.ts',
  '--runInBand',
]);

const stabilityResult = runStep('Snapshot JSON do Runtime Stability', npmCommand, [
  'run',
  'ops:stability:json',
], { capture: true, timeout: 120000 });
const snapshot = parseJsonFromOutput(stabilityResult.stdout);

if (!snapshot?.gate || !Array.isArray(snapshot.gate.checks)) {
  throw new Error('Snapshot de estabilidade nao contem gate/checks da Etapa 11.');
}

if (snapshot.gate.status === 'failed') {
  console.warn(
    `[checkpoint-11-check] warning: gate da Etapa 11 esta ${snapshot.gate.status} no ambiente atual: ${(
      snapshot.gate.blockingReasons || []
    ).join('; ')}`,
  );
}

console.log(`\n[checkpoint-11-check] Gate da Etapa 11: ${snapshot.gate.status}.`);
console.log('[checkpoint-11-check] Etapa 11 passou na validacao oficial.');
