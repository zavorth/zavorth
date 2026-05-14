import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { config } from '../src/config/index.js';

export type CapabilityProvisionSpec = {
  id: string;
  dependencies: string[];
  cleanupPaths: string[];
  notes: string;
};

export const CAPABILITY_PROVISION_SPECS: Record<string, CapabilityProvisionSpec> = {
  media: {
    id: 'media',
    dependencies: ['msedge-tts', 'ffmpeg-static', 'pdf-parse', 'youtube-dl-exec'],
    cleanupPaths: [],
    notes: 'Provisiona TTS, ffmpeg, leitor de PDF e fallback de yt-dlp.',
  },
  remote: {
    id: 'remote',
    dependencies: ['sql.js'],
    cleanupPaths: [
      config.AIGatewaySidecarWorktreeDir,
      config.ZavorthTerminalSidecarWorktreeDir,
      config.AIGatewaySidecarLogFile,
      config.ZavorthTerminalSidecarLogFile,
      config.AIGatewaySidecarStatusFile,
      config.ZavorthTerminalSidecarStatusFile,
      config.zavorthBridgePublicTunnelStateFile,
      config.zavorthBridgePublicTunnelLogFile,
      config.zavorthPublicTunnelStateFile,
      config.zavorthPublicTunnelLogFile,
    ],
    notes: 'Provisiona dependencias opcionais da trilha remota.',
  },
  qa: {
    id: 'qa',
    dependencies: [],
    cleanupPaths: [path.resolve(config.projectRoot, 'data', 'runtime', 'visual-smoke')],
    notes: 'Mantem apenas a trilha de QA visual efemera.',
  },
  sandbox: {
    id: 'sandbox',
    dependencies: [],
    cleanupPaths: [
      path.resolve(config.projectRoot, 'data', 'firecracker'),
    ],
    notes: 'A trilha sandbox depende de bootstrap do host, nao de pacotes npm.',
  },
};

function getNpmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

export function resolveCapabilityProvisionSpec(capabilityId: string): CapabilityProvisionSpec {
  const normalizedId = String(capabilityId || '').trim().toLowerCase();
  const spec = CAPABILITY_PROVISION_SPECS[normalizedId];
  if (!spec) {
    throw new Error(`Capability desconhecida. Use uma de: ${Object.keys(CAPABILITY_PROVISION_SPECS).join(', ')}`);
  }
  return spec;
}

function getSpecFromArg(argv: string[]): CapabilityProvisionSpec {
  const capabilityId = String(argv[0] || '').trim().toLowerCase();
  return resolveCapabilityProvisionSpec(capabilityId);
}

export function assertSafeProjectPath(targetPath: string): string {
  const absolute = path.resolve(targetPath);
  const relative = path.relative(config.projectRoot, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path fora da raiz do projeto bloqueado: ${absolute}`);
  }
  return absolute;
}

export function installCapabilityDependencies(spec: CapabilityProvisionSpec): void {
  if (spec.dependencies.length === 0) {
    console.log(`[capability-provision] ${spec.id}: sem dependencias npm opcionais para instalar.`);
    return;
  }

  console.log(`[capability-provision] Instalando dependencias da capability ${spec.id}: ${spec.dependencies.join(', ')}`);
  const result = spawnSync(
    getNpmCommand(),
    ['install', '--no-save', ...spec.dependencies],
    {
      cwd: config.projectRoot,
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  if (result.status !== 0) {
    throw new Error(`Falha ao instalar dependencias da capability ${spec.id}.`);
  }
}

export function cleanCapabilityArtifacts(spec: CapabilityProvisionSpec): string[] {
  const removedPaths: string[] = [];
  for (const target of spec.cleanupPaths) {
    const safePath = assertSafeProjectPath(target);
    if (!fs.existsSync(safePath)) {
      continue;
    }
    fs.rmSync(safePath, { recursive: true, force: true });
    removedPaths.push(path.relative(config.projectRoot, safePath).replace(/\\/g, '/'));
  }
  console.log(`[capability-provision] Cleanup da capability ${spec.id}: ${removedPaths.length} alvo(s) removido(s).`);
  return removedPaths;
}

export function runCapabilityProvisionCli(argv: string[]): void {
  const cleanMode = argv.includes('--clean');
  const filteredArgs = argv.filter((entry) => entry !== '--clean');
  const spec = getSpecFromArg(filteredArgs);

  if (cleanMode) {
    cleanCapabilityArtifacts(spec);
    return;
  }

  installCapabilityDependencies(spec);
  console.log(`[capability-provision] ${spec.notes}`);
}

async function main(): Promise<void> {
  runCapabilityProvisionCli(process.argv.slice(2));
}

const directExecutionPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (directExecutionPath && /capability-provision\.(?:js|ts)$/i.test(path.basename(directExecutionPath))) {
  main().catch((error) => {
    console.error(`[capability-provision] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
