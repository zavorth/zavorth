import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'src/contracts/LiveReadinessCertificationContract.ts',
  'src/services/LiveReadinessCertificationService.ts',
  'scripts/live-readiness-certify.ts',
  'scripts/live-readiness-certification-check.mjs',
  'tests/services/LiveReadinessCertificationService.test.ts',
  'docs/README.md',
  'src/sdk/contracts.ts',
  'src/sdk/index.ts',
  'package.json',
];

const checks = [];

for (const file of requiredFiles) {
  checks.push({
    name: `file:${file}`,
    passed: existsSync(join(root, file)),
    detail: `${file} must exist`,
  });
}

const contract = read('src/contracts/LiveReadinessCertificationContract.ts');
const service = read('src/services/LiveReadinessCertificationService.ts');
const script = read('scripts/live-readiness-certify.ts');
const tests = read('tests/services/LiveReadinessCertificationService.test.ts');
const docs = read('docs/README.md');
const sdkContracts = read('src/sdk/contracts.ts');
const sdkIndex = read('src/sdk/index.ts');
const pkg = read('package.json');

checks.push(
  has(contract, 'contract:version', '2026-05-05.live-checkpoint-13'),
  has(contract, 'contract:phase', 'Intent model3 - Live Consistency Certification'),
  has(contract, 'contract:profiles', 'staging-live', 'production-live'),
  has(contract, 'contract:inventory', 'sourceModules: number', 'providers: number', 'channels: number'),
  has(contract, 'contract:disallowed-status', 'misleadingAdapterBacked: 0', 'dryRunOnly: number', 'templateOnly: number', 'planned: number'),
  has(contract, 'contract:no-live-io', 'noLiveIoDuringCertification: true', 'productionLiveRequiresOperatorReceiptLedger: true'),
  has(service, 'service:phase-imports',
    'LiveReadinessService',
    'ChannelLiveActivationService',
    'ChannelLongTailActivationService',
    'ProviderRuntimeActivationService',
    'ProviderLongTailActivationService',
    'MediaGenerationLivePlaneService',
    'SpeechVoiceLivePlaneService',
    'WebResearchLivePlaneService',
    'FileDocumentDiffLivePlaneService',
    'DiagnosticsQaMigrationLivePlaneService',
    'SatelliteDeviceLivePlaneService',
    'MemoryArtifactsRuntimeLiveClosureService',
  ),
  has(service, 'service:summary-counts', 'acceptedSourceModules', 'providerRoutes', 'channelRoutes', 'livePhases: 12'),
  has(service, 'service:evidence',
    'absorbed-source-classification',
    'provider-channel-live-smokes',
    'signal-teams-not-outbox-only',
    'runtime-families-not-placeholder',
    'device-safety-and-trust',
    'memory-artifact-runtime-real-proof',
    'signed-scope-and-exclusions',
    'phase-check-command-coverage',
  ),
  has(service, 'service:truthfulness', 'signedExclusionsLedger', 'not-claimed-without-operator-live-receipts', 'not-executed-by-certification'),
  has(script, 'script:cli', '--profile', '--require-certified', 'formatCertificationText', 'production-live'),
  has(tests, 'tests:coverage', 'staging-live', 'production-live', 'signedExclusionsLedger', 'stagingLiveSmokeCommands'),
  has(docs, 'docs:ledger', 'Intent model3 - Live Consistency Certification', 'modules tracked', 'providers', 'channels', 'No live external IO'),
  has(sdkContracts, 'sdk:contract-export', 'LiveReadinessCertificationContract'),
  has(sdkIndex, 'sdk:service-export', 'LiveReadinessCertificationService'),
  has(pkg, 'package:scripts',
    'live-readiness-certify',
    'live-readiness-certify:json',
    'live-readiness-certification:check',
    'qa:live-readiness-certification',
  ),
);

const failed = checks.filter((check) => !check.passed);
if (failed.length > 0) {
  console.error('[live-readiness-certification-check] failed');
  for (const check of failed) {
    console.error(`- ${check.name}: ${check.detail}`);
  }
  process.exit(1);
}

console.log(`[live-readiness-certification-check] passed ${checks.length} checks`);

function read(file) {
  const path = join(root, file);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function has(content, name, ...needles) {
  const missing = needles.filter((needle) => !content.includes(needle));
  return {
    name,
    passed: missing.length === 0,
    detail: missing.length > 0 ? `missing ${missing.join(', ')}` : 'ok',
  };
}
