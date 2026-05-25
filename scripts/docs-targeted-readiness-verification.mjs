#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const write = args.has('--write');
const sourcePath = path.join(root, '.tmp', 'repo-audit', 'docs-readiness-claim-audit.json');

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Missing ${sourcePath}. Run scripts/docs-readiness-claim-audit.mjs --write first.`);
}

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const npmScripts = new Set(Object.keys(packageJson.scripts || {}));
const trackedFiles = runGitLsFiles();
const sourceTextIndex = buildSourceTextIndex();

const targetStatuses = new Set([
  'partially-stale',
  'stale-or-unimplemented',
  'planning-only-no-verifiable-implementation',
  'likely-not-implemented',
]);

const targetDocs = source.docs
  .filter((doc) => targetStatuses.has(doc.status))
  .map((doc) => verifyDoc(doc))
  .sort((a, b) => a.file.localeCompare(b.file));

const report = {
  generatedAt: new Date().toISOString(),
  sourceGeneratedAt: source.generatedAt,
  targetCount: targetDocs.length,
  summary: summarize(targetDocs),
  docs: targetDocs,
};

if (write) {
  const outDir = path.join(root, '.tmp', 'repo-audit');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'docs-targeted-readiness-verification.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outDir, 'docs-targeted-readiness-verification.md'), renderMarkdown(report), 'utf8');
}

console.log(renderMarkdown(report));

function verifyDoc(doc) {
  const filePath = path.join(root, doc.file);
  const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const refs = collectRefs(text);
  const checks = collectChecks(text);
  const explicitLines = collectExplicitLines(text);
  const publicLike = isPublicLike(doc.file);
  const historicalLike = isHistoricalLike(doc.file);
  const notReadyLineCount = explicitLines.filter((line) => /not implemented|nao implementado|não implementado|fixture-parity-covered|planned|future|futuro|planejado|pending|pendente|todo|tbd/i.test(line)).length;

  const implementedRefs = refs.filter((ref) => ref.exists).length;
  const implementedChecks = checks.filter((check) => check.exists).length;
  const refRatio = refs.length === 0 ? 1 : implementedRefs / refs.length;
  const checkRatio = checks.length === 0 ? 1 : implementedChecks / checks.length;
  const unresolved = refs.filter((ref) => !ref.exists).length + checks.filter((check) => !check.exists).length;

  const currentEvidence = inferCurrentEvidence(text, doc.file);
  const decision = decide({
    doc,
    publicLike,
    historicalLike,
    refRatio,
    checkRatio,
    unresolved,
    notReadyLineCount,
    currentEvidence,
  });

  return {
    file: doc.file,
    title: doc.title,
    previousStatus: doc.status,
    decision,
    publicLike,
    historicalLike,
    readinessSignals: doc.readinessSignals,
    verification: {
      refsTotal: refs.length,
      refsCurrent: implementedRefs,
      checksTotal: checks.length,
      checksCurrent: implementedChecks,
      unresolved,
      explicitNotReadyLines: notReadyLineCount,
      currentEvidence,
    },
    unresolvedExamples: {
      refs: refs.filter((ref) => !ref.exists).slice(0, 12),
      checks: checks.filter((check) => !check.exists).slice(0, 12),
      explicitLines: explicitLines.slice(0, 8),
    },
    action: actionFor(decision, publicLike),
  };
}

function collectRefs(text) {
  const refs = new Map();
  for (const raw of extractCodeSpans(text)) {
    const value = clean(raw);
    if (looksLikePath(value)) {
      refs.set(`path:${value}`, { kind: 'path', value, exists: pathExists(value), evidence: null });
    }
    if (looksLikeSymbol(value)) {
      const evidence = symbolEvidence(value);
      refs.set(`symbol:${value}`, { kind: 'symbol', value, exists: Boolean(evidence), evidence });
    }
  }
  for (const symbol of extractSymbols(text)) {
    const evidence = symbolEvidence(symbol);
    refs.set(`symbol:${symbol}`, { kind: 'symbol', value: symbol, exists: Boolean(evidence), evidence });
  }
  return [...refs.values()].sort((a, b) => `${a.kind}:${a.value}`.localeCompare(`${b.kind}:${b.value}`));
}

function collectChecks(text) {
  const checks = new Map();
  for (const match of text.matchAll(/npm\s+run\s+([A-Za-z0-9:_@./-]+)/g)) {
    const value = match[1];
    checks.set(`npm:${value}`, { kind: 'npm-script', value, exists: npmScripts.has(value) });
  }
  for (const match of text.matchAll(/(?:node|tsx|npx\s+tsx)\s+(scripts\/[A-Za-z0-9._/@-]+\.(?:mjs|ts|js))/g)) {
    const value = match[1];
    checks.set(`script:${value}`, { kind: 'script-file', value, exists: pathExists(value) });
  }
  return [...checks.values()].sort((a, b) => `${a.kind}:${a.value}`.localeCompare(`${b.kind}:${b.value}`));
}

function collectExplicitLines(text) {
  return text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /not implemented|nao implementado|não implementado|fixture-parity-covered|planned|future|futuro|planejado|pending|pendente|todo|tbd|next gate|future gate|futura|próxima etapa|proximo passo/i.test(line))
    .slice(0, 30);
}

function decide(input) {
  if (input.doc.status === 'likely-not-implemented') return 'actual-gap-or-private-audit-remove-from-public';
  if (input.doc.status === 'planning-only-no-verifiable-implementation') return 'planning-only-remove-or-roadmap';
  if (input.historicalLike && input.currentEvidence.length > 0 && input.refRatio >= 0.55 && input.checkRatio >= 0.55) return 'implemented-history-remove-from-public';
  if (input.historicalLike && input.refRatio >= 0.4 && input.checkRatio >= 0.5) return 'mostly-implemented-history-review-then-remove';
  if (input.publicLike && input.unresolved > 0) return 'public-doc-stale-rewrite-against-current-repo';
  if (input.currentEvidence.length > 0 && input.unresolved > 0) return 'capability-present-doc-stale';
  if (input.unresolved > 0) return 'unverified-stale-or-gap';
  return 'current-but-not-public-surface';
}

function actionFor(decision, publicLike) {
  if (decision === 'actual-gap-or-private-audit-remove-from-public') return 'remove from public docs; keep only internal/private if still useful';
  if (decision === 'planning-only-remove-or-roadmap') return 'delete unless this becomes an explicit roadmap';
  if (decision.includes('history')) return 'delete/archive as phase history';
  if (decision === 'public-doc-stale-rewrite-against-current-repo') return 'rewrite as official doc using current scripts/classes';
  if (decision === 'capability-present-doc-stale') return publicLike ? 'rewrite' : 'delete/archive';
  if (decision === 'unverified-stale-or-gap') return 'manual owner decision: implement missing item or delete stale plan';
  return publicLike ? 'keep after copy polish' : 'archive if not official';
}

function inferCurrentEvidence(text, file) {
  const haystack = `${file}\n${text}`.toLowerCase();
  const checks = [
    ['scheduled-tasks', ['ZavorthScheduledTaskContract', 'ZavorthScheduledTaskExecutionGatewayRuntimeService', 'zavorth-scheduled-task-runtime-check.mjs']],
    ['subagents', ['ZavorthSubagentRuntimeService', 'ZavorthSubagentInvocationGatewayService', 'zavorth-subagents.ts']],
    ['skills', ['UniversalSkillIntakeService', 'UniversalSkillTrustImportService', 'UniversalSkillBridgeRuntimeService', 'zavorth-universal-skill-intake.ts']],
    ['large-skill-absorption', ['ZavorthLargeSkillAbsorptionService', 'zavorth-large-skill-absorption.ts']],
    ['perception-control', ['ZavorthPerceptionInvocationRouter', 'zavorth-perception-certification-check.mjs', 'ZavorthAndroidAdbBridgeService']],
    ['channel-capability', ['ChannelCapabilityContract', 'ZavorthChannelCapabilityAwarenessService', 'zavorth-channel-capability-awareness-check.mjs']],
    ['acp-bridge', ['ZavorthAcpBridgeContract', 'AcpxBridgeRuntimeAdapter', 'src/ai-gateway/lib/acp']],
    ['agent-run-resilience', ['AgentRunService', 'ZavorthContextRecoveryAssimilationService', 'zavorth-context-recovery-assimilation-check.mjs']],
    ['security-policy', ['SecurityPolicyBroker', 'ToolApprovalEnvelope', 'DangerousCommandBlocker']],
    ['dashboard', ['DashboardService', 'NexusCockpitSummary', 'Dashboard']],
  ];

  const evidence = [];
  for (const [topic, markers] of checks) {
    if (!markers.some((marker) => haystack.includes(marker.toLowerCase()))) continue;
    const existing = markers.filter((marker) => markerExists(marker));
    if (existing.length) evidence.push({ topic, existing });
  }
  return evidence;
}

function markerExists(marker) {
  if (marker.includes('/')) return pathExists(marker);
  if (marker.endsWith('.mjs') || marker.endsWith('.ts')) return [...trackedFiles].some((file) => file.endsWith(marker));
  return Boolean(symbolEvidence(marker));
}

function renderMarkdown(report) {
  const lines = [
    '# Zavorth Targeted Readiness Verification',
    '',
    `Generated: ${report.generatedAt}`,
    `Source audit: ${report.sourceGeneratedAt}`,
    `Docs verified: ${report.targetCount}`,
    '',
    '## Summary',
    '',
    '```json',
    JSON.stringify(report.summary, null, 2),
    '```',
    '',
    '## Decisions',
    '',
  ];
  for (const [decision, items] of Object.entries(groupBy(report.docs, 'decision'))) {
    lines.push(`### ${decision} (${items.length})`, '');
    for (const item of items) {
      lines.push(`- ${item.file} | refs ${item.verification.refsCurrent}/${item.verification.refsTotal} | checks ${item.verification.checksCurrent}/${item.verification.checksTotal} | action: ${item.action}`);
      if (item.unresolvedExamples.explicitLines.length) {
        lines.push(`  - signals: ${item.unresolvedExamples.explicitLines.slice(0, 2).join(' | ')}`);
      }
      if (item.unresolvedExamples.refs.length) {
        lines.push(`  - missing refs: ${item.unresolvedExamples.refs.slice(0, 4).map((ref) => `${ref.kind}:${ref.value}`).join(', ')}`);
      }
      if (item.unresolvedExamples.checks.length) {
        lines.push(`  - missing checks: ${item.unresolvedExamples.checks.slice(0, 4).map((check) => `${check.kind}:${check.value}`).join(', ')}`);
      }
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function summarize(items) {
  return {
    byDecision: countBy(items, 'decision'),
    byAction: countBy(items, 'action'),
    publicLike: items.filter((item) => item.publicLike).length,
    historicalLike: items.filter((item) => item.historicalLike).length,
    totalUnresolvedRefs: items.reduce((sum, item) => sum + (item.verification.refsTotal - item.verification.refsCurrent), 0),
    totalUnresolvedChecks: items.reduce((sum, item) => sum + (item.verification.checksTotal - item.verification.checksCurrent), 0),
  };
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key];
    (acc[value] ||= []).push(item);
    return acc;
  }, {});
}

function countBy(items, key) {
  return Object.fromEntries(Object.entries(groupBy(items, key)).map(([value, entries]) => [value, entries.length]));
}

function runGitLsFiles() {
  const result = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  return new Set(result.stdout.split(/\r?\n/).filter(Boolean).map((entry) => entry.replace(/\\/g, '/')));
}

function buildSourceTextIndex() {
  const files = [...trackedFiles].filter((file) =>
    /^(src|scripts|tests|packages|apps)\//.test(file)
    && /\.(?:ts|tsx|js|mjs|json)$/.test(file)
    && fs.existsSync(path.join(root, file))
  );
  return files.map((file) => {
    let text = '';
    try {
      text = fs.readFileSync(path.join(root, file), 'utf8');
    } catch {
      text = '';
    }
    return { file, text };
  });
}

function symbolEvidence(symbol) {
  const direct = [
    `src/services/${symbol}.ts`,
    `src/contracts/${symbol}.ts`,
    `src/security/${symbol}.ts`,
    `src/runtime/agent/${symbol}.ts`,
    `src/tools/${symbol}.ts`,
    `src/adapters/claude/${symbol}.ts`,
  ].find((candidate) => pathExists(candidate));
  if (direct) return direct;
  const suffix = `${symbol}.ts`;
  const byName = [...trackedFiles].find((file) => file.endsWith(`/${suffix}`));
  if (byName) return byName;
  const re = new RegExp(`\\b${escapeRegExp(symbol)}\\b`);
  const hit = sourceTextIndex.find((entry) => re.test(entry.text));
  return hit ? hit.file : null;
}

function pathExists(value) {
  const cleaned = clean(value);
  if (!cleaned || /[{}*<>]/.test(cleaned)) return false;
  if (trackedFiles.has(cleaned)) return true;
  if (fs.existsSync(path.join(root, cleaned))) return true;
  const basename = path.basename(cleaned);
  if (!basename || basename === cleaned) return false;
  return [...trackedFiles].some((file) => file.endsWith(`/${basename}`));
}

function extractCodeSpans(text) {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((match) => match[1].trim());
}

function extractSymbols(text) {
  return [...new Set([...text.matchAll(/\b([A-Z][A-Za-z0-9]+(?:Service|Contract|Adapter|Gateway|Runtime|Router|Tool|Manager|Controller|Registry|Policy|Doctor|Guard|Broker|Executor|Runner|Compiler|Presenter|Projection|Certification|Bridge))\b/g)].map((match) => match[1]))];
}

function looksLikeSymbol(value) {
  return /^[A-Z][A-Za-z0-9]+(?:Service|Contract|Adapter|Gateway|Runtime|Router|Tool|Manager|Controller|Registry|Policy|Doctor|Guard|Broker|Executor|Runner|Compiler|Presenter|Projection|Certification|Bridge)$/.test(value);
}

function looksLikePath(value) {
  return /^(src|docs|scripts|tests|config|skill-library|assets|packages|apps|bin|\.github|\.githooks|data)\//.test(value)
    || /\.(?:ts|tsx|js|mjs|json|md|yml|yaml|bat|ps1|sh|sqlite|db)$/.test(value);
}

function clean(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/:\d+(?::\d+)?$/, '')
    .replace(/[),.;]+$/, '')
    .trim();
}

function isPublicLike(file) {
  return /^docs\/(?:0[0-9]|1[0-6]|2[0-9]|3[0-9]|product\/|architecture\/|roadmap|README|quickstart|security|operations)/i.test(file)
    || ['docs/product-direction.md', 'docs/product-direction.md', 'docs/product-direction.md', 'docs/product-direction.md'].includes(file);
}

function isHistoricalLike(file) {
  return /(?:stage|legacy|pack|private|audit|readiness|certification|checklist|plan|roadmap|todo)/i.test(path.basename(file));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
