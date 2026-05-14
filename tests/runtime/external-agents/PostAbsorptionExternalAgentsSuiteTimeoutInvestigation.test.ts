import fs from 'node:fs';
import path from 'node:path';

const DOC = 'docs/245-post-absorption-external-agents-suite-timeout-investigation.md';
const TODO = 'docs/todo-investigate-external-agents-full-suite-timeout.md';
const PACKAGE_JSON = 'package.json';
const SNAPSHOT_REPAIR_TEST =
  'tests/runtime/external-agents/ZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutable.test.ts';
const CONSUMER_EXPANSION_TEST =
  'tests/runtime/external-agents/ZavorthNativeRegistryConsumerExpansionPack.test.ts';
const PRODUCTION_PERSISTENCE_TEST =
  'tests/runtime/external-agents/ZavorthNativeRegistryProductionPersistenceFlagged.test.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{8,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{8,}/);
  expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  expect(serialized).not.toContain('<redacted-local-secret>');
}

describe('Post-absorption external-agents full suite timeout investigation', () => {
  it('documents the 245 investigation, root cause, mitigation, and safety guarantees', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `post-absorption-timeout-investigation-mitigated`');
    expect(content).toContain('postAbsorptionTimeoutInvestigationCreated=true');
    expect(content).toContain('fullExternalAgentsTimeoutInvestigated=true');
    expect(content).toContain('noExternalExecutorLiveRequiredForUnitTests=true');
    expect(content).toContain('noResidualJestNodeProcesses=true');
    expect(content).toContain('noResidualExternalExecutorProcesses=true');
    expect(content).toContain('rawSecretSerialized=false');
    expect(content).toContain('root cause: repeated expensive fixtures plus serial suite size');
    expect(content).toContain('full unsharded suite default: not recommended');
    assertNoRawSecret(content);
  });

  it('records before/after timings for the first mitigated slow files', () => {
    const content = read(DOC);

    expect(content).toContain('89.641s');
    expect(content).toContain('13.839s');
    expect(content).toContain('115.845s');
    expect(content).toContain('24.289s');
    expect(content).toContain('>184s timeout');
    expect(content).toContain('33.570s');
    expect(content).toContain('5 suites, 55 tests, 194.789s');
  });

  it('records shard-based full-suite strategy and measured shard timings', () => {
    const content = read(DOC);

    expect(content).toContain('npx jest tests/runtime/external-agents --runInBand --shard=N/16 --testTimeout=30000');
    [
      '1/16',
      '2/16',
      '3/16',
      '6/16',
      '8/16',
      '14/16',
      '147.782s',
      '145.620s',
    ].forEach((snippet) => expect(content).toContain(snippet));
    expect(content).toContain('Run all `N=1..16` shards in CI or before a major release');
  });

  it('updates the TODO with the mitigation conclusion and recommended command', () => {
    const content = read(TODO);

    expect(content).toContain('Status: `investigated-mitigated`');
    expect(content).toContain(DOC);
    expect(content).toContain('fullExternalAgentsTimeoutInvestigated=true');
    expect(content).toContain('rootCause=repeated-expensive-fixtures-plus-serial-suite-size');
    expect(content).toContain('recommendedFullSuiteStrategy=jest-shards-1-through-16');
    expect(content).toContain('npx jest tests/runtime/external-agents --runInBand --shard=N/16 --testTimeout=30000');
    assertNoRawSecret(content);
  });

  it('keeps dedicated package scripts for full, shard, open-handle, and representative external-agents runs', () => {
    const pkg = JSON.parse(read(PACKAGE_JSON)) as { scripts: Record<string, string> };

    expect(pkg.scripts['test:external-agents:full']).toBe('jest tests/runtime/external-agents --runInBand');
    expect(pkg.scripts['test:external-agents:shard']).toBe('jest tests/runtime/external-agents --runInBand --shard');
    expect(pkg.scripts['test:external-agents:open-handles']).toContain('--detectOpenHandles');
    expect(pkg.scripts['test:external-agents:open-handles']).toContain('--logHeapUsage');
    expect(pkg.scripts['test:external-agents:open-handles']).toContain('--testTimeout=30000');
    expect(pkg.scripts['test:external-agents:representative']).toContain(
      'ZavorthFinalAdapterDomainDecommissionPack.test.ts',
    );
  });

  it('locks in the first fixture-cost mitigations without removing coverage', () => {
    expect(read(SNAPSHOT_REPAIR_TEST)).toContain('productionBaselineRoot');
    expect(read(SNAPSHOT_REPAIR_TEST)).toContain('seedProductionSnapshots(baselineRoot)');
    expect(read(CONSUMER_EXPANSION_TEST)).toContain('cachedPack');
    expect(read(CONSUMER_EXPANSION_TEST)).toContain('cachedCapabilityRegistry');
    expect(read(CONSUMER_EXPANSION_TEST)).toContain('commandCenterFixture');
    expect(read(PRODUCTION_PERSISTENCE_TEST)).toContain('cachedPersistence');
    expect(read(PRODUCTION_PERSISTENCE_TEST)).toContain('persistenceFixture()');
  });

  it('keeps the investigation free of raw secrets and raw token values', () => {
    const serialized = [
      read(DOC),
      read(TODO),
      read(PACKAGE_JSON),
    ].join('\n');

    assertNoRawSecret(serialized);
  });
});
