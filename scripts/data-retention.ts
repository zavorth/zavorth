import fs from 'node:fs';
import path from 'node:path';

type RetentionAction = {
  policyId: string;
  relativePath: string;
  bytes: number;
  ageDays: number;
  action: 'would-remove' | 'removed';
};

type RetentionPolicy = {
  id: string;
  label: string;
  relativePath: string;
  maxAgeDays: number;
  maxEntries?: number;
  include(relativePath: string, absolutePath: string, stats: fs.Stats): boolean;
};

const workspaceRoot = process.cwd();
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const apply = argv.includes('--apply');
const now = Date.now();

const policies: RetentionPolicy[] = [
  {
    id: 'essential-backups',
    label: 'data/backups/essential',
    relativePath: path.join('data', 'backups', 'essential'),
    maxAgeDays: 14,
    maxEntries: 5,
    include: (_relativePath, absolutePath, stats) => {
      const fileName = path.basename(absolutePath);
      return stats.isFile() && fileName !== 'manifest.json' && /\.(zip|json)$/i.test(fileName);
    },
  },
  {
    id: 'database-snapshots',
    label: 'data/backups snapshots',
    relativePath: path.join('data', 'backups'),
    maxAgeDays: 14,
    maxEntries: 5,
    include: (relativePath, _absolutePath, stats) =>
      stats.isDirectory()
      && /^data\/backups\/\d{4}-\d{2}-\d{2}T/.test(relativePath.replace(/\\/g, '/')),
  },
  {
    id: 'runtime-logs',
    label: 'data/runtime logs e traces',
    relativePath: path.join('data', 'runtime'),
    maxAgeDays: 7,
    include: (_relativePath, absolutePath, stats) =>
      stats.isFile() && /\.(log|trace|tmp|bak)$/i.test(path.basename(absolutePath)),
  },
  {
    id: 'runtime-derived-reports',
    label: 'data/runtime reports derivados',
    relativePath: path.join('data', 'runtime'),
    maxAgeDays: 14,
    include: (_relativePath, absolutePath, stats) => {
      const name = path.basename(absolutePath).toLowerCase();
      return stats.isFile() && (name.endsWith('-last.json') || name.endsWith('-report.json'));
    },
  },
  {
    id: 'publish-archives',
    label: 'data/publish-archives',
    relativePath: path.join('data', 'publish-archives'),
    maxAgeDays: 30,
    maxEntries: 12,
    include: (_relativePath, _absolutePath, stats) => stats.isDirectory(),
  },
  {
    id: 'generated-runtime-logs',
    label: 'ops/artifacts/generated/runtime-logs',
    relativePath: path.join('ops', 'artifacts', 'generated', 'runtime-logs'),
    maxAgeDays: 14,
    include: (_relativePath, _absolutePath, stats) => stats.isFile(),
  },
  {
    id: 'generated-deliveries',
    label: 'ops/artifacts/generated/deliveries',
    relativePath: path.join('ops', 'artifacts', 'generated', 'deliveries'),
    maxAgeDays: 14,
    include: (_relativePath, _absolutePath, stats) => stats.isFile(),
  },
  {
    id: 'generated-reports',
    label: 'ops/artifacts/generated/reports',
    relativePath: path.join('ops', 'artifacts', 'generated', 'reports'),
    maxAgeDays: 30,
    include: (_relativePath, _absolutePath, stats) => stats.isFile(),
  },
];

const actions = policies.flatMap(scanPolicy);
const removedBytes = actions
  .filter((action) => action.action === 'removed')
  .reduce((total, action) => total + action.bytes, 0);
const reclaimableBytes = actions.reduce((total, action) => total + action.bytes, 0);

const report = {
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  apply,
  policies: policies.map((policy) => ({
    id: policy.id,
    label: policy.label,
    relativePath: policy.relativePath.replace(/\\/g, '/'),
    maxAgeDays: policy.maxAgeDays,
    maxEntries: policy.maxEntries ?? null,
  })),
  summary: {
    actions: actions.length,
    reclaimableBytes,
    removedBytes,
  },
  actions,
};

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log('[data-retention] checking retention for data/ and generated artifacts');
  console.log(`[data-retention] modo: ${apply ? 'aplicar' : 'diagnostic'}`);
  for (const policy of policies) {
    const policyActions = actions.filter((action) => action.policyId === policy.id);
    console.log(
      `[data-retention] ${policy.label}: ${policyActions.length} item(s) elegivel(is), window ${policy.maxAgeDays} dia(s)${
        policy.maxEntries ? `, max ${policy.maxEntries}` : ''
      }`,
    );
    for (const action of policyActions.slice(0, 8)) {
      console.log(
        `  - ${action.action}: ${action.relativePath} (${formatBytes(action.bytes)}, ${action.ageDays}d)`,
      );
    }
  }
  console.log(`[data-retention] reclaimable: ${formatBytes(reclaimableBytes)}`);
  console.log(`[data-retention] removed: ${formatBytes(removedBytes)}`);
}

function scanPolicy(policy: RetentionPolicy): RetentionAction[] {
  const root = path.join(workspaceRoot, policy.relativePath);
  if (!fs.existsSync(root)) {
    return [];
  }

  const candidates = walk(root)
    .map((absolutePath) => {
      const stats = fs.statSync(absolutePath);
      const relativePath = path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/');
      return { absolutePath, relativePath, stats };
    })
    .filter((entry) => policy.include(entry.relativePath, entry.absolutePath, entry.stats))
    .sort((left, right) => right.stats.mtimeMs ? left.stats.mtimeMs);

  return candidates
    .filter((entry, index) => {
      const ageMs = now - entry.stats.mtimeMs;
      const staleByAge = ageMs > policy.maxAgeDays * 24 * 60 * 60 * 1000;
      const staleByCount = policy.maxEntries !== undefined && index >= policy.maxEntries;
      return staleByAge || staleByCount;
    })
    .map((entry) => removeCandidate(policy, entry.absolutePath, entry.relativePath, entry.stats));
}

function removeCandidate(
  policy: RetentionPolicy,
  absolutePath: string,
  relativePath: string,
  stats: fs.Stats,
): RetentionAction {
  const bytes = stats.isDirectory() ? directorySize(absolutePath) : stats.size;
  const ageDays = Math.floor((now - stats.mtimeMs) / (24 * 60 * 60 * 1000));

  if (apply) {
    fs.rmSync(absolutePath, { recursive: true, force: true });
  }

  return {
    policyId: policy.id,
    relativePath,
    bytes,
    ageDays,
    action: apply ? 'removed' : 'would-remove',
  };
}

function walk(root: string): string[] {
  const entries: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolutePath = path.join(root, entry.name);
    entries.push(absolutePath);
    if (entry.isDirectory()) {
      entries.push(...walk(absolutePath));
    }
  }
  return entries;
}

function directorySize(root: string): number {
  if (!fs.existsSync(root)) {
    return 0;
  }

  const stats = fs.statSync(root);
  if (!stats.isDirectory()) {
    return stats.size;
  }

  return fs.readdirSync(root, { withFileTypes: true }).reduce((total, entry) => {
    return total + directorySize(path.join(root, entry.name));
  }, 0);
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
