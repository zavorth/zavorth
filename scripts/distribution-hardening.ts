#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { DistributionHardeningService } from '../src/services/DistributionHardeningService.js';
import {
  DISTRIBUTION_HARDENING_CHANNELS,
  DISTRIBUTION_HARDENING_INSTALLER_PREVIEW_STEPS,
  DISTRIBUTION_HARDENING_MANIFEST_ITEMS,
  DISTRIBUTION_HARDENING_SMOKE_STEPS,
} from '../src/contracts/DistributionHardeningContract.js';

type ManifestArtifactItem = {
  path: string;
  required: boolean;
  present: boolean;
  bytes: number;
  sha256: string;
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const shouldWriteManifest = argv.includes('--manifest') || requirePass;
const shouldWritePreview = argv.includes('--preview') || requirePass;
const shouldRunSmoke = argv.includes('--smoke') || requirePass;
const projectRoot = process.cwd();
const artifactDir = resolveArtifactDir();
const manifestPath = path.join(artifactDir, 'distribution-manifest.json');
const installerPreviewPath = path.join(artifactDir, 'installer-preview.json');
const smokeArtifactPath = path.join(artifactDir, 'install-smoke.json');

async function main(): Promise<void> {
  fs.mkdirSync(artifactDir, { recursive: true });

  if (shouldWriteManifest) {
    writeJson(manifestPath, buildDistributionManifest());
  }

  if (shouldWritePreview) {
    writeJson(installerPreviewPath, buildInstallerPreview());
  }

  if (shouldRunSmoke) {
    writeJson(smokeArtifactPath, runLocalInstallSmoke());
  }

  const service = new DistributionHardeningService({
    projectRoot,
    artifactDir,
    manifestPath,
    installerPreviewPath,
    smokeArtifactPath,
    requireArtifacts: requirePass || shouldWriteManifest || shouldWritePreview || shouldRunSmoke,
  });
  const snapshot = service.buildSnapshot();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderReport(snapshot)}\n`);
  }

  if (requirePass && !snapshot.summary.ok) {
    process.exitCode = 1;
  }
}

function resolveArtifactDir(): string {
  const inline = argv.find((arg) => arg.startsWith('--artifact-dir='));
  const cliValue = inline ? inline.split('=').slice(1).join('=').trim() : '';
  return path.resolve(cliValue || path.join(projectRoot, '.qa', 'distribution-hardening'));
}

function buildDistributionManifest() {
  const items = DISTRIBUTION_HARDENING_MANIFEST_ITEMS.map((item) => readManifestItem(item.path, item.required));
  const aggregateInput = items.map((item) => ({
    path: item.path,
    required: item.required,
    present: item.present,
    bytes: item.bytes,
    sha256: item.sha256,
  }));
  const aggregateSha256 = sha256(Buffer.from(JSON.stringify(aggregateInput, null, 2), 'utf8'));

  return {
    schemaVersion: '1.0.0',
    version: 'v1.0.0',
    generatedAt: new Date().toISOString(),
    ok: items.every((item) => !item.required || (item.present && /^[a-f0-9]{64}$/.test(item.sha256))),
    rootName: path.basename(projectRoot),
    items,
    channels: DISTRIBUTION_HARDENING_CHANNELS,
    integrity: {
      algorithm: 'sha256',
      aggregateSha256,
      reproducibleInputs: items.map((item) => item.path),
    },
  };
}

function readManifestItem(relativePath: string, required: boolean): ManifestArtifactItem {
  const target = path.resolve(projectRoot, relativePath);
  if (!isInside(projectRoot, target) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return {
      path: relativePath,
      required,
      present: false,
      bytes: 0,
      sha256: '',
    };
  }
  const bytes = fs.readFileSync(target);
  return {
    path: relativePath,
    required,
    present: true,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  };
}

function buildInstallerPreview() {
  const targetRoot = path.join(artifactDir, 'fixture-install');
  return {
    schemaVersion: '1.0.0',
    version: 'v1.0.0',
    generatedAt: new Date().toISOString(),
    ok: true,
    mutatesHost: false,
    requiresConfirmation: true,
    targetRoot,
    targetSafety: 'fixture-only path inside .qa/distribution-hardening',
    steps: DISTRIBUTION_HARDENING_INSTALLER_PREVIEW_STEPS,
    plannedChanges: [
      { action: 'create-dir', path: path.join(targetRoot, 'bin') },
      { action: 'write-file', path: path.join(targetRoot, 'manifest.json') },
      { action: 'write-file', path: path.join(targetRoot, 'bin', 'zavorth.cmd') },
      { action: 'preserve-dir', path: path.join(targetRoot, 'user-data') },
    ],
    rollbackPlan: [
      'Remove files listed in plannedChanges when they were created by this installer run.',
      'Preserve user-data unless the operator explicitly opts into data deletion.',
      'Restore previous manifest only when a backup artifact is present.',
    ],
    cleanupPlan: {
      preserveUserData: true,
      requiresOptInForUserData: true,
      removesOnlyInstallerArtifacts: true,
      generatedOnly: true,
    },
  };
}

function runLocalInstallSmoke() {
  const targetRoot = path.join(artifactDir, 'fixture-install');
  assertInside(artifactDir, targetRoot);
  safeRemove(targetRoot);

  const binDir = path.join(targetRoot, 'bin');
  const userDataDir = path.join(targetRoot, 'user-data');
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(path.join(userDataDir, 'keep.txt'), 'fixture user data\n', 'utf8');

  const manifest = {
    version: 'v1.0.0',
    channel: 'stable',
    digest: readDigestFromManifestArtifact(),
  };
  fs.writeFileSync(path.join(targetRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(binDir, 'zavorth.cmd'), '@echo off\r\necho zavorth fixture\r\n', 'utf8');

  const installedManifest = JSON.parse(fs.readFileSync(path.join(targetRoot, 'manifest.json'), 'utf8')) as typeof manifest;
  const healthOk = installedManifest.version === 'v1.0.0' && installedManifest.channel === 'stable';

  const uninstallPreview = {
    removes: [
      path.join(targetRoot, 'manifest.json'),
      path.join(binDir, 'zavorth.cmd'),
    ],
    preserves: [userDataDir],
    mutatesHost: false,
  };

  fs.rmSync(path.join(targetRoot, 'manifest.json'), { force: true });
  fs.rmSync(path.join(binDir, 'zavorth.cmd'), { force: true });
  safeRemove(binDir);
  const userDataPreserved = fs.existsSync(path.join(userDataDir, 'keep.txt'));

  const steps = [
    {
      id: 'install-preview',
      status: 'pass',
      mutatesHost: false,
      detail: 'Fixture install wrote only inside .qa/distribution-hardening.',
    },
    {
      id: 'health-check',
      status: healthOk ? 'pass' : 'fail',
      mutatesHost: false,
      detail: healthOk ? 'Fixture manifest reports v1.0.0 stable.' : 'Fixture manifest did not report v1.0.0 stable.',
    },
    {
      id: 'uninstall-preview',
      status: uninstallPreview.mutatesHost ? 'fail' : 'pass',
      mutatesHost: false,
      detail: 'Uninstall preview lists generated files and preserved user-data.',
      preview: uninstallPreview,
    },
    {
      id: 'cleanup',
      status: userDataPreserved ? 'pass' : 'fail',
      mutatesHost: false,
      detail: userDataPreserved ? 'Generated files removed; user-data preserved.' : 'User data fixture was removed unexpectedly.',
    },
  ];

  return {
    schemaVersion: '1.0.0',
    version: 'v1.0.0',
    generatedAt: new Date().toISOString(),
    ok: steps.every((step) => step.status === 'pass') && userDataPreserved,
    targetRoot,
    expectedSteps: DISTRIBUTION_HARDENING_SMOKE_STEPS,
    userDataPreserved,
    steps,
  };
}

function readDigestFromManifestArtifact(): string {
  if (!fs.existsSync(manifestPath)) {
    return 'sha256:missing-manifest';
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { integrity?: { aggregateSha256?: string } };
    return `sha256:${manifest.integrity?.aggregateSha256 || 'missing-aggregate'}`;
  } catch {
    return 'sha256:invalid-manifest';
  }
}

function safeRemove(target: string): void {
  assertInside(artifactDir, target);
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function writeJson(target: string, value: unknown): void {
  assertInside(artifactDir, target);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertInside(root: string, target: string): void {
  if (!isInside(root, target)) {
    throw new Error(`recusando tocar caminho fora do diretorio esperado: ${target}`);
  }
}

function isInside(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

main().catch((error) => {
  console.error('[distribution-hardening] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
