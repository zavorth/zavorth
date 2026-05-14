import fs from 'fs';
import path from 'path';
import { config } from '../src/config/index.js';
import { execCommandSync } from '../src/core/CommandSpawn.js';
import { SandboxExecutionService } from '../src/services/SandboxExecutionService.js';
import type { SandboxLanguage } from '../src/services/sandbox/ISandboxRuntime.js';

const shouldPull = process.argv.includes('--pull');
const shouldRequire = process.argv.includes('--require');
const languages: SandboxLanguage[] = ['shell', 'javascript', 'python'];
const reportFile = process.env.ZAVORTH_SIDECAR_DOCKER_BOOTSTRAP_REPORT_FILE
  || path.resolve(config.projectRoot, 'data', 'runtime', 'sidecar-docker-bootstrap-last.json');
const sandbox = new SandboxExecutionService();

function pullImage(image: string): { ok: boolean; detail: string } {
  try {
    execCommandSync(config.dockerCliPath, ['pull', image], {
      encoding: 'utf8',
      timeout: config.dockerSandboxPullTimeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, detail: `Imagem ${image} baixada/atualizada.` };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

const dockerBefore = languages.map((language) => sandbox.getDockerStatus(language));
const pulls = shouldPull
  ? dockerBefore.map((status) => ({
      language: status.language,
      image: status.image,
      ...pullImage(status.image),
    }))
  : [];
const docker = languages.map((language) => sandbox.getDockerStatus(language));
const firecracker = sandbox.getFirecrackerStatus();
const ready = docker.some((status) => status.canRun) || firecracker.canRun;
const report = {
  contractVersion: 'runtime-sidecar-bootstrap/v1',
  checkedAt: new Date().toISOString(),
  ready,
  mode: shouldPull ? 'pull' : 'check',
  docker: {
    enabled: config.dockerSandboxEnabled,
    cliPath: config.dockerCliPath,
    runtime: config.dockerSandboxRuntime || 'runc',
    canRun: docker.some((status) => status.canRun),
    images: docker,
    detail: docker.map((status) => `${status.language}:${status.canRun ? 'ready' : 'blocked'}:${status.detail}`),
  },
  firecracker: {
    enabled: config.firecrackerEnabled,
    canRun: firecracker.canRun,
    detail: firecracker.detail,
  },
  pulls,
  nextSafeAction: ready
    ? 'Sidecars de execucao isolada prontos para uso governado.'
    : shouldPull
      ? 'Revisar Docker/Firecracker local antes de habilitar tools live isoladas.'
      : 'Rode npm run sidecars:bootstrap -- --pull para preparar imagens Docker aprovadas.',
};

fs.mkdirSync(path.dirname(reportFile), { recursive: true });
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');

console.log('Sidecar Docker bootstrap');
console.log(`Status: ${ready ? 'ready' : 'attention'}`);
console.log(`Report: ${reportFile}`);
for (const status of docker) {
  console.log(`- Docker ${status.language}: ${status.canRun ? 'ready' : 'blocked'} | ${status.image}`);
}
console.log(`- Firecracker: ${firecracker.canRun ? 'ready' : 'blocked'} | ${firecracker.detail}`);
if (pulls.length > 0) {
  for (const pull of pulls) {
    console.log(`- pull ${pull.image}: ${pull.ok ? 'ok' : 'failed'}`);
  }
}

if (shouldRequire && !ready) {
  process.exitCode = 1;
}
