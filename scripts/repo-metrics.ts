import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

type DirectoryMetric = {
  label: string;
  exists: boolean;
  files: number;
  bytes: number;
};

type FileMetric = {
  relativePath: string;
  lines: number;
};

const workspaceRoot = process.cwd();
const asJson = process.argv.includes('--json');

const watchedDirectories = [
  'src',
  'tests',
  'docs',
  'scripts',
  'data/runtime',
  'data/backups',
  'data/publish-archives',
  'ops/artifacts/generated',
  'dist',
  'dist-ops',
  'dist-qa',
];

const directoryMetrics = watchedDirectories.map((relativePath) =>
  scanDirectory(path.join(workspaceRoot, relativePath), relativePath),
);
const sourceFiles = listCodeFiles(path.join(workspaceRoot, 'src'), 'src');
const testFiles = listCodeFiles(path.join(workspaceRoot, 'tests'), 'tests');
const packageScripts = readPackageScripts();
const health = {
  gitClean: readGitPorcelain().trim().length === 0,
  branch: readGitValue(['rev-parse', '--abbrev-ref', 'HEAD']),
  commit: readGitValue(['rev-parse', '--short', 'HEAD']),
};

const metrics = {
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  health,
  summary: {
    sourceFiles: sourceFiles.length,
    testFiles: testFiles.length,
    packageScripts,
    dataRuntimeBytes: directoryMetrics.find((entry) => entry.label === 'data/runtime')?.bytes ?? 0,
    generatedArtifactBytes: directoryMetrics.find((entry) => entry.label === 'ops/artifacts/generated')?.bytes ?? 0,
  },
  directories: directoryMetrics,
  hotspots: {
    sourceByLines: sourceFiles.sort((left, right) => right.lines - left.lines).slice(0, 10),
    testsByLines: testFiles.sort((left, right) => right.lines - left.lines).slice(0, 10),
  },
};

if (asJson) {
  process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
} else {
  console.log('[repo-metrics] painel estrutural do Zavorth');
  console.log(`[repo-metrics] branch=${health.branch} commit=${health.commit} gitClean=${health.gitClean ? 'sim' : 'nao'}`);
  console.log(`[repo-metrics] src=${metrics.summary.sourceFiles} arquivos | tests=${metrics.summary.testFiles} arquivos | scripts=${packageScripts}`);
  console.log('');
  console.log('[repo-metrics] diretorios');
  for (const entry of directoryMetrics) {
    console.log(`- ${entry.label}: ${entry.exists ? 'presente' : 'ausente'}, ${entry.files} arquivo(s), ${formatBytes(entry.bytes)}`);
  }
  console.log('');
  console.log('[repo-metrics] maiores arquivos em src');
  for (const entry of metrics.hotspots.sourceByLines) {
    console.log(`- ${entry.relativePath}: ${entry.lines} linhas`);
  }
  console.log('');
  console.log('[repo-metrics] maiores arquivos em tests');
  for (const entry of metrics.hotspots.testsByLines) {
    console.log(`- ${entry.relativePath}: ${entry.lines} linhas`);
  }
}

function scanDirectory(absolutePath: string, label: string): DirectoryMetric {
  if (!fs.existsSync(absolutePath)) {
    return { label, exists: false, files: 0, bytes: 0 };
  }

  let files = 0;
  let bytes = 0;
  const stack = [absolutePath];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
        continue;
      }
      files += 1;
      bytes += fs.statSync(next).size;
    }
  }

  return { label, exists: true, files, bytes };
}

function listCodeFiles(root: string, topLevel: string): FileMetric[] {
  if (!fs.existsSync(root)) {
    return [];
  }
  return walk(root)
    .filter((absolutePath) => /\.(ts|tsx|js|mjs|cjs)$/.test(absolutePath))
    .map((absolutePath) => {
      const relativePath = `${topLevel}/${path.relative(root, absolutePath).replace(/\\/g, '/')}`;
      const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/).length;
      return { relativePath, lines };
    });
}

function walk(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolutePath));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

function readPackageScripts(): number {
  const packageJson = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8'));
  return Object.keys(packageJson.scripts || {}).length;
}

function readGitValue(args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: workspaceRoot, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function readGitPorcelain(): string {
  try {
    return execFileSync('git', ['status', '--porcelain'], { cwd: workspaceRoot, encoding: 'utf8' });
  } catch {
    return '';
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
}
