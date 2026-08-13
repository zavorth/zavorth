import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const includeUntracked = argv.includes('--include-untracked');
const workspaceRoot = process.cwd();

const LIFECYCLE_SCRIPTS = new Set(['preinstall', 'install', 'postinstall', 'prepare']);
const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const RISKY_SPEC_RE = /^(?:https?:|git(?:\+ssh|\+https|\+http)?:|ssh:|file:|link:|\/|[A-Za-z]:[\\/])/i;
const UNPINNED_SPEC_RE = /^(?:\*|latest)$/i;
const REMOTE_SCRIPT_RE = /\b(?:curl|wget|irm|iwr|Invoke-WebRequest|Invoke-RestMethod)\b[\s\S]*(?:\||;|&&)\s*(?:sh|bash|zsh|pwsh|powershell|cmd)\b/i;
const OPAQUE_SHELL_RE = /\b(?:powershell|pwsh)\b[\s\S]*(?:-enc|-encodedcommand)\b/i;

/**
 * Explicitly reviewed lifecycle scripts.
 * Matched by path + script name + command fingerprint so fixture package.json
 * postinstalls are still blocked.
 */
const LIFECYCLE_ALLOWLIST = [
  { path: 'package.json', name: 'postinstall', commandRe: /ensure-code-runtime/i },
  { path: 'packages/code/package.json', name: 'postinstall', commandRe: /fix-node-pty/i },
  { path: 'packages/code/cli/package.json', name: 'prepare', commandRe: /effect-language-service|patch/i },
];

/** Explicitly reviewed unpinned specs (path:section.name). */
const UNPINNED_ALLOWLIST = new Set([
  'packages/code/gitlab-auth/package.json:peerDependencies.@zavorth/plugin',
  'packages/code/poe-auth/package.json:peerDependencies.@zavorth/plugin',
  'packages/code/poe-auth/package.json:dependencies.poe-oauth',
]);

function isLifecycleAllowed(relativePath, name, command) {
  const normalized = normalizePath(relativePath);
  return LIFECYCLE_ALLOWLIST.some(
    (entry) => entry.path === normalized && entry.name === name && entry.commandRe.test(String(command || '')),
  );
}

const findings = scanPackageManifests(readPackageManifests());
const snapshot = {
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  includeUntracked,
  status: findings.length === 0 ? 'passed' : 'failed',
  findingCount: findings.length,
  findings,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[supply-chain-guard] checando manifests e scripts de dependencies');
  if (findings.length === 0) {
    console.log('[supply-chain-guard] ok none risk de supply chain detectado');
  } else {
    console.log(`[supply-chain-guard] fail ${findings.length} achado(s)`);
    for (const finding of findings.slice(0, 30)) {
      console.log(`  - ${finding.file}:${finding.line} [${finding.rule}] ${finding.detail}`);
    }
  }
}

if (findings.length > 0) {
  process.exitCode = 1;
}

function readPackageManifests() {
  const tracked = readGitPaths(['ls-files', '-z', '**/package.json', 'package.json']);
  const untracked = includeUntracked
    ? readGitPaths(['ls-files', '--others', '--exclude-standard', '-z', '**/package.json', 'package.json'])
    : [];
  return Array.from(new Set([...tracked, ...untracked]))
    .map(normalizePath)
    .filter((relativePath) => relativePath.endsWith('package.json'))
    .filter((relativePath) => !isIgnoredPath(relativePath));
}

function readGitPaths(args) {
  try {
    return execFileSync('git', args, {
      cwd: workspaceRoot,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    }).split('\0').filter(Boolean);
  } catch {
    return [];
  }
}

function scanPackageManifests(files) {
  const results = [];
  for (const relativePath of files) {
    const absolutePath = path.join(workspaceRoot, relativePath);
    const raw = readTextFile(absolutePath);
    if (raw === null) {
      continue;
    }
    let manifest;
    try {
      manifest = JSON.parse(raw);
    } catch {
      results.push({
        file: relativePath,
        line: 1,
        rule: 'invalid-package-json',
        detail: 'invalid package.json blocks supply-chain audit',
      });
      continue;
    }
    results.push(...scanScripts(relativePath, raw, manifest.scripts));
    results.push(...scanDependencySpecs(relativePath, raw, manifest));
  }
  return results;
}

function scanScripts(relativePath, raw, scripts) {
  if (!scripts || typeof scripts !== 'object') {
    return [];
  }
  const results = [];
  for (const [name, command] of Object.entries(scripts)) {
    if (typeof command !== 'string') {
      continue;
    }
    const line = findLine(raw, `"${escapeJson(name)}"`);
    if (LIFECYCLE_SCRIPTS.has(name) && !isLifecycleAllowed(relativePath, name, command)) {
      results.push({
        file: relativePath,
        line,
        rule: 'package-lifecycle-script',
        detail: `${name} scripts executam durante install/publish e exigunder review explicit`,
      });
    }
    if (REMOTE_SCRIPT_RE.test(command)) {
      results.push({
        file: relativePath,
        line,
        rule: 'remote-script-execution',
        detail: `${name} downloads remote content and chains it to shell`,
      });
    }
    if (OPAQUE_SHELL_RE.test(command)) {
      results.push({
        file: relativePath,
        line,
        rule: 'encoded-shell-command',
        detail: `${name} usa comando shell codificado/opaco`,
      });
    }
  }
  return results;
}

function scanDependencySpecs(relativePath, raw, manifest) {
  const results = [];
  for (const section of DEPENDENCY_SECTIONS) {
    const dependencies = manifest[section];
    if (!dependencies || typeof dependencies !== 'object') {
      continue;
    }
    for (const [name, spec] of Object.entries(dependencies)) {
      if (typeof spec !== 'string') {
        continue;
      }
      const line = findLine(raw, `"${escapeJson(name)}"`);
      if (RISKY_SPEC_RE.test(spec)) {
        results.push({
          file: relativePath,
          line,
          rule: 'risky-dependency-spec',
          detail: `${section}.${name} uses non-registry origin (${redactSpec(spec)})`,
        });
      }
      if (UNPINNED_SPEC_RE.test(spec)) {
        const key = `${normalizePath(relativePath)}:${section}.${name}`;
        if (!UNPINNED_ALLOWLIST.has(key)) {
          results.push({
            file: relativePath,
            line,
            rule: 'unpinned-dependency-spec',
            detail: `${section}.${name} uses non-deterministic version (${spec})`,
          });
        }
      }
    }
  }
  return results;
}

function readTextFile(absolutePath) {
  try {
    const buffer = fs.readFileSync(absolutePath);
    if (buffer.includes(0)) {
      return null;
    }
    return buffer.toString('utf8');
  } catch {
    return null;
  }
}

function isIgnoredPath(relativePath) {
  const normalized = normalizePath(relativePath);
  return normalized.startsWith('node_modules/')
    || normalized.startsWith('.git/')
    || normalized.startsWith('dist/')
    || normalized.startsWith('dist-ops/')
    || normalized.startsWith('coverage/')
    || normalized.startsWith('.tmp/');
}

function findLine(raw, needle) {
  const index = raw.indexOf(needle);
  if (index < 0) {
    return 1;
  }
  return raw.slice(0, index).split(/\r...\n/).length;
}

function escapeJson(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function redactSpec(spec) {
  if (/^https?:/i.test(spec)) {
    return spec.replace(/^(https?:\/\/)[^/@]+@/i, '$1[redacted]@');
  }
  if (/^(?:git\+ssh|ssh):/i.test(spec)) {
    return '[redacted-remote-git-spec]';
  }
  return spec;
}
