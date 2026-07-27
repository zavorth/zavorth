#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const checkOnly = argv.includes('--check');
const writeManifest = argv.includes('--write') || !checkOnly;
const artifactDir = resolveArg('--artifact-dir') || join(root, '.qa', 'installer-release');
const manifestPath = join(artifactDir, 'installer-release-manifest.json');

const trackedFiles = [
  'package.json',
  'package-lock.json',
  'bin/zavorth.js',
  'scripts/install.sh',
  'scripts/install.ps1',
  'scripts/install-zavorth.sh',
  'scripts/install-zavorth.ps1',
  'docs/install.md',
];

const channels = [
  {
    id: 'alpha',
    npmTag: 'alpha',
    purpose: 'Early operator testing.',
    requiredGates: ['runtime:check', 'terminal-presentation:check', 'installer-readiness:check'],
    publishRule: 'Manual publish only. Must keep npm installer path.',
  },
  {
    id: 'beta',
    npmTag: 'beta',
    purpose: 'Limited public testing.',
    requiredGates: ['runtime:check', 'terminal-presentation:check', 'installer-readiness:check', 'zavorth:cli-approval-diff:check'],
    publishRule: 'Promote only after dry-run install checks pass on Windows and Unix.',
  },
  {
    id: 'stable',
    npmTag: 'latest',
    purpose: 'Recommended daily install path.',
    requiredGates: ['runtime:check', 'terminal-presentation:check', 'installer-readiness:check', 'zavorth:cli-approval-diff:check', 'security:prepush'],
    publishRule: 'Promote only after npm package and docs point to the same version.',
  },
];

const manifest = buildManifest();
const failures = validateManifest(manifest);

if (writeManifest) {
  assertInside(root, manifestPath);
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

if (asJson) {
  process.stdout.write(`${JSON.stringify({ ok: failures.length === 0, manifestPath, failures, manifest }, null, 2)}\n`);
} else {
  process.stdout.write(renderReport(manifest, failures, manifestPath));
}

if (failures.length > 0) {
  process.exitCode = 1;
}

function buildManifest() {
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const files = trackedFiles.map((file) => describeFile(file));
  const aggregateInput = files.map((file) => ({
    path: file.path,
    present: file.present,
    bytes: file.bytes,
    sha256: file.sha256,
  }));
  return {
    schemaVersion: 'zavorth-installer-release-manifest/1',
    generatedAt: new Date().toISOString(),
    package: {
      name: packageJson.name,
      version: packageJson.version,
      bin: packageJson.bin || {},
    },
    distribution: {
      activeMode: 'npm-package',
      standaloneBinaries: {
        status: 'not-published',
        rule: 'Do not advertise standalone binaries until release assets, checksums and signature metadata exist.',
      },
      installCommands: {
        unix: 'curl -fsSL https://raw.githubusercontent.com/zavorth/zavorth-core/main/Zavorth/scripts/install.sh | bash',
        windows: 'irm https://raw.githubusercontent.com/zavorth/zavorth-core/main/Zavorth/scripts/install.ps1 | iex',
      },
      channels,
    },
    integrity: {
      algorithm: 'sha256',
      aggregateSha256: sha256(Buffer.from(JSON.stringify(aggregateInput, null, 2), 'utf8')),
      files,
    },
    rollback: {
      userDataPreserved: true,
      generatedArtifactsOnly: true,
      rule: 'Rollback may remove generated installer files and npm global package references, but must preserve .zavorth user data unless the operator explicitly opts in.',
    },
  };
}

function describeFile(file) {
  const absolute = join(root, file);
  if (!existsSync(absolute)) {
    return { path: file, present: false, bytes: 0, sha256: '' };
  }
  const data = readFileSync(absolute);
  return {
    path: file,
    present: true,
    bytes: data.byteLength,
    sha256: sha256(data),
  };
}

function validateManifest(value) {
  const failures = [];
  for (const file of value.integrity.files) {
    if (!file.present) {
      failures.push(`missing required release input: ${file.path}`);
    }
    if (file.present && !/^[a-f0-9]{64}$/.test(file.sha256)) {
      failures.push(`invalid sha256 for ${file.path}`);
    }
  }
  if (value.distribution.activeMode !== 'npm-package') {
    failures.push('active distribution mode must remain npm-package until standalone assets are signed');
  }
  if (value.distribution.standaloneBinaries.status !== 'not-published') {
    failures.push('standalone binaries cannot be marked published without signed release metadata');
  }
  if (!value.rollback.userDataPreserved || !value.rollback.generatedArtifactsOnly) {
    failures.push('rollback policy must preserve user data and remove only generated artifacts');
  }
  return failures;
}

function renderReport(value, failures, target) {
  const lines = [
    '[installer-release] gate 7 release distribution manifest',
    `[installer-release] package ${value.package.name}@${value.package.version}`,
    `[installer-release] mode ${value.distribution.activeMode}`,
    `[installer-release] manifest ${relative(root, target)}`,
    `[installer-release] aggregate ${value.integrity.aggregateSha256}`,
    `[installer-release] files ${value.integrity.files.filter((file) => file.present).length}/${value.integrity.files.length}`,
    `[installer-release] channels ${value.distribution.channels.map((channel) => channel.id).join(', ')}`,
    `[installer-release] rollback preserves user data: ${value.rollback.userDataPreserved}`,
  ];
  if (failures.length > 0) {
    lines.push('[installer-release] failed');
    for (const failure of failures) {
      lines.push(`  - ${failure}`);
    }
  } else {
    lines.push('[installer-release] ok');
  }
  return `${lines.join('\n')}\n`;
}

function resolveArg(name) {
  const inline = argv.find((arg) => arg.startsWith(`${name}=`));
  if (!inline) {
    return null;
  }
  return resolve(inline.slice(name.length + 1));
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function assertInside(base, target) {
  const relativePath = relative(resolve(base), resolve(target));
  if (relativePath.startsWith('..') || relativePath === '' || relativePath.includes('..\\')) {
    if (resolve(base) !== resolve(target)) {
      throw new Error(`refusing to write outside repository: ${target}`);
    }
  }
}
