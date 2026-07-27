#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

const projectRoot = process.cwd();
const artifactDir = path.join(projectRoot, 'dist-standalone');
const manifestPath = path.join(artifactDir, 'standalone-manifest.json');
const releaseManifestPath = path.join(projectRoot, 'scripts', 'release-artifacts.json');

function main(): void {
  const asJson = process.argv.includes('--json');
  const check = process.argv.includes('--check');
  const manifest = buildReleaseArtifactsManifest();
  const failures = validate(manifest);

  if (!check) {
    fs.writeFileSync(releaseManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ ok: failures.length === 0, failures, manifest }, null, 2)}\n`);
  } else {
    process.stdout.write(render(manifest, failures));
  }

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

function buildReleaseArtifactsManifest() {
  const standaloneManifest = readJson(manifestPath);
  const artifacts = Array.isArray(standaloneManifest.artifacts) ? standaloneManifest.artifacts : [];
  return {
    schemaVersion: 'zavorth-release-artifacts/1',
    generatedAt: new Date().toISOString(),
    packageName: standaloneManifest.packageName || 'zavorth',
    version: standaloneManifest.version || '0.0.0',
    nativeBinaryStatus: standaloneManifest.nativeBinaryStatus || 'not-built',
    minimumNode: standaloneManifest.minimumNode || '18.0.0',
    artifacts: artifacts.map((entry: any) => {
      const target = path.join(projectRoot, entry.path);
      return {
        name: entry.name,
        platform: entry.platform,
        kind: entry.kind,
        nativeBinary: entry.nativeBinary === true,
        path: entry.path,
        bytes: fs.existsSync(target) ? fs.statSync(target).size : 0,
        sha256: fs.existsSync(target) ? sha256(fs.readFileSync(target)) : '',
      };
    }),
  };
}

function validate(manifest: any): string[] {
  const failures: string[] = [];
  const names = new Set((manifest.artifacts || []).map((entry: any) => entry.name));
  for (const name of [
    'zavorth.cjs',
    'zavorth-linux-x64',
    'zavorth-linux-arm64',
    'zavorth-macos-x64',
    'zavorth-macos-arm64',
    'zavorth-win-x64.cmd',
    'zavorth-win-arm64.cmd',
  ]) {
    if (!names.has(name)) {
      failures.push(`missing artifact ${name}`);
    }
  }
  for (const entry of manifest.artifacts || []) {
    if (!/^[a-f0-9]{64}$/.test(String(entry.sha256 || ''))) {
      failures.push(`invalid sha256 for ${entry.name}`);
    }
    if (entry.bytes <= 0) {
      failures.push(`empty artifact ${entry.name}`);
    }
  }
  if (manifest.nativeBinaryStatus !== 'not-built') {
    failures.push('native binary status must stay not-built until signed native assets exist');
  }
  return failures;
}

function render(manifest: any, failures: string[]): string {
  const lines = [
    '[release-artifacts] gate 8 standalone launcher artifacts',
    `[release-artifacts] package ${manifest.packageName}@${manifest.version}`,
    `[release-artifacts] native binary status: ${manifest.nativeBinaryStatus}`,
    `[release-artifacts] artifacts: ${(manifest.artifacts || []).length}`,
  ];
  if (failures.length > 0) {
    lines.push('[release-artifacts] failed');
    for (const failure of failures) {
      lines.push(`  - ${failure}`);
    }
  } else {
    lines.push('[release-artifacts] ok');
  }
  return `${lines.join('\n')}\n`;
}

function readJson(target: string): any {
  if (!fs.existsSync(target)) {
    throw new Error(`Missing ${path.relative(projectRoot, target)}. Run npm run standalone:build first.`);
  }
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

main();
