#!/usr/bin/env tsx
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ZavorthMnemosLintService } from '../src/services/ZavorthMnemosLintService.js';
import { ZavorthMnemosMemoryUxService } from '../src/services/ZavorthMnemosMemoryUxService.js';

type CheckStatus = 'passed' | 'failed';

type CertificationCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
};

type CertificationSnapshot = {
  version: 'zavorth-mnemos-certification-v1';
  generatedAt: string;
  status: 'passed' | 'failed';
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  checks: CertificationCheck[];
  safety: {
    providerCall: false;
    networkCall: false;
    durableMutation: false;
    certificationRunsLocalChecksOnly: true;
    identityHygieneChecked: true;
    secretsScanIncluded: true;
  };
  receipt: {
    id: string;
    providerCall: false;
    durableMutation: false;
  };
};

const CHECK_COMMANDS = [
  ['mnemos-memory-os', 'node', ['scripts/zavorth-mnemos-memory-os-check.mjs']],
  ['handoff-envelope', 'node', ['scripts/zavorth-handoff-envelope-check.mjs']],
  ['wiki-baseline', 'node', ['scripts/zavorth-mnemos-wiki-baseline-check.mjs']],
  ['ingest', 'node', ['scripts/zavorth-mnemos-ingest-check.mjs']],
  ['query', 'node', ['scripts/zavorth-mnemos-query-check.mjs']],
  ['lint', 'node', ['scripts/zavorth-mnemos-lint-check.mjs']],
  ['procedural', 'node', ['scripts/zavorth-mnemos-procedural-memory-check.mjs']],
  ['memory-ux', 'node', ['scripts/zavorth-mnemos-memory-ux-check.mjs']],
  ['dashboard-home', 'node', ['scripts/zavorth-dashboard-experience-home-check.mjs']],
  ['secrets', process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run security:secrets --silent'] : ['run', 'security:secrets', '--silent']],
] as const;

const REQUIRED_FILES = [
  'src/contracts/ZavorthMnemosMemoryOsContract.ts',
  'src/services/ContextCompactionService.ts',
  'src/contracts/ZavorthHandoffEnvelopeContract.ts',
  'src/services/ZavorthHandoffEnvelopeService.ts',
  '.zavorth/SCHEMA.md',
  '.zavorth/wiki/index.json',
  'src/services/ZavorthMnemosIngestService.ts',
  'src/services/ZavorthMnemosQueryService.ts',
  'src/services/ZavorthMnemosLintService.ts',
  'src/services/ZavorthMnemosProceduralMemoryService.ts',
  'src/services/ZavorthMnemosMemoryUxService.ts',
  'src/telegram/controllers/TelegramMnemosMemoryUxController.ts',
  'docs/42-mnemos-memory-os.md',
];

const FORBIDDEN_IDENTITY_PATTERNS = [
  /temp_[a-z0-9_-]*analysis/i,
  /non-native-skill-source/i,
  /third[_\s-]?party\s+source/i,
  /external\s+reference\s+library/i,
  /borrowed\s+from/i,
  /ported\s+from/i,
  /migrated\s+from/i,
];

function stableId(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function check(status: CheckStatus, id: string, label: string, detail: string): CertificationCheck {
  return { id, label, status, detail };
}

function runCommand(id: string, command: string, args: readonly string[]): CertificationCheck {
  const result = spawnSync(command, [...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 16,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim().split(/\r?\n/).slice(-4).join(' | ');
  return check(
    result.status === 0 ? 'passed' : 'failed',
    `command-${id}`,
    `${id} gate`,
    result.status === 0 ? output || 'ok' : `exit ${result.status}: ${output}`,
  );
}

function requiredFilesCheck(): CertificationCheck {
  const missing = REQUIRED_FILES.filter((file) => !fs.existsSync(path.resolve(file)));
  return check(
    missing.length === 0 ? 'passed' : 'failed',
    'required-files',
    'Required Mnemos files exist',
    missing.length === 0 ? `${REQUIRED_FILES.length} file(s) present` : `missing: ${missing.join(', ')}`,
  );
}

function packageScriptsCheck(): CertificationCheck {
  const packageJson = fs.existsSync('package.json') ? fs.readFileSync('package.json', 'utf8') : '';
  const scripts = [
    'zavorth:mnemos-memory-os:check',
    'zavorth:handoff-envelope:check',
    'zavorth:mnemos-wiki-baseline:check',
    'mnemos:ingest:check',
    'mnemos:query:check',
    'mnemos:lint:check',
    'mnemos:procedural:check',
    'mnemos:ux:check',
    'mnemos:certify',
    'mnemos:certify:check',
  ];
  const missing = scripts.filter((script) => !packageJson.includes(script));
  return check(
    missing.length === 0 ? 'passed' : 'failed',
    'package-scripts',
    'Package scripts expose Mnemos gates',
    missing.length === 0 ? `${scripts.length} script marker(s) present` : `missing: ${missing.join(', ')}`,
  );
}

function identityHygieneCheck(): CertificationCheck {
  const files = REQUIRED_FILES.filter((file) => fs.existsSync(file));
  const hits: string[] = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of FORBIDDEN_IDENTITY_PATTERNS) {
      if (pattern.test(content)) hits.push(`${file}:${pattern}`);
    }
  }
  return check(
    hits.length === 0 ? 'passed' : 'failed',
    'identity-hygiene',
    'Mnemos files remain product-native',
    hits.length === 0 ? 'no external conceptual markers in Mnemos files' : hits.join(', '),
  );
}

function runtimeSnapshotCheck(): CertificationCheck[] {
  const checks: CertificationCheck[] = [];
  const lint = new ZavorthMnemosLintService().lint();
  checks.push(check(
    lint.status === 'passed' ? 'passed' : 'failed',
    'wiki-lint-runtime',
    'Mnemos wiki lint runtime snapshot passes',
    `${lint.status}, findings=${lint.summary.findings}`,
  ));
  const ux = new ZavorthMnemosMemoryUxService().buildSnapshot();
  checks.push(check(
    ux.status === 'ready' && ux.safety.dashboardCanWriteMemory === false ? 'passed' : 'failed',
    'ux-runtime',
    'Mnemos UX runtime snapshot is governed',
    `${ux.status}, dashboardCanWriteMemory=${String(ux.safety.dashboardCanWriteMemory)}`,
  ));
  return checks;
}

function runtimeCheck(): CertificationCheck {
  try {
    execFileSync(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm run runtime:check --silent']
      : ['run', 'runtime:check', '--silent'], { stdio: 'pipe', encoding: 'utf8', maxBuffer: 1024 * 1024 * 16 });
    return check('passed', 'runtime-check', 'TypeScript runtime check', 'ok');
  } catch (error: any) {
    const output = String(error?.stdout || error?.stderr || error?.message || '').split(/\r?\n/).slice(0, 8).join(' | ');
    return check('failed', 'runtime-check', 'TypeScript runtime check', output || 'failed');
  }
}

function buildSnapshot(): CertificationSnapshot {
  const generatedAt = new Date().toISOString();
  const checks = [
    requiredFilesCheck(),
    packageScriptsCheck(),
    identityHygieneCheck(),
    ...runtimeSnapshotCheck(),
    ...CHECK_COMMANDS.map(([id, command, args]) => runCommand(id, command, args)),
    runtimeCheck(),
  ];
  const passed = checks.filter((entry) => entry.status === 'passed').length;
  const failed = checks.length - passed;
  return {
    version: 'zavorth-mnemos-certification-v1',
    generatedAt,
    status: failed === 0 ? 'passed' : 'failed',
    summary: {
      total: checks.length,
      passed,
      failed,
    },
    checks,
    safety: {
      providerCall: false,
      networkCall: false,
      durableMutation: false,
      certificationRunsLocalChecksOnly: true,
      identityHygieneChecked: true,
      secretsScanIncluded: true,
    },
    receipt: {
      id: `mnemos-certification-${stableId(`${generatedAt}:${passed}:${failed}`)}`,
      providerCall: false,
      durableMutation: false,
    },
  };
}

const json = process.argv.includes('--json');
const snapshot = buildSnapshot();

if (json) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  console.log(`Mnemos certification: ${snapshot.status}`);
  console.log(`Checks: ${snapshot.summary.passed}/${snapshot.summary.total} passed`);
  for (const entry of snapshot.checks) {
    console.log(`- [${entry.status}] ${entry.label}: ${entry.detail}`);
  }
}

if (snapshot.status !== 'passed') {
  process.exitCode = 1;
}
