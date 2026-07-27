#!/usr/bin/env node
/**
 * Capability mesh - optional CI denylist: product-surface files must not reintroduce
 * competitor product branding in user-facing strings.
 *
 * Scans a curated allowlist of product paths (not entire monorepo / model catalogs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Case-insensitive patterns that should not appear in product surface copy. */
const DENY = [
  new RegExp('\\b' + 'open' + 'claw' + '\\b', 'i'),
  new RegExp('\\b' + 'github-' + 'open' + 'claw' + '\\b', 'i'),
  new RegExp('\\b' + 'hermes' + '-home' + '\\b', 'i'),
  new RegExp('\\b' + 'open' + 'claw' + '-home' + '\\b', 'i'),
  new RegExp('\\b' + 'generic-agent-home' + '\\b', 'i'),
  new RegExp('claude' + ' code' + ' project', 'i'),
  new RegExp('cursor' + ' project', 'i'),
  new RegExp('hermes' + '-style', 'i'),
  new RegExp('hermes' + ' parity', 'i'),
];

/** Only product surface for skill/worker groups — not provider adapters or model ids. */
const SCAN_GLOBS = [
  'src/services/SkillInstallPipelineService.ts',
  'src/services/SkillTrustScoreService.ts',
  'src/services/SkillExecutorBindingService.ts',
  'src/services/WorkerMeshService.ts',
  'src/services/WorkerDelegationRouterService.ts',
  'src/services/SkillWorkerDiscoveryService.ts',
  'src/services/AgentToolModelGuidance.ts',
  'src/services/AgentHarnessCredentialHints.ts',
  'src/tools/AgentManagerTool.ts',
  'src/tools/ZavorthSkillMarketplaceTool.ts',
  'src/skills/marketplace/SkillAutoApproval.ts',
  'src/runtime/agent/tools/ToolExposureProfile.ts',
  'docs/product/skills-universal-install.md',
  'docs/product/workers-mesh.md',
  'docs/product/skill-worker-mesh-qa-gate.md',
  'docs/agent-harness-readiness.md',
];

function collectFiles() {
  const out = [];
  for (const rel of SCAN_GLOBS) {
    const full = path.join(root, rel);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      out.push({ rel, full });
    }
  }
  return out;
}

const hits = [];
for (const { rel, full } of collectFiles()) {
  const text = fs.readFileSync(full, 'utf8');
  const lines = text.split(/\r...\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Allow comments that explicitly say "not competitor-brand" etc. — still flag positive branding.
    for (const re of DENY) {
      if (re.test(line)) {
        // Allow defensive sanitizers / denylist / "do not use brand X" documentation.
        if (
          /\b(no |without |never |not |removed |ban |denylist|avoid |neutraliz|sanitiz|strip |legacy brand)/i.test(line)
          || /\.test\(\s*label\s*\)/.test(line)
          || (new RegExp('\\/' + 'claude' + '\\|' + 'cursor' + '\\|' + 'open' + 'claw' + '\\|' + 'hermes' + '\\/', 'i')).test(line)
        ) {
          continue;
        }
        // Flag only user-facing string assignments of competitor product names.
        if (!(new RegExp('[\'"`][^\'"`]*(' + 'open' + 'claw' + '|' + 'hermes' + '-home|' + 'open' + 'claw' + '-home|' + 'claude' + ' code project|' + 'cursor' + ' project|' + 'hermes' + '-style)', 'i')).test(line)) {
          continue;
        }
        hits.push({ file: rel, line: i + 1, text: line.trim().slice(0, 160), pattern: String(re) });
      }
    }
  }
}

if (hits.length > 0) {
  console.error('Brand denylist FAIL — competitor product branding in skill/worker surface:\n');
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}`);
    console.error(`    ${h.text}`);
  }
  process.exit(1);
}

console.log(`Brand denylist OK (${collectFiles().length} files scanned, 0 hits)`);
