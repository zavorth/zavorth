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
const scripts = new Set(Object.keys(packageJson.scripts || {}));
const tracked = new Set(runGitLsFiles());
const docs = listMarkdown(docsDir);
const rootNoiseFiles = [
  'HEARTBEAT.md',
  'NAMING_DECISION.md',
  'INTEGRATION_SUMMARY.md',
  'ZAVORTH_EVOLUTION.md',
  'ZAVORTH_EVOLUTION_CHECKLIST.md',
];

const audited = docs.map((file) => auditDoc(file));
const summary = summarize(audited);
const result = {
  generatedAt: new Date().toISOString(),
  root,
  totalDocs: audited.length,
  summary,
  rootNoise: rootNoiseFiles.map((file) => ({
    file,
    tracked: tracked.has(file),
    exists: fs.existsSync(path.join(root, file)),
    recommendation: 'delete',
  })),
  docs: audited,
};

if (write) {
  const outDir = path.join(root, '.tmp', 'repo-audit');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'docs-public-repo-audit.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outDir, 'docs-public-repo-audit.md'), renderMarkdown(result), 'utf8');
}

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(renderMarkdown(result));
}

function runGitLsFiles() {
  try {
    const result = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
    return result.stdout.split(/\r?\n/).filter(Boolean).map((entry) => entry.replace(/\\/g, '/'));
  } catch {
    return [];
  }
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

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function auditDoc(file) {
  const text = fs.readFileSync(file, 'utf8');
  const relative = rel(file);
  const links = extractMarkdownLinks(text);
  const pathRefs = extractPathRefs(text);
  const npmScripts = extractNpmScripts(text);
  const missingLinks = links
    .filter((link) => link.kind === 'local')
    .filter((link) => !localTargetExists(file, link.target))
    .map((link) => link.target);
  const missingPathRefs = [...new Set(pathRefs.filter((ref) => !repoPathExists(ref)))].sort();
  const missingNpmScripts = [...new Set(npmScripts.filter((script) => !scripts.has(script)))].sort();
  const staleSignals = countSignals(text, [
    'not implemented',
    'fixture-parity-covered',
    'planned',
    'future',
    'todo',
    'phase',
    'fase',
    'wave',
    'implementation pack',
    'readiness plan',
    'checklist',
  ]);
  const category = classifyDoc(relative, text);
  const recommendation = recommend({
    relative,
    category,
    missingLinks,
    missingPathRefs,
    missingNpmScripts,
    staleSignals,
  });

  return {
    file: relative,
    title: firstHeading(text),
    category,
    recommendation,
    sizeBytes: Buffer.byteLength(text, 'utf8'),
    localLinks: links.filter((link) => link.kind === 'local').length,
    missingLinks,
    pathRefs: pathRefs.length,
    missingPathRefs,
    npmScripts: npmScripts.length,
    missingNpmScripts,
    staleSignals,
  };
}

function extractMarkdownLinks(text) {
  const links = [];
  const regex = /\[[^\]]*]\(([^)]+)\)/g;
  for (const match of text.matchAll(regex)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('mailto:') || raw.startsWith('#')) {
      links.push({ kind: 'external', target: raw });
    } else {
      links.push({ kind: 'local', target: raw.split('#')[0] });
    }
  }
  return links;
}

function extractPathRefs(text) {
  const refs = new Set();
  const codeSpan = /`([^`\n]+)`/g;
  const likelyPath = /(?:^|[\s(["'])((?:src|docs|scripts|tests|config|skill-library|assets|packages|apps|bin|\.github|\.githooks)\/[A-Za-z0-9._/@() -]+|[A-Za-z0-9._-]+\.(?:ts|tsx|js|mjs|json|md|yml|yaml|bat|ps1|sh))(?:$|[\s)"',.;:])/g;
  for (const match of text.matchAll(codeSpan)) {
    const value = match[1].trim().replace(/\\/g, '/');
    if (looksLikePath(value)) refs.add(cleanRef(value));
  }
  for (const match of text.matchAll(likelyPath)) {
    const value = match[1].trim().replace(/\\/g, '/');
    if (looksLikePath(value)) refs.add(cleanRef(value));
  }
  return [...refs].filter(Boolean).sort();
}

function extractNpmScripts(text) {
  const refs = new Set();
  const regex = /npm\s+run\s+([A-Za-z0-9:_@./-]+)/g;
  for (const match of text.matchAll(regex)) refs.add(match[1]);
  return [...refs].sort();
}

function looksLikePath(value) {
  if (value.includes('://')) return false;
  if (value.startsWith('npm ')) return false;
  return /^(src|docs|scripts|tests|config|skill-library|assets|packages|apps|bin|\.github|\.githooks)\//.test(value)
    || /\.(?:ts|tsx|js|mjs|json|md|yml|yaml|bat|ps1|sh)$/.test(value);
}

function cleanRef(value) {
  return value
    .replace(/^\.?\//, '')
    .replace(/:\d+(?::\d+)?$/, '')
    .replace(/[),.;]+$/, '')
    .trim();
}

function repoPathExists(value) {
  const cleaned = cleanRef(value);
  if (!cleaned) return true;
  if (cleaned.includes('*') || cleaned.includes('{') || cleaned.includes('}')) return true;
  return fs.existsSync(path.join(root, cleaned));
}

function localTargetExists(fromFile, target) {
  if (!target) return true;
  const decoded = target.replace(/%20/g, ' ');
  const base = decoded.startsWith('/')
    ? path.join(root, decoded.slice(1))
    : path.resolve(path.dirname(fromFile), decoded);
  return fs.existsSync(base);
}

function classifyDoc(relative, text) {
  const name = path.basename(relative).toLowerCase();
  const full = relative.toLowerCase();
  if (/^(00|01|02|03|04|05|06|07|08|09|10)-/.test(name)) return 'public-core';
  if (['readme.md', 'self-modification.md', 'gateway-cli.md', 'gateway-control-api.md', 'provider-mesh.md', 'capability-plugins.md'].includes(name)) return 'public-support';
  if (full.includes('/architecture/')) return 'architecture-internal';
  if (name.includes('phase') || name.includes('wave') || name.includes('readiness') || name.includes('canary') || name.includes('gate') || name.includes('pack')) return 'phase-artifact';
  if (name.includes('todo') || name.includes('backlog') || name.includes('investigate')) return 'internal-worklog';
  if (text.includes('## Objetivo') || text.includes('## Entregas') || text.includes('Critério')) return 'implementation-plan';
  return 'uncategorized';
}

function recommend(input) {
  if (input.category === 'public-core' || input.category === 'public-support') {
    if (input.missingLinks.length || input.missingPathRefs.length || input.missingNpmScripts.length) return 'fix-public-doc';
    return 'keep-public';
  }
  if (input.category === 'phase-artifact' || input.category === 'implementation-plan' || input.category === 'internal-worklog') return 'archive-or-delete';
  if (input.category === 'architecture-internal') return 'move-internal';
  if (input.staleSignals > 12) return 'archive-or-delete';
  return 'review';
}

function countSignals(text, terms) {
  const lower = text.toLowerCase();
  return terms.reduce((count, term) => count + lower.split(term.toLowerCase()).length - 1, 0);
}

function firstHeading(text) {
  const line = text.split(/\r?\n/).find((entry) => /^#\s+/.test(entry));
  return line ? line.replace(/^#\s+/, '').trim() : '';
}

function summarize(items) {
  const byCategory = countBy(items, 'category');
  const byRecommendation = countBy(items, 'recommendation');
  const missingLinks = items.reduce((sum, item) => sum + item.missingLinks.length, 0);
  const missingPathRefs = items.reduce((sum, item) => sum + item.missingPathRefs.length, 0);
  const missingNpmScripts = items.reduce((sum, item) => sum + item.missingNpmScripts.length, 0);
  return {
    byCategory,
    byRecommendation,
    missingLinks,
    missingPathRefs,
    missingNpmScripts,
    publicDocsNeedingFix: items.filter((item) => item.recommendation === 'fix-public-doc').length,
    archiveOrDelete: items.filter((item) => item.recommendation === 'archive-or-delete').length,
    moveInternal: items.filter((item) => item.recommendation === 'move-internal').length,
  };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

function renderMarkdown(report) {
  const lines = [
    '# Zavorth Public Repo Documentation Audit',
    '',
    `Generated: ${report.generatedAt}`,
    `Docs audited: ${report.totalDocs}`,
    '',
    '## Summary',
    '',
    `- keep public: ${report.summary.byRecommendation['keep-public'] || 0}`,
    `- fix public docs: ${report.summary.publicDocsNeedingFix}`,
    `- move internal: ${report.summary.moveInternal}`,
    `- archive or delete: ${report.summary.archiveOrDelete}`,
    `- review: ${report.summary.byRecommendation.review || 0}`,
    `- missing local links: ${report.summary.missingLinks}`,
    `- missing path refs: ${report.summary.missingPathRefs}`,
    `- missing npm scripts: ${report.summary.missingNpmScripts}`,
    '',
    '## Root Noise',
    '',
    ...report.rootNoise.map((entry) => `- ${entry.file}: ${entry.exists ? 'exists' : 'missing'} / ${entry.tracked ? 'tracked' : 'untracked'} / ${entry.recommendation}`),
    '',
    '## Public Docs Needing Fix',
    '',
    ...top(report.docs.filter((item) => item.recommendation === 'fix-public-doc'), 80).map(renderDocLine),
    '',
    '## Archive Or Delete Candidates',
    '',
    ...top(report.docs.filter((item) => item.recommendation === 'archive-or-delete'), 160).map(renderDocLine),
    '',
    '## Move Internal Candidates',
    '',
    ...top(report.docs.filter((item) => item.recommendation === 'move-internal'), 80).map(renderDocLine),
    '',
    '## Highest Risk Missing References',
    '',
    ...top(report.docs.filter((item) => item.missingLinks.length || item.missingPathRefs.length || item.missingNpmScripts.length), 120)
      .map((item) => [
        `- ${item.file}: ${item.recommendation}`,
        item.missingLinks.length ? `  - missing links: ${item.missingLinks.slice(0, 8).join(', ')}` : null,
        item.missingPathRefs.length ? `  - missing paths: ${item.missingPathRefs.slice(0, 8).join(', ')}` : null,
        item.missingNpmScripts.length ? `  - missing npm scripts: ${item.missingNpmScripts.slice(0, 8).join(', ')}` : null,
      ].filter(Boolean).join('\n')),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderDocLine(item) {
  return `- ${item.file}: ${item.category}; missing links=${item.missingLinks.length}; missing paths=${item.missingPathRefs.length}; missing scripts=${item.missingNpmScripts.length}; stale=${item.staleSignals}`;
}

function top(items, limit) {
  return [...items]
    .sort((a, b) =>
      (b.missingLinks.length + b.missingPathRefs.length + b.missingNpmScripts.length + b.staleSignals)
      - (a.missingLinks.length + a.missingPathRefs.length + a.missingNpmScripts.length + a.staleSignals))
    .slice(0, limit);
}
