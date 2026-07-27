import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const shouldApply = args.has('--apply');
const shouldRequireClean = args.has('--require-clean');
const shouldJson = args.has('--json');
const retiredLocalStateDir = ['.', 'basi', 'lisk'].join('');
const retiredDatabaseStem = ['basi', 'lisk'].join('');
const retiredPreviousDatabaseStem = ['aster', 'lyn'].join('');

const sensitivePatterns = [
  { name: 'personal-workspace-path', pattern: /C:(?:\\|\/)TESTES DEV/i },
  { name: 'personal-user-profile', pattern: /C:\\Users\\ermys/i },
  { name: 'query-token-auth', pattern: /[...&]token=/i },
];

const scanTargets = [
  '.env',
  '.zavorth',
  retiredLocalStateDir,
  '.codex-run',
  '.tmp',
  'tmp',
  'tmp-jest-artifacts',
  'output',
  'logs',
  'data',
];

const purgeTargets = [
  '.codex-run',
  '.zavorth/logs',
  `${retiredLocalStateDir}/logs`,
  '.tmp',
  'tmp',
  'tmp-jest-artifacts',
  'output',
  'logs',
  'data/agent-bridge',
  'data/zavorth-bridge-control',
  'data/zavorth-bridge-prompt',
  'data/backups',
  'data/config-gitops',
  'data/operational-memory',
  'data/publish-archives',
  'data/release',
  'data/runtime',
  'data/self-heal/backups',
  'data/temp',
  'data/tmp',
  'data/vendor',
  'data/vendor-history',
  'data/vendor-mirrors',
  'data/vendor-worktrees',
  'data/video-contexts',
  'data/workspace-profiles',
  'data/secrets_honey.txt',
  `data/${retiredPreviousDatabaseStem}.db`,
  `data/${retiredDatabaseStem}.db`,
  `data/${retiredDatabaseStem}.db-shm`,
  `data/${retiredDatabaseStem}.db-wal`,
  'data/zavorth.db',
  'data/zavorth.db-shm',
  'data/zavorth.db-wal',
];

const envPathRewrites = new Map([
  ['DOCKER_CLI_PATH', 'docker'],
  ['ZAVORTH_BRIDGE_START_WORKSPACE', '.'],
  ['WHATSAPP_OUTBOX_DIR', 'data/whatsapp-bridge/outbox'],
  ['WHATSAPP_STATUS_FILE', 'data/runtime/whatsapp-status.json'],
  ['SLACK_OUTBOX_DIR', 'data/slack-bridge/outbox'],
  ['SLACK_STATUS_FILE', 'data/runtime/slack-status.json'],
  ['SIGNAL_OUTBOX_DIR', 'data/signal-bridge/outbox'],
  ['SIGNAL_STATUS_FILE', 'data/runtime/signal-bridge-status.json'],
  ['IMESSAGE_OUTBOX_DIR', 'data/imessage-bridge/outbox'],
  ['IMESSAGE_STATUS_FILE', 'data/runtime/imessage-bridge-status.json'],
  ['TEAMS_STATUS_FILE', 'data/runtime/teams-status.json'],
  ['EMAIL_OUTBOX_DIR', 'data/email-bridge/outbox'],
  ['EMAIL_STATUS_FILE', 'data/runtime/email-status.json'],
]);

function resolveInsideWorkspace(relativePath) {
  const absolute = path.resolve(root, relativePath);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to touch path outside workspace: ${absolute}`);
  }
  return absolute;
}

function rootBucket(relativePath) {
  return relativePath.split(/[\\/]/)[0] || relativePath;
}

function scanFile(absolute, findings, counts) {
  const relative = path.relative(root, absolute).replace(/\\/g, '/');
  let buffer;
  try {
    buffer = fs.readFileSync(absolute);
  } catch {
    return;
  }

  const text = buffer.toString('latin1');
  for (const { name, pattern } of sensitivePatterns) {
    pattern.lastIndex = 0;
    if (!pattern.test(text)) {
      continue;
    }

    const key = `${rootBucket(relative)}:${name}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    if (findings.length < 50) {
      findings.push({ type: name, file: relative });
    }
  }
}

function walk(absolute, findings, counts) {
  if (!fs.existsSync(absolute)) {
    return;
  }

  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(absolute)) {
      walk(path.join(absolute, entry), findings, counts);
    }
    return;
  }

  if (stat.isFile()) {
    scanFile(absolute, findings, counts);
  }
}

function scanLocalPrivacy() {
  const findings = [];
  const counts = new Map();
  for (const target of scanTargets) {
    walk(path.resolve(root, target), findings, counts);
  }

  return {
    count: Array.from(counts.values()).reduce((total, value) => total + value, 0),
    counts: Object.fromEntries(Array.from(counts.entries()).sort()),
    findings,
  };
}

function sanitizeEnv() {
  const absolute = path.resolve(root, '.env');
  if (!fs.existsSync(absolute)) {
    return { changed: false, rewrites: [] };
  }

  const original = fs.readFileSync(absolute, 'utf8');
  const rewrites = [];
  const updated = original.replace(/^([A-Z0-9_]+)=(.*)$/gm, (line, key, value) => {
    if (!envPathRewrites.has(key)) {
      return line;
    }

    const nextValue = envPathRewrites.get(key);
    if (value === nextValue) {
      return line;
    }

    rewrites.push(key);
    return `${key}=${nextValue}`;
  });

  if (updated !== original) {
    fs.writeFileSync(absolute, updated);
  }

  return { changed: updated !== original, rewrites };
}

function purgeLocalArtifacts() {
  const removed = [];
  for (const target of purgeTargets) {
    const absolute = resolveInsideWorkspace(target);
    if (!fs.existsSync(absolute)) {
      continue;
    }

    fs.rmSync(absolute, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 250,
    });
    removed.push(target);
  }

  return removed;
}

function formatReport(report) {
  if (shouldJson) {
    return JSON.stringify(report, null, 2);
  }

  const lines = [];
  lines.push(`[privacy-clean] findings=${report.scan.count}`);
  for (const [key, value] of Object.entries(report.scan.counts)) {
    lines.push(`[privacy-clean] ${key}: ${value}`);
  }
  if (report.apply) {
    lines.push(`[privacy-clean] env rewrites=${report.apply.env.rewrites.length}`);
    lines.push(`[privacy-clean] removed targets=${report.apply.removed.length}`);
    for (const target of report.apply.removed) {
      lines.push(`[privacy-clean] removed ${target}`);
    }
  }
  return lines.join('\n');
}

const applyResult = shouldApply
  ? {
      env: sanitizeEnv(),
      removed: purgeLocalArtifacts(),
    }
  : undefined;

const scan = scanLocalPrivacy();
const report = {
  mode: shouldApply ? 'apply' : 'scan',
  scan,
  ...(applyResult ? { apply: applyResult } : {}),
};

console.log(formatReport(report));

if (shouldRequireClean && scan.count > 0) {
  process.exitCode = 1;
}
