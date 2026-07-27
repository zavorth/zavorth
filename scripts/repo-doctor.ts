import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

type BucketName = 'reports' | 'runtime-logs' | 'deliveries';

type RootArtifact = {
  name: string;
  absolutePath: string;
  size: number;
  modifiedAt: string;
  bucket: BucketName;
};

type DirectoryStat = {
  label: string;
  absolutePath: string;
  exists: boolean;
  files: number;
  bytes: number;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const artifactRoot = path.join(projectRoot, 'ops', 'artifacts', 'generated');

const args = new Set(process.argv.slice(2));
const jsonMode = args.has('--json');
const apply = args.has('--apply');

const rootArtifactRules: Array<{
  pattern: RegExp;
  bucket: BucketName;
}> = [
  {
    pattern: /^(actual-findings\.txt|error_dump\.txt|jest_output\.txt|SECURITY_AUDIT_REPORT(?:_RAW)...\.md|security-audit(?:-utf8)...\.json|tracking\.json|tsc?.*\.out)$/i,
    bucket: 'reports',
  },
  {
    pattern: /^runtime?.*(?:\.log|\.err\.log)$/i,
    bucket: 'runtime-logs',
  },
  {
    pattern: /^(cross-surface?.*\.md|zavorthControl-final-delivery?.*\.md)$/i,
    bucket: 'deliveries',
  },
];

const watchedDirectories: Array<{ label: string; relativePath: string }> = [
  { label: 'data/backups', relativePath: path.join('data', 'backups') },
  { label: 'data/runtime', relativePath: path.join('data', 'runtime') },
  { label: 'data/publish-archives', relativePath: path.join('data', 'publish-archives') },
  { label: 'dist', relativePath: 'dist' },
  { label: 'dist-apps', relativePath: 'dist-apps' },
  { label: 'dist-ops', relativePath: 'dist-ops' },
  { label: 'dist-qa', relativePath: 'dist-qa' },
  { label: 'output', relativePath: 'output' },
  { label: 'tmp-jest-artifacts', relativePath: 'tmp-jest-artifacts' },
  { label: 'ops/artifacts/generated', relativePath: path.join('ops', 'artifacts', 'generated') },
];

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length ? 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function scanDirectoryStats(targetPath: string): DirectoryStat {
  if (!fs.existsSync(targetPath)) {
    return {
      label: path.relative(projectRoot, targetPath).replace(/\\/g, '/'),
      absolutePath: targetPath,
      exists: false,
      files: 0,
      bytes: 0,
    };
  }

  let files = 0;
  let bytes = 0;
  const stack = [targetPath];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }

      files += 1;
      try {
        bytes += fs.statSync(nextPath).size;
      } catch {
        // Ignore files that disappear during read.
      }
    }
  }

  return {
    label: path.relative(projectRoot, targetPath).replace(/\\/g, '/'),
    absolutePath: targetPath,
    exists: true,
    files,
    bytes,
  };
}

function classifyRootArtifact(fileName: string): BucketName | null {
  for (const rule of rootArtifactRules) {
    if (rule.pattern.test(fileName)) {
      return rule.bucket;
    }
  }
  return null;
}

function listRootArtifacts(): RootArtifact[] {
  const entries = fs.readdirSync(projectRoot, { withFileTypes: true });
  const result: RootArtifact[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const bucket = classifyRootArtifact(entry.name);
    if (!bucket) {
      continue;
    }

    const absolutePath = path.join(projectRoot, entry.name);
    const stat = fs.statSync(absolutePath);
    result.push({
      name: entry.name,
      absolutePath,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      bucket,
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

function getBucketPath(bucket: BucketName): string {
  return path.join(artifactRoot, bucket);
}

function buildTargetPath(artifact: RootArtifact): string {
  const targetDir = getBucketPath(artifact.bucket);
  ensureDir(targetDir);
  const candidate = path.join(targetDir, artifact.name);
  if (!fs.existsSync(candidate)) {
    return candidate;
  }

  const parsed = path.parse(artifact.name);
  let index = 1;
  while (true) {
    const nextCandidate = path.join(targetDir, `${parsed.name}-${index}${parsed.ext}`);
    if (!fs.existsSync(nextCandidate)) {
      return nextCandidate;
    }
    index += 1;
  }
}

function relocateRootArtifacts(artifacts: RootArtifact[]): Array<{
  from: string;
  to: string;
}> {
  const moved: Array<{ from: string; to: string }> = [];
  for (const artifact of artifacts) {
    const targetPath = buildTargetPath(artifact);
    fs.renameSync(artifact.absolutePath, targetPath);
    moved.push({
      from: path.relative(projectRoot, artifact.absolutePath).replace(/\\/g, '/'),
      to: path.relative(projectRoot, targetPath).replace(/\\/g, '/'),
    });
  }
  return moved;
}

function countOldFiles(targetPath: string, cutoffMs: number): number {
  if (!fs.existsSync(targetPath)) {
    return 0;
  }

  let total = 0;
  const stack = [targetPath];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }

      try {
        const stat = fs.statSync(nextPath);
        if (Date.now() - stat.mtimeMs > cutoffMs) {
          total += 1;
        }
      } catch {
        // Ignora corrida com remocao external.
      }
    }
  }
  return total;
}

const rootArtifactsBefore = listRootArtifacts();
const movedArtifacts = apply && rootArtifactsBefore.length > 0 ? relocateRootArtifacts(rootArtifactsBefore) : [];
const rootArtifactsAfter = listRootArtifacts();
const directoryStats = watchedDirectories.map((entry) => ({
  ...scanDirectoryStats(path.join(projectRoot, entry.relativePath)),
  label: entry.label,
}));

const report = {
  generatedAt: new Date().toISOString(),
  projectRoot,
  apply,
  rootArtifacts: {
    beforeCount: rootArtifactsBefore.length,
    beforeBytes: rootArtifactsBefore.reduce((total, artifact) => total + artifact.size, 0),
    remainingCount: rootArtifactsAfter.length,
    moved: movedArtifacts,
    remaining: rootArtifactsAfter.map((artifact) => ({
      name: artifact.name,
      bucket: artifact.bucket,
      size: artifact.size,
      modifiedAt: artifact.modifiedAt,
    })),
  },
  directories: directoryStats.map((entry) => ({
    label: entry.label,
    exists: entry.exists,
    files: entry.files,
    bytes: entry.bytes,
  })),
  oldGeneratedArtifacts: {
    olderThan14Days: countOldFiles(artifactRoot, 14 * 24 * 60 * 60 * 1000),
  },
};

if (jsonMode) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(0);
}

console.log('===========================================');
console.log('  Zavorth Repo Doctor');
console.log('===========================================');
console.log(`Workspace: ${projectRoot}`);
console.log(apply ? 'Modo: aplicar' : 'Modo: diagnostic');
console.log('');

console.log(`[repo] loose artifacts at root: ${report.rootArtifacts.beforeCount} file(s), ${formatBytes(report.rootArtifacts.beforeBytes)}`);
if (movedArtifacts.length > 0) {
  console.log(`[repo] artifacts relocados: ${movedArtifacts.length}`);
  for (const move of movedArtifacts.slice(0, 20)) {
    console.log(`  - ${move.from} -> ${move.to}`);
  }
}

if (rootArtifactsAfter.length > 0) {
  console.log('[repo] ainda existem artifacts generated na raiz:');
  for (const artifact of rootArtifactsAfter.slice(0, 20)) {
    console.log(`  - ${artifact.name} (${artifact.bucket}, ${formatBytes(artifact.size)})`);
  }
} else {
  console.log('[repo] root has no known generated artifacts.');
}

console.log('');
console.log('[repo] diretorios observados:');
for (const entry of directoryStats) {
  const existsLabel = entry.exists ? 'present' : 'missing';
  console.log(`  - ${entry.label}: ${existsLabel}, ${entry.files} file(s), ${formatBytes(entry.bytes)}`);
}

console.log('');
console.log(`[repo] artifacts generated com mais de 14 dias em ops/artifacts/generated: ${report.oldGeneratedArtifacts.olderThan14Days}`);
console.log('');
console.log('Tip: use "npm run ops:repo:doctor -- --apply" to relocate known artifacts from the root.');
