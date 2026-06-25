import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const domainRoot = path.join(repoRoot, 'src', 'domain');
const baselinePath = path.join(repoRoot, 'docs', 'architecture', 'ddd-boundary-baseline.json');
const update = process.argv.includes('--update-baseline');

const bannedRoots = [
  'src/services',
  'src/runtime',
  'src/api',
  'src/config',
  'src/zavorth-control',
  'src/tools',
  'src/host',
  'src/providers',
  'src/observability',
];

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) return walk(fullPath);
    return fullPath.endsWith('.ts') ? [fullPath] : [];
  });
}

function isGuardedDomainFile(relativeFile) {
  const parts = relativeFile.split('/');
  if (parts.length < 3 || parts[0] !== 'src' || parts[1] !== 'domain') return false;
  const filename = parts.at(-1) || '';
  if (filename.endsWith('Facade.ts')) return true;
  const contextLocalParts = parts.slice(3);
  return contextLocalParts.includes('domain') || contextLocalParts.includes('application');
}

function isRelative(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

function resolveSpecifier(filePath, specifier) {
  if (!isRelative(specifier)) return null;
  const resolved = path.resolve(path.dirname(filePath), specifier);
  return toPosix(path.relative(repoRoot, resolved)).replace(/\\/g, '/').replace(/\.js$/, '.ts');
}

function isBannedTarget(resolvedSpecifier) {
  if (!resolvedSpecifier) return false;
  return bannedRoots.some((root) => resolvedSpecifier === root || resolvedSpecifier.startsWith(`${root}/`));
}

function collectViolations() {
  const importPattern = /^\s*(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm;
  const violations = [];

  for (const filePath of walk(domainRoot)) {
    const relativeFile = toPosix(path.relative(repoRoot, filePath));
    if (!isGuardedDomainFile(relativeFile)) continue;
    const source = readFileSync(filePath, 'utf8');
    let match;
    while ((match = importPattern.exec(source))) {
      const specifier = match[1];
      const resolved = resolveSpecifier(filePath, specifier);
      if (!isBannedTarget(resolved)) continue;
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      violations.push({
        file: relativeFile,
        line,
        specifier,
        target: resolved,
      });
    }
  }

  return violations.sort((a, b) => `${a.file}:${a.line}:${a.specifier}`.localeCompare(`${b.file}:${b.line}:${b.specifier}`));
}

function keyOf(violation) {
  return `${violation.file} -> ${violation.specifier}`;
}

const violations = collectViolations();

if (update) {
  mkdirSync(path.dirname(baselinePath), { recursive: true });
  writeFileSync(
    baselinePath,
    `${JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      intent: 'Legacy DDD boundary exceptions. New domain/application/facade imports into concrete runtime/services/config/api roots must not be added.',
      bannedRoots,
      exceptions: violations,
    }, null, 2)}\n`,
  );
  console.log(`DDD boundary baseline updated with ${violations.length} exception(s).`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`Missing DDD boundary baseline: ${toPosix(path.relative(repoRoot, baselinePath))}`);
  console.error('Run: node scripts/ddd-boundary-check.mjs --update-baseline');
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const allowed = new Set((baseline.exceptions || []).map(keyOf));
const newViolations = violations.filter((violation) => !allowed.has(keyOf(violation)));
const staleExceptions = (baseline.exceptions || []).filter((violation) => {
  const key = keyOf(violation);
  return !violations.some((current) => keyOf(current) === key);
});

if (newViolations.length > 0) {
  console.error('DDD boundary check failed: new domain boundary violation(s) found.');
  for (const violation of newViolations.slice(0, 25)) {
    console.error(`- ${violation.file}:${violation.line} imports ${violation.specifier} (${violation.target})`);
  }
  if (newViolations.length > 25) {
    console.error(`...and ${newViolations.length - 25} more.`);
  }
  process.exit(1);
}

if (staleExceptions.length > 0) {
  console.warn(`DDD boundary baseline has ${staleExceptions.length} stale exception(s). Run --update-baseline after intentional cleanup.`);
}

console.log(`DDD boundary check passed: ${violations.length} legacy exception(s), 0 new violation(s).`);
