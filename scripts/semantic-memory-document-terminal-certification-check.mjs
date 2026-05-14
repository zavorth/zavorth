import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const requiredFiles = [
  'src/contracts/ZavorthSemanticMemoryDocumentTerminalCertificationContract.ts',
  'src/services/ZavorthSemanticMemoryDocumentTerminalCertificationService.ts',
  'scripts/semantic-memory-document-terminal-certification.ts',
  'scripts/semantic-memory-document-terminal-certification-check.mjs',
  'src/sdk/semantic-memory-document-terminal-certification.ts',
  'tests/services/ZavorthSemanticMemoryDocumentTerminalCertificationService.test.ts',
  'docs/README.md',
];

const checks = [];

function addCheck(name, ok, detail) {
  checks.push({ name, ok, detail });
  const prefix = ok ? 'ok' : 'fail';
  console.log(`[semantic-memory-document-terminal-certification] ${prefix} ${name}: ${detail}`);
}

function read(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

addCheck(
  'S5 files exist',
  requiredFiles.every((file) => existsSync(file)),
  `${requiredFiles.filter((file) => existsSync(file)).length}/${requiredFiles.length} file(s) present`,
);

const contract = read('src/contracts/ZavorthSemanticMemoryDocumentTerminalCertificationContract.ts');
addCheck(
  'Contract captures semantic memory document search terminal claims',
  [
    'ZAVORTH_SEMANTIC_MEMORY_DOCUMENT_TERMINAL_CERTIFICATION_CONTRACT_VERSION',
    'ZavorthSemanticMemoryDocumentTerminalClaim',
    'memory-runtime',
    'document-extraction',
    'search-fetch-policy',
    'proxy-policy',
    'shell-safety-policy',
    'terminal-runtime',
    'unsafe-operation-policy',
    'gapsBlockRelease',
  ].every((marker) => contract.includes(marker)),
  'contract includes package, memory, document, search, proxy, shell, terminal and release-blocking vocabulary',
);

const service = read('src/services/ZavorthSemanticMemoryDocumentTerminalCertificationService.ts');
addCheck(
  'Service certifies guarded Phase 5 runtime semantics',
  [
    'SourceMemoryDocumentTerminalPackService',
    'SourceSearchFetchService',
    'GovernedTerminalRuntime',
    'ShellSafetyClassifier',
    'packageClaim',
    'memoryClaims',
    'documentClaim',
    'searchClaim',
    'terminalClaim',
    'unsafeOperationClaims',
  ].every((marker) => service.includes(marker)),
  'service converts Phase 5 evidence into behavior-level semantic claims',
);

const command = read('scripts/semantic-memory-document-terminal-certification.ts');
addCheck(
  'Command exposes text JSON source-root and require-pass',
  ['--json', '--require-pass', '--source-root', '--zavorth-root'].every((marker) => command.includes(marker)),
  'operator command supports text, JSON, source-root, zavorth-root and fail-fast mode',
);

const packageJson = read('package.json');
addCheck(
  'package exposes S5 scripts and SDK subpath',
  [
    'semantic-memory-document-terminal-certification',
    'semantic-memory-document-terminal-certification:json',
    'semantic-memory-document-terminal-certification:check',
    'qa:semantic-memory-document-terminal-certification',
    './sdk/semantic-memory-document-terminal-certification',
  ].every((marker) => packageJson.includes(marker)),
  'package scripts and public SDK export are registered',
);

const runtime = spawnSync(
  process.execPath,
  [
    path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/semantic-memory-document-terminal-certification.ts',
    '--json',
    '--require-pass',
  ],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  },
);

if (runtime.status !== 0) {
  addCheck(
    'Runtime S5 semantic receipt passes',
    false,
    `command exited ${runtime.status}; ${runtime.stderr || runtime.stdout}`.slice(0, 2000),
  );
} else {
  try {
    const snapshot = JSON.parse(runtime.stdout);
    const receiptIdsValid = snapshot.claims.every((claim) => (
      Array.isArray(claim.receiptIds)
      && claim.receiptIds.length > 0
      && claim.receiptIds.every((id) => typeof id === 'string' && id.trim().length > 0)
    ));
    const claimIdsUnique = new Set(snapshot.claims.map((claim) => claim.id)).size === snapshot.claims.length;
    addCheck(
      'Runtime S5 semantic receipt passes',
      snapshot.status === 'passed'
        && snapshot.summary.gaps === 0
        && snapshot.summary.semanticClaims > 0
        && snapshot.summary.receiptBackedClaims === snapshot.summary.semanticClaims
        && snapshot.summary.liveNetworkPerformed === false
        && snapshot.summary.liveProcessSpawnedByDefault === false
        && snapshot.summary.secretValuesSerialized === false
        && snapshot.summary.memoryClaimsCertified >= 2
        && snapshot.summary.documentClaimsCertified >= 2
        && snapshot.summary.terminalClaimsCertified >= 2
        && receiptIdsValid
        && claimIdsUnique,
      `status=${snapshot.status}, claims=${snapshot.summary.semanticClaims}, gaps=${snapshot.summary.gaps}, receiptIdsValid=${receiptIdsValid}, claimIdsUnique=${claimIdsUnique}, next=${snapshot.commands.nextPhase}`,
    );
  } catch (error) {
    addCheck('Runtime S5 semantic receipt passes', false, `invalid JSON: ${error.message}`);
  }
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`[semantic-memory-document-terminal-certification] ${failed.length} check(s) failed`);
  process.exitCode = 1;
}
