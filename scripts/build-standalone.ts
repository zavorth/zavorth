#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

type StandaloneArtifact = {
  name: string;
  path: string;
  platform: 'any' | 'linux-x64' | 'linux-arm64' | 'macos-x64' | 'macos-arm64' | 'win-x64' | 'win-arm64';
  kind: 'node-launcher' | 'shell-wrapper' | 'cmd-wrapper';
  executable: boolean;
  nativeBinary: false;
};

const projectRoot = process.cwd();
const outDir = path.join(projectRoot, 'dist-standalone');
const minNodeMajor = 18;
const artifacts: StandaloneArtifact[] = [];

function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const asJson = process.argv.includes('--json');

  const planned = buildPlan();
  if (!dryRun) {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    for (const entry of planned) {
      writeArtifact(entry);
    }
    writeManifest(planned);
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ ok: true, dryRun, outDir, artifacts: planned }, null, 2)}\n`);
    return;
  }

  process.stdout.write([
    '[standalone] Zavorth single-file launcher build',
    `[standalone] mode: ${dryRun ? 'dry-run' : 'write'}`,
    `[standalone] output: ${path.relative(projectRoot, outDir)}`,
    `[standalone] artifacts: ${planned.length}`,
    '[standalone] native binary status: not built in this build; launcher requires Node.js 18+'
    '[standalone] ok',
    '',
  ].join('\n'));
}

function buildPlan(): StandaloneArtifact[] {
  const launcher = artifact('zavorth.cjs', 'any', 'node-launcher', false);
  const unix = [
    artifact('zavorth-linux-x64', 'linux-x64', 'shell-wrapper', true),
    artifact('zavorth-linux-arm64', 'linux-arm64', 'shell-wrapper', true),
    artifact('zavorth-macos-x64', 'macos-x64', 'shell-wrapper', true),
    artifact('zavorth-macos-arm64', 'macos-arm64', 'shell-wrapper', true),
  ];
  const windows = [
    artifact('zavorth-win-x64.cmd', 'win-x64', 'cmd-wrapper', false),
    artifact('zavorth-win-arm64.cmd', 'win-arm64', 'cmd-wrapper', false),
  ];
  return [launcher, ...unix, ...windows];
}

function artifact(
  name: string,
  platform: StandaloneArtifact['platform'],
  kind: StandaloneArtifact['kind'],
  executable: boolean,
): StandaloneArtifact {
  return {
    name,
    path: path.join(outDir, name),
    platform,
    kind,
    executable,
    nativeBinary: false,
  };
}

function writeArtifact(entry: StandaloneArtifact): void {
  const content = entry.kind === 'node-launcher'
    ? nodeLauncher()
    : entry.kind === 'cmd-wrapper'
      ? windowsWrapper()
      : unixWrapper();
  fs.writeFileSync(entry.path, content, 'utf8');
  if (entry.executable) {
    try {
      fs.chmodSync(entry.path, 0o755);
    } catch {
      // Windows may ignore chmod. The manifest still records intent.
    }
  }
  artifacts.push(entry);
}

function writeManifest(entries: StandaloneArtifact[]): void {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')) as { name?: string; version?: string };
  const manifest = {
    schemaVersion: 'zavorth-standalone-artifacts/1',
    generatedAt: new Date().toISOString(),
    packageName: pkg.name || 'zavorth',
    version: pkg.version || '0.0.0',
    minimumNode: `${minNodeMajor}.0.0`,
    nativeBinaryStatus: 'not-built',
    releaseRule: 'Do not publish .exe/native binary claims until nativeBinaryStatus is built and checksums/signatures are present.',
    artifacts: entries.map((entry) => ({
      name: entry.name,
      platform: entry.platform,
      kind: entry.kind,
      executable: entry.executable,
      nativeBinary: entry.nativeBinary,
      path: path.relative(projectRoot, entry.path),
      bytes: fs.existsSync(entry.path) ? fs.statSync(entry.path).size : 0,
    })),
  };
  fs.writeFileSync(path.join(outDir, 'standalone-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function nodeLauncher(): string {
  return `#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const minMajor = ${minNodeMajor};
const currentMajor = Number(process.versions.node.split('.')[0]);
if (!Number.isFinite(currentMajor) || currentMajor < minMajor) {
  console.error('Zavorth standalone launcher requires Node.js 18 or newer.');
  process.exit(2);
}

const candidates = [
  path.resolve(__dirname, '..', 'dist', 'zavorth-cli.js'),
  path.resolve(__dirname, 'dist', 'zavorth-cli.js'),
  path.resolve(process.cwd(), 'dist', 'zavorth-cli.js'),
];
const cliPath = candidates.find((candidate) => fs.existsSync(candidate));
if (!cliPath) {
  console.error('Zavorth CLI build not found. Run npm run build or install the published package.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: { ...process.env, ZAVORTH_PUBLIC_CLI: '1' },
  stdio: 'inherit',
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(typeof result.status === 'number' ? result.status : 1);
`;
}

function unixWrapper(): string {
  return `#!/usr/bin/env sh
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec node "$SCRIPT_DIR/zavorth.cjs" "$@"
`;
}

function windowsWrapper(): string {
  return `@echo off\r\nset SCRIPT_DIR=%~dp0\r\nnode "%SCRIPT_DIR%zavorth.cjs" %*\r\n`;
}

main();
