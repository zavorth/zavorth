#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const backupRoot = path.join(projectRoot, 'data', 'backups', 'essential');
const manifestPath = path.join(backupRoot, 'manifest.json');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const keepCount = 5;

const includeTargets = [
  '.env',
  '.env.example',
  'README.md',
  'MEMORY.md',
  'package.json',
  'package-lock.json',
  'src',
  'tests',
  'scripts',
  'config',
  'docs',
  '.agents',
  'skill-library',
  path.join('data', 'zavorth.db'),
  path.join('data', 'zavorth.db-shm'),
  path.join('data', 'zavorth.db-wal'),
  path.join('data', 'vendor-lock.json'),
  path.join('data', 'vendor-mirrors'),
  path.join('src', 'ai-gateway'),
  path.join('apps', 'zavorth-terminal'),
  path.join('data', 'runtime', 'db-field.key'),
  path.join('data', 'runtime', 'authorized-host.json'),
  path.join('data', 'runtime', 'mailbox-secret.key'),
];

const excludedDirectoryNames = new Set([
  'node_modules',
  'dist',
  'remote-dist',
  '.docusaurus',
  'build',
  '.vercel',
  '.next',
  'logs',
  'coverage',
]);

const excludedFileSuffixes = ['.log'];

function nowStamp() {
  const iso = new Date().toISOString();
  return iso.replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getGitValue(argsList) {
  const result = spawnSync('git', argsList, {
    cwd: projectRoot,
    shell: false,
    stdio: ['ignore', 'pipe', 'ignore'],
    encoding: 'utf8',
  });
  return result.status === 0 ? String(result.stdout || '').trim() : '';
}

function shouldExclude(relativePath, isDirectory) {
  const normalized = relativePath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  const leaf = segments[segments.length - 1] || '';

  if (isDirectory && excludedDirectoryNames.has(leaf)) {
    return true;
  }

  if (!isDirectory && excludedFileSuffixes.some((suffix) => leaf.endsWith(suffix))) {
    return true;
  }

  if (normalized.startsWith('data/vendor-worktrees/') && (normalized.includes('/node_modules/') || normalized.includes('/.next/'))) {
    return true;
  }

  return false;
}

function addFileToZip(zip, absolutePath, relativePath, report) {
  const stats = fs.statSync(absolutePath);
  zip.file(relativePath.replace(/\\/g, '/'), fs.readFileSync(absolutePath));
  report.files += 1;
  report.bytes += stats.size;
}

function addPathToZip(zip, absolutePath, relativePath, report) {
  if (!fs.existsSync(absolutePath)) {
    return;
  }

  const stats = fs.lstatSync(absolutePath);
  if (shouldExclude(relativePath, stats.isDirectory())) {
    return;
  }

  if (!stats.isDirectory()) {
    addFileToZip(zip, absolutePath, relativePath, report);
    return;
  }

  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    const childAbsolute = path.join(absolutePath, entry.name);
    const childRelative = path.join(relativePath, entry.name);
    addPathToZip(zip, childAbsolute, childRelative, report);
  }
}

function loadManifest() {
  try {
    if (!fs.existsSync(manifestPath)) {
      return { backups: [] };
    }
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return { backups: [] };
  }
}

function saveManifest(manifest) {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

async function main() {
  ensureDir(backupRoot);

  const archiveName = `zavorth-essential-${nowStamp()}.zip`;
  const archivePath = path.join(backupRoot, archiveName);
  const zip = new JSZip();
  const report = {
    createdAt: new Date().toISOString(),
    archivePath,
    files: 0,
    bytes: 0,
    branch: getGitValue(['rev-parse', '--abbrev-ref', 'HEAD']),
    commit: getGitValue(['rev-parse', 'HEAD']),
    includedTargets: includeTargets.slice(),
  };

  for (const target of includeTargets) {
    const absolutePath = path.join(projectRoot, target);
    addPathToZip(zip, absolutePath, target, report);
  }

  zip.file(
    'backup-manifest.json',
    JSON.stringify(
      {
        createdAt: report.createdAt,
        branch: report.branch,
        commit: report.commit,
        files: report.files,
        bytes: report.bytes,
        includedTargets: report.includedTargets,
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log('===========================================');
    console.log('  Zavorth Essential Backup');
    console.log('===========================================');
    console.log('Modo: simulacao');
    console.log(`Arquivo alvo: ${archivePath}`);
    console.log(`Arquivos estimados: ${report.files}`);
    console.log(`Bytes estimados:    ${report.bytes}`);
    return;
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  fs.writeFileSync(archivePath, buffer);

  const manifest = loadManifest();
  manifest.backups = Array.isArray(manifest.backups) ? manifest.backups : [];
  manifest.backups.unshift({
    archivePath,
    createdAt: report.createdAt,
    branch: report.branch,
    commit: report.commit,
    files: report.files,
    bytes: buffer.length,
  });

  const stale = manifest.backups.slice(keepCount);
  manifest.backups = manifest.backups.slice(0, keepCount);
  for (const entry of stale) {
    try {
      if (entry?.archivePath && fs.existsSync(entry.archivePath)) {
        fs.rmSync(entry.archivePath, { force: true });
      }
    } catch {}
  }

  saveManifest(manifest);

  console.log('===========================================');
  console.log('  Zavorth Essential Backup');
  console.log('===========================================');
  console.log(`Arquivo criado: ${archivePath}`);
  console.log(`Arquivos:       ${report.files}`);
  console.log(`Tamanho zip:    ${buffer.length} bytes`);
  console.log(`Manifesto:      ${manifestPath}`);
}

main();
