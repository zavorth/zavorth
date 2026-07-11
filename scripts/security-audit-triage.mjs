#!/usr/bin/env node
/**
 * S7 — dependency supply-chain triage for monorepo (and optional website path).
 *
 * Usage:
 *   node scripts/security-audit-triage.mjs
 *   node scripts/security-audit-triage.mjs --website "C:/path/to/zavorth-website"
 *   node scripts/security-audit-triage.mjs --omit-dev
 *
 * Exit 1 if high/critical remain in monorepo production deps (omit=dev).
 * Website findings are reported; static-export residual risk is annotated.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const omitDev = args.includes('--omit-dev') || !args.includes('--include-dev');
const websiteIdx = args.indexOf('--website');
const websitePath =
  websiteIdx >= 0 && args[websiteIdx + 1]
    ? path.resolve(args[websiteIdx + 1])
    : path.resolve(root, '..', 'zavorth-website');

function runAudit(cwd, label) {
  const npmArgs = ['audit', '--json'];
  if (omitDev) npmArgs.push('--omit=dev');
  const result = spawnSync('npm', npmArgs, {
    cwd,
    encoding: 'utf8',
    shell: true,
    maxBuffer: 20 * 1024 * 1024,
  });
  let report = {};
  try {
    report = JSON.parse(result.stdout || '{}');
  } catch {
    report = { parseError: true, stdout: String(result.stdout || '').slice(0, 500) };
  }
  const meta = report.metadata?.vulnerabilities || {};
  const summary = {
    label,
    cwd,
    info: meta.info || 0,
    low: meta.low || 0,
    moderate: meta.moderate || 0,
    high: meta.high || 0,
    critical: meta.critical || 0,
    exitCode: result.status,
  };
  const highCritical = [];
  const vulns = report.vulnerabilities || {};
  for (const [name, entry] of Object.entries(vulns)) {
    if (entry && (entry.severity === 'high' || entry.severity === 'critical')) {
      highCritical.push({
        name,
        severity: entry.severity,
        via: (entry.via || [])
          .slice(0, 3)
          .map((v) => (typeof v === 'string' ? v : v.title || v.name || 'advisory')),
        fixAvailable: entry.fixAvailable || false,
      });
    }
  }
  return { summary, highCritical, report };
}

function printSection(result) {
  const { summary, highCritical } = result;
  console.log(`\n[${summary.label}] ${summary.cwd}`);
  console.log(
    `  critical=${summary.critical} high=${summary.high} moderate=${summary.moderate} low=${summary.low} info=${summary.info}`,
  );
  if (highCritical.length) {
    for (const item of highCritical) {
      console.log(`  - ${item.severity.toUpperCase()} ${item.name}: ${item.via.join('; ')}`);
      console.log(`    fixAvailable=${JSON.stringify(item.fixAvailable)}`);
    }
  } else {
    console.log('  no high/critical packages');
  }
}

const mono = runAudit(root, 'monorepo');
printSection(mono);

let website = null;
if (fs.existsSync(path.join(websitePath, 'package.json'))) {
  website = runAudit(websitePath, 'website');
  printSection(website);
  if (website.summary.high > 0 || website.summary.critical > 0) {
    console.log(
      '\n[website note] Site uses next output: "export" (static). Many Next server/RSC advisories do not apply at runtime, but dependencies should still be kept current. Prefer latest patched Next 14.x/15.x when build gates stay green; avoid force-upgrade to major without QA.',
    );
  }
} else {
  console.log(`\n[website] skip — not found at ${websitePath}`);
}

const monoBad = mono.summary.critical > 0 || mono.summary.high > 0;
if (monoBad) {
  console.error('\n[security-audit-triage] FAIL: monorepo has high/critical production vulnerabilities');
  process.exit(1);
}

console.log('\n[security-audit-triage] PASS: monorepo production deps have no high/critical');
process.exit(0);
