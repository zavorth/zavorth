#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const rules = [
  ruleFilesExist(),
  ruleContainsMarkers(),
  rulePackageScripts(),
  ruleWorkspaceCheck(),
  ruleSnapshot(),
];
const failed = rules.filter((entry) => entry.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length === 0 ? 'passed' : 'failed',
  summary: { rules: rules.length, passed: rules.length - failed.length, failed: failed.length },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-documentation-repo-final] checking Phase 15');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-documentation-repo-final] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 20)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthDocumentationRepoFinalContract.ts',
    'src/services/ZavorthDocumentationRepoFinalService.ts',
    'scripts/zavorth-documentation-repo-final.ts',
    'scripts/zavorth-documentation-repo-final-check.mjs',
    'tests/services/ZavorthDocumentationRepoFinalService.test.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule(
    'phase-15-files',
    'Phase 15 files exist',
    missing.length === 0,
    `${files.length - missing.length}/${files.length}`,
    'contract, service, CLI, check and tests are present',
    missing,
  );
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthDocumentationRepoFinalContract.ts', [
      'ZAVORTH_DOCUMENTATION_REPO_FINAL_CONTRACT_VERSION',
      'dashboardIsPrimarySurface',
      'docsDoNotPublishPhaseDiaries',
      'publicIdentityIsZavorthNative',
      'proprietaryDistributionIsExplicit',
    ]],
    ['src/services/ZavorthDocumentationRepoFinalService.ts', [
      'docs-public-repo-audit.mjs',
      'zavorth-public-identity-scan.mjs',
      'zavorth-live-certification-matrix-check.mjs',
      'Old phase/root noise files are gone',
      'README and public docs are product-facing',
      'Surface posture is unambiguous',
      'Package and brand assets are product-ready',
    ]],
  ];
  const missing = [];
  for (const [file, markers] of checks) {
    const text = read(file);
    if (text === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const marker of markers) {
      if (!text.includes(marker)) missing.push(`${file}: missing ${marker}`);
    }
  }
  return rule(
    'phase-15-markers',
    'Final repo markers are wired',
    missing.length === 0,
    missing.length === 0 ? 'all markers' : `${missing.length} missing`,
    'repo/docs/product closure markers are represented',
    missing,
  );
}

function rulePackageScripts() {
  const scripts = JSON.parse(read('package.json') || '{}').scripts || {};
  const required = [
    'zavorth:documentation-repo-final',
    'zavorth:documentation-repo-final:json',
    'zavorth:documentation-repo-final:check',
    'daily:certify',
  ];
  const missing = required.filter((script) => !scripts[script]);
  return rule(
    'package-scripts',
    'Package scripts are wired',
    missing.length === 0,
    missing.length === 0 ? 'all scripts' : `${missing.length} missing`,
    required.join(', '),
    missing,
  );
}

function ruleWorkspaceCheck() {
  const pkg = JSON.parse(read('package.json') || '{}');
  const workspace = String(pkg.scripts?.['workspace:check'] || '');
  const daily = String(pkg.scripts?.['daily:certify'] || '');
  const failures = [];
  if (!workspace.includes('zavorth:documentation-repo-final:check')) failures.push('workspace:check missing documentation final gate');
  if (!daily.includes('zavorth:documentation-repo-final:check')) failures.push('daily:certify missing final closure gate');
  return rule(
    'workspace-check',
    'workspace and daily gates include Phase 15',
    failures.length === 0,
    failures.length === 0 ? 'wired' : `${failures.length} missing`,
    'workspace:check and daily:certify include final closure gate',
    failures,
  );
}

function ruleSnapshot() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-documentation-repo-final.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 180000,
  });
  if (result.status !== 0) {
    return rule('snapshot', 'Documentation repo final snapshot runs', false, `exit=${result.status}`, 'status=passed', [
      result.error?.message || result.stderr || result.stdout || 'no output',
    ]);
  }
  const data = parseJson(result.stdout);
  const pass = data
    && data.contractVersion === '2026-05-14.phase-15-documentation-repo-final'
    && data.status === 'passed'
    && data.summary?.publicDocsNeedingFix === 0
    && data.summary?.archiveOrDeleteCandidates === 0
    && data.summary?.moveInternalCandidates === 0
    && data.summary?.rootNoiseFilesPresent === 0
    && data.summary?.rawSecretsSerialized === false
    && data.summary?.workspaceMutationPerformed === false
    && data.summary?.externalIoPerformed === false
    && data.guarantees?.dashboardIsPrimarySurface === true
    && data.guarantees?.commandCenterCanExecute === false;
  return rule(
    'snapshot',
    'Documentation repo final snapshot runs',
    pass,
    data ? `status=${data.status}; checks=${data.summary?.passed}/${data.summary?.checks}; docs=${data.summary?.publicDocsAudited}` : 'invalid json',
    'final repo/docs/product closure snapshot is clean',
    pass ? [] : [result.stdout],
  );
}

function rule(id, label, passed, observed, target, details = []) {
  return { id, label, status: passed ? 'passed' : 'failed', observed, target, details };
}

function read(file) {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch {
    return null;
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
