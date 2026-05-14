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

function runCommand(command, args, { capture = false } = {}) {
  const encoding = 'utf8';
  const normalizedCommand = String(command || '').trim().toLowerCase();
  const resolved = process.platform === 'win32' && npmCliPath
    ? normalizedCommand === 'npm' || normalizedCommand === 'npm.cmd'
      ? { command: nodeRunner, args: [npmCliPath, ...args] }
      : normalizedCommand === 'npx' || normalizedCommand === 'npx.cmd'
        ? { command: nodeRunner, args: [npmCliPath, 'exec', '--', ...args] }
        : { command, args }
    : { command, args };
  const result = spawnSync(resolved.command, resolved.args, { cwd: projectRoot, encoding });

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
    const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    throw new Error(output || `exit ${String(result.status)}`);
  }
  return result;
}

function runStep(label, command, args, options = {}) {
  console.log(`\n[phases-7-10-check] ${label}`);
  const result = runCommand(command, args, options);
  if (options.capture) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
  }
  return result;
}

function parseJsonFromOutput(stdout) {
  const text = String(stdout || '').trim();
  const firstBrace = text.indexOf('{');
  if (firstBrace < 0) {
    throw new Error('Nao encontrei payload JSON na saida capturada.');
  }
  return JSON.parse(text.slice(firstBrace));
}

function assertFile(relativePath) {
  const absolutePath = path.resolve(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Artefato esperado ausente: ${relativePath}`);
  }
}

function checkArtifacts() {
  const required = [
    'docs/product/quickstart-developer.md',
    'docs/product/quickstart-operator.md',
    'docs/product/troubleshooting-guiado.md',
    'docs/50-wave-9-ecosystem-sdk.md',
    'docs/51-wave-10-distributed-runtime.md',
    'docs/protocol/rest-v1.md',
    'docs/protocol/websocket-v1.md',
    'docs/protocol/sdk-usage.md',
    'docs/platform/integrar-client.md',
    'docs/platform/registrar-node.md',
    'docs/platform/publicar-plugin.md',
    'docs/platform/usar-recipe.md',
    'examples/clients/simple-bot.ts',
    'examples/nodes/headless-node.ts',
    'examples/extensions/hello-ecosystem/plugin.json',
    'examples/extensions/hello-ecosystem/index.js',
    'deploy/docker-compose.prod.yml',
    'deploy/production.Dockerfile',
    'deploy/README.md',
    'ops/recovery/DisasterRecoveryPlan.md',
    'ops/production/host-hardening.sh',
    'scripts/sandbox-doctor.sh',
    'scripts/gvisor-wsl-bootstrap.ps1',
    'scripts/firecracker-host-bootstrap.sh',
    'scripts/firecracker-smoke.sh',
  ];
  for (const relativePath of required) {
    assertFile(relativePath);
  }
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const powershellCommand = process.platform === 'win32' ? 'powershell' : 'pwsh';

console.log('\n[phases-7-10-check] Artefatos de produto, protocolo e producao presentes');
checkArtifacts();

runStep('Fase 7 - Gateway smoke', npmCommand, ['run', 'qa:gateway:smoke']);
runStep('Fase 7 - Benchmark de boot', npmCommand, ['run', 'qa:bench:boot']);
runStep('Fase 7 - Benchmark de runtime', npmCommand, ['run', 'qa:bench:runtime']);
runStep('Fase 7 - Benchmark de sidecars', npmCommand, ['run', 'qa:bench:sidecars']);
runStep('Fase 7 - Reliability compat', npmCommand, ['run', 'qa:compat']);
runStep('Fase 7 - Regressao critica', npmCommand, ['run', 'qa:regression']);

runStep('Fases 8 a 10 - Testes dedicados', npxCommand, [
  'jest',
  'tests/apps/OnboardingCliGuide.test.ts',
  'tests/sdk/ZavorthTypeScriptSdk.test.ts',
  'tests/platform/PlatformPublishSample.test.ts',
  'tests/services/ZavorthEcosystemControlPlaneService.test.ts',
  'tests/ops/DatabaseBackupJob.test.ts',
  'tests/ops/DatabaseRestoreJob.test.ts',
  'tests/ops/ProductionHardeningValidator.test.ts',
  '--runInBand',
]);

runStep('Fase 8 - Onboarding dev', npmCommand, ['run', 'onboarding:start', '--', '--profile', 'dev']);
runStep('Fase 8 - Onboarding operator', npmCommand, ['run', 'onboarding:start', '--', '--profile', 'operator']);
runStep('Fase 8 - Install profile dev', powershellCommand, [
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  path.resolve(projectRoot, 'install', 'install.ps1'),
  '-Profile',
  'Dev',
  '-SkipDependencies',
  '-SkipBuild',
]);
runStep('Fase 8 - Install profile operator', powershellCommand, [
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  path.resolve(projectRoot, 'install', 'install.ps1'),
  '-Profile',
  'Operator',
  '-SkipDependencies',
  '-SkipBuild',
]);
runStep('Fase 8 - Companion package', npmCommand, [
  'run',
  'companion:package',
  '--',
  '--output',
  'tmp\\qa-companion-bundle',
]);

runStep('Fase 9 - SDK check', npmCommand, ['run', 'sdk:check']);
runStep('Fase 9 - Publish sample preparado', npmCommand, ['run', 'platform:publish:sample']);
runStep('Fase 9 - Ecosystem control plane', npmCommand, ['run', 'ops:ecosystem']);
runStep('Fase 10 - Runtime distribuido', npmCommand, ['run', 'ops:distributed']);

const backupResult = runStep('Fase 10 - Backup operacional', npmCommand, ['run', 'ops:backup', '--', '--json'], {
  capture: true,
});
const backupPayload = parseJsonFromOutput(backupResult.stdout);
const relativeManifest = path.relative(projectRoot, backupPayload.manifestPath).replace(/\\/g, '/');

runStep('Fase 10 - Restore dry-run', npmCommand, [
  'run',
  'ops:restore',
  '--',
  `--manifest=${relativeManifest}`,
  '--dry-run',
  '--json',
]);
runStep('Fase 10 - Production hardening check', npmCommand, ['run', 'ops:production:check', '--', '--json']);

console.log('\n[phases-7-10-check] As fases 7 a 10 passaram na validacao oficial.');
