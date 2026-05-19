#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const write = args.has('--write');
const docsDir = path.join(root, 'docs');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const npmScripts = new Set(Object.keys(packageJson.scripts || {}));
const repoFiles = new Set(runGitLsFiles());
const docs = listMarkdown(docsDir).map((file) => auditDoc(file));
const signalDocs = docs.filter((doc) => doc.readinessSignals.total > 0);
const summary = summarize(signalDocs);
const report = {
  generatedAt: new Date().toISOString(),
  docsWithReadinessSignals: signalDocs.length,
  summary,
  docs: signalDocs,
};

if (write) {
  const outDir = path.join(root, '.tmp', 'repo-audit');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'docs-readiness-claim-audit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outDir, 'docs-readiness-claim-audit.md'), renderMarkdown(report), 'utf8');
}

if (asJson) console.log(JSON.stringify(report, null, 2));
else console.log(renderMarkdown(report));

function runGitLsFiles() {
  const result = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  return new Set(result.stdout.split(/\r?\n/).filter(Boolean).map((entry) => entry.replace(/\\/g, '/')));
}

function listMarkdown(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listMarkdown(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(full);
  }
  return files.sort((a, b) => rel(a).localeCompare(rel(b)));
}

function auditDoc(file) {
  const text = fs.readFileSync(file, 'utf8');
  const relative = rel(file);
  const readinessSignals = collectReadinessSignals(text);
  const refs = collectReferences(text);
  const implementedRefs = refs.filter((ref) => ref.exists).length;
  const missingRefs = refs.filter((ref) => !ref.exists);
  const checks = collectCheckCommands(text);
  const existingChecks = checks.filter((check) => check.exists).length;
  const missingChecks = checks.filter((check) => !check.exists);
  const status = classifyStatus({
    relative,
    readinessSignals,
    refs,
    missingRefs,
    checks,
    missingChecks,
    text,
  });
  return {
    file: relative,
    title: firstHeading(text),
    status,
    recommendation: recommendationFor(status),
    readinessSignals,
    refs: {
      total: refs.length,
      implemented: implementedRefs,
      missing: missingRefs.length,
      missingExamples: missingRefs.slice(0, 20),
    },
    checks: {
      total: checks.length,
      implemented: existingChecks,
      missing: missingChecks.length,
      missingExamples: missingChecks.slice(0, 20),
    },
    evidence: buildEvidence({ refs, checks, readinessSignals, text }),
  };
}

function collectReadinessSignals(text) {
  const terms = {
    planned: ['planned', 'future', 'futuro', 'planejado'],
    notImplemented: ['not implemented', 'nao implementado', 'não implementado', 'fixture-parity-covered'],
    todo: ['todo', 'pendente', 'pending', 'tbd'],
    stage: ['phase', 'etapa', 'wave'],
    gate: ['gate', 'readiness', 'canary', 'certification', 'certificacao', 'certificação'],
  };
  const lower = text.toLowerCase();
  const counts = {};
  let total = 0;
  for (const [key, values] of Object.entries(terms)) {
    counts[key] = values.reduce((sum, value) => sum + count(lower, value), 0);
    total += counts[key];
  }
  return { ...counts, total };
}

function collectReferences(text) {
  const refs = new Map();
  for (const value of extractCodeSpans(text)) {
    const cleaned = cleanRef(value);
    if (looksLikeRepoPath(cleaned)) refs.set(cleaned, { kind: 'path', value: cleaned, exists: repoPathExists(cleaned) });
    if (looksLikeClassOrService(cleaned)) {
      const exists = findSymbolFile(cleaned);
      refs.set(`symbol:${cleaned}`, { kind: 'symbol', value: cleaned, exists: Boolean(exists), file: exists || null });
    }
  }
  for (const value of extractLikelySymbols(text)) {
    const exists = findSymbolFile(value);
    refs.set(`symbol:${value}`, { kind: 'symbol', value, exists: Boolean(exists), file: exists || null });
  }
  return [...refs.values()].sort((a, b) => `${a.kind}:${a.value}`.localeCompare(`${b.kind}:${b.value}`));
}

function collectCheckCommands(text) {
  const checks = new Map();
  for (const match of text.matchAll(/npm\s+run\s+([A-Za-z0-9:_@./-]+)/g)) {
    const value = match[1];
    checks.set(`npm:${value}`, { kind: 'npm-script', value, exists: npmScripts.has(value) });
  }
  for (const match of text.matchAll(/node\s+(scripts\/[A-Za-z0-9._/@-]+\.mjs)/g)) {
    const value = match[1];
    checks.set(`node:${value}`, { kind: 'script-file', value, exists: repoPathExists(value) });
  }
  for (const match of text.matchAll(/npx\s+tsx\s+(scripts\/[A-Za-z0-9._/@-]+\.ts)/g)) {
    const value = match[1];
    checks.set(`tsx:${value}`, { kind: 'script-file', value, exists: repoPathExists(value) });
  }
  return [...checks.values()].sort((a, b) => `${a.kind}:${a.value}`.localeCompare(`${b.kind}:${b.value}`));
}

function classifyStatus(input) {
  const name = input.relative.toLowerCase();
  const refs = input.refs.length;
  const checks = input.checks.length;
  const missingRefs = input.missingRefs.length;
  const missingChecks = input.missingChecks.length;
  const implementationRatio = refs === 0 ? 0 : (refs - missingRefs) / refs;
  const checkRatio = checks === 0 ? 0 : (checks - missingChecks) / checks;

  if (input.readinessSignals.notImplemented > 0 && (implementationRatio < 0.55 || checkRatio < 0.55)) {
    return 'likely-not-implemented';
  }
  if ((name.includes('phase') || name.includes('wave') || name.includes('pack') || name.includes('private')) && implementationRatio >= 0.7 && (checks === 0 || checkRatio >= 0.7)) {
    return 'historical-implemented';
  }
  if (refs + checks === 0 && input.readinessSignals.total > 8) {
    return 'planning-only-no-verifiable-implementation';
  }
  if (missingRefs + missingChecks > 0 && implementationRatio < 0.7 && checkRatio < 0.7) {
    return 'stale-or-unimplemented';
  }
  if (missingRefs + missingChecks > 0) {
    return 'partially-stale';
  }
  return 'verifiable-or-historical';
}

function recommendationFor(status) {
  if (status === 'historical-implemented') return 'delete-or-archive-history';
  if (status === 'verifiable-or-historical') return 'archive-if-not-public';
  if (status === 'partially-stale') return 'fix-if-public-else-delete';
  if (status === 'planning-only-no-verifiable-implementation') return 'delete-or-rewrite-as-roadmap';
  if (status === 'likely-not-implemented') return 'do-not-publish-as-done';
  return 'review';
}

function buildEvidence({ refs, checks, readinessSignals, text }) {
  const implemented = refs.filter((ref) => ref.exists).slice(0, 8).map(formatRef);
  const missing = refs.filter((ref) => !ref.exists).slice(0, 8).map(formatRef);
  const existingChecks = checks.filter((check) => check.exists).slice(0, 8).map((check) => `${check.kind}:${check.value}`);
  const missingChecks = checks.filter((check) => !check.exists).slice(0, 8).map((check) => `${check.kind}:${check.value}`);
  const explicitNotImplementedLines = text.split(/\r?\n/)
    .filter((line) => /not implemented|fixture-parity-covered|nao implementado|não implementado|planned|future|pendente|pending/i.test(line))
    .slice(0, 6)
    .map((line) => line.trim());
  return {
    readinessSignals,
    implemented,
    missing,
    existingChecks,
    missingChecks,
    explicitNotImplementedLines,
  };
}

function formatRef(ref) {
  return ref.file ? `${ref.value} -> ${ref.file}` : `${ref.kind}:${ref.value}`;
}

function extractCodeSpans(text) {
  const values = [];
  for (const match of text.matchAll(/`([^`\n]+)`/g)) values.push(match[1].trim());
  return values;
}

function extractLikelySymbols(text) {
  const values = new Set();
  for (const match of text.matchAll(/\b([A-Z][A-Za-z0-9]+(?:Service|Contract|Adapter|Gateway|Runtime|Router|Tool|Manager|Controller|Registry|Policy|Doctor|Guard|Broker|Executor|Runner|Compiler|Presenter|Projection|Certification|Bridge))\b/g)) {
    values.add(match[1]);
  }
  return [...values];
}

function looksLikeClassOrService(value) {
  return /^[A-Z][A-Za-z0-9]+(?:Service|Contract|Adapter|Gateway|Runtime|Router|Tool|Manager|Controller|Registry|Policy|Doctor|Guard|Broker|Executor|Runner|Compiler|Presenter|Projection|Certification|Bridge)$/.test(value);
}

function looksLikeRepoPath(value) {
  return /^(src|docs|scripts|tests|config|skill-library|assets|packages|apps|bin|\.github|\.githooks)\//.test(value)
    || /\.(?:ts|tsx|js|mjs|json|md|yml|yaml|bat|ps1|sh)$/.test(value);
}

function cleanRef(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/:\d+(?::\d+)?$/, '')
    .replace(/[),.;]+$/, '')
    .trim();
}

function repoPathExists(value) {
  const cleaned = cleanRef(value);
  if (!cleaned || cleaned.includes('*') || cleaned.includes('{') || cleaned.includes('}')) return true;
  return fs.existsSync(path.join(root, cleaned));
}

function findSymbolFile(symbol) {
  const candidates = [
    `src/services/${symbol}.ts`,
    `src/contracts/${symbol}.ts`,
    `src/security/${symbol}.ts`,
    `src/runtime/agent/${symbol}.ts`,
    `src/tools/${symbol}.ts`,
    `src/gateways/${symbol}.ts`,
    `src/adapters/claude/${symbol}.ts`,
  ];
  for (const candidate of candidates) {
    if (repoFiles.has(candidate) || fs.existsSync(path.join(root, candidate))) return candidate;
  }
  const suffix = `${symbol}.ts`;
  for (const file of repoFiles) {
    if (file.endsWith(`/${suffix}`)) return file;
  }
  return null;
}

function summarize(items) {
  return {
    byStatus: countBy(items, 'status'),
    byRecommendation: countBy(items, 'recommendation'),
    likelyNotImplemented: items.filter((item) => item.status === 'likely-not-implemented').length,
    staleOrUnimplemented: items.filter((item) => item.status === 'stale-or-unimplemented').length,
    historicalImplemented: items.filter((item) => item.status === 'historical-implemented').length,
    partiallyStale: items.filter((item) => item.status === 'partially-stale').length,
  };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

function count(text, term) {
  return text.split(term.toLowerCase()).length - 1;
}

function firstHeading(text) {
  const line = text.split(/\r?\n/).find((entry) => /^#\s+/.test(entry));
  return line ? line.replace(/^#\s+/, '').trim() : '';
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function renderMarkdown(report) {
  const lines = [
    '# Zavorth Readiness Claim Audit',
    '',
    `Generated: ${report.generatedAt}`,
    `Docs with readiness signals: ${report.docsWithReadinessSignals}`,
    '',
    '## Summary',
    '',
    '```json',
    JSON.stringify(report.summary, null, 2),
    '```',
    '',
    '## Likely Not Implemented Or Unsafe To Publish As Done',
    '',
    ...section(report.docs, 'likely-not-implemented'),
    '',
    '## Stale Or Unimplemented',
    '',
    ...section(report.docs, 'stale-or-unimplemented'),
    '',
    '## Partially Stale',
    '',
    ...section(report.docs, 'partially-stale').slice(0, 120),
    '',
    '## Historical Implemented',
    '',
    ...section(report.docs, 'historical-implemented').slice(0, 160),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function section(items, status) {
  return items
    .filter((item) => item.status === status)
    .sort((a, b) =>
      (b.refs.missing + b.checks.missing + b.readinessSignals.notImplemented * 3 + b.readinessSignals.planned)
      - (a.refs.missing + a.checks.missing + a.readinessSignals.notImplemented * 3 + a.readinessSignals.planned))
    .map((item) => [
      `- ${item.file}: ${item.recommendation}; refs ${item.refs.implemented}/${item.refs.total}; checks ${item.checks.implemented}/${item.checks.total}`,
      item.evidence.explicitNotImplementedLines.length ? `  - signals: ${item.evidence.explicitNotImplementedLines.slice(0, 3).join(' | ')}` : null,
      item.evidence.missing.length ? `  - missing refs: ${item.evidence.missing.slice(0, 4).join(', ')}` : null,
      item.evidence.missingChecks.length ? `  - missing checks: ${item.evidence.missingChecks.slice(0, 4).join(', ')}` : null,
    ].filter(Boolean).join('\n'));
}
