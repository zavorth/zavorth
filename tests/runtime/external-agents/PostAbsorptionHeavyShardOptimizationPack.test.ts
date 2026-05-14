import fs from 'node:fs';
import path from 'node:path';

const DOC = 'docs/252-post-absorption-heavy-shard-optimization-pack.md';
const TIMEOUT_INVESTIGATION = 'docs/245-post-absorption-external-agents-suite-timeout-investigation.md';
const LONG_REGRESSION = 'docs/246-post-absorption-long-regression-release-verification.md';
const PARALLEL_PACK = 'docs/251-post-absorption-parallel-hardening-pack.md';
const PACKAGE_JSON = 'package.json';
const OPTIMIZED_TESTS = [
  'tests/runtime/external-agents/ZavorthNativeRegistryProductionStorageDesign.test.ts',
  'tests/runtime/external-agents/ZavorthNativeRegistryProductionPersistenceFlagged.test.ts',
  'tests/runtime/external-agents/ZavorthPartialAdapterDeprecationGate.test.ts',
  'tests/runtime/external-agents/ZavorthPartialAdapterRemovalImplementationPack.test.ts',
  'tests/runtime/external-agents/ZavorthNativeAbsorptionConsolidationPack.test.ts',
  'tests/runtime/external-agents/ZavorthNativeAbsorptionPublicSurfaceHardeningPack.test.ts',
  'tests/runtime/external-agents/ZavorthNativeRegistryProductionRestoreLoadCommandCenter.test.ts',
  'tests/runtime/external-agents/ZavorthFinalAdapterDomainDecommissionPack.test.ts',
];
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(?<![A-Za-z])sk-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  expect(serialized).not.toContain('<redacted-local-secret>');
}

describe('Post-absorption heavy shard optimization pack', () => {
  it('documents the 252 optimization pack and safety guarantees', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `post-absorption-heavy-shard-optimization-complete`');
    expect(content).toContain('heavyShardOptimizationPackCreated=true');
    expect(content).toContain('coverageReductionAllowed=false');
    expect(content).toContain('runtimeBehaviorChanged=false');
    expect(content).toContain('messageActuallySent=false');
    expect(content).toContain('providerActuallyExecuted=false');
    expect(content).toContain('toolCommandActuallyExecuted=false');
    expect(content).toContain('rawMigrationPerformed=false');
    expect(content).toContain('adapterRemovalGlobalAllowed=false');
    expect(content).toContain('rawSecretSerialized=false');
    assertNoRawSecret(content);
  });

  it('uses 245, 246, and 251 as source evidence and preserves the known heavy shard set', () => {
    const content = read(DOC);

    [TIMEOUT_INVESTIGATION, LONG_REGRESSION, PARALLEL_PACK].forEach((evidence) => {
      expect(content).toContain(evidence);
    });
    ['8/16', '3/16', '12/16', '11/16', '15/16'].forEach((shard) => {
      expect(content).toContain(shard);
      expect(read(LONG_REGRESSION)).toContain(shard);
      expect(read(PARALLEL_PACK)).toContain(shard);
    });
    expect(content).toContain('subagent A');
  });

  it('records safe fixture optimizations in the touched tests without deleting coverage', () => {
    const content = read(DOC);

    OPTIMIZED_TESTS.forEach((testPath) => {
      expect(content).toContain(path.basename(testPath));
      expect(fs.existsSync(path.join(process.cwd(), testPath))).toBe(true);
    });
    expect(read('tests/runtime/external-agents/ZavorthNativeRegistryProductionStorageDesign.test.ts')).toContain('defaultSource');
    expect(read('tests/runtime/external-agents/ZavorthNativeRegistryProductionPersistenceFlagged.test.ts')).toContain('persistenceSourceFixture');
    expect(read('tests/runtime/external-agents/ZavorthPartialAdapterDeprecationGate.test.ts')).toContain('let policy');
    expect(read('tests/runtime/external-agents/ZavorthPartialAdapterRemovalImplementationPack.test.ts')).toContain('let pack');
    expect(read('tests/runtime/external-agents/ZavorthNativeAbsorptionConsolidationPack.test.ts')).toContain('productionBaselineRoot');
    expect(read('tests/runtime/external-agents/ZavorthNativeAbsorptionPublicSurfaceHardeningPack.test.ts')).toContain('cachedSurfaces');
    expect(read('tests/runtime/external-agents/ZavorthNativeRegistryProductionRestoreLoadCommandCenter.test.ts')).toContain('productionBaselineRoot');
    expect(read('tests/runtime/external-agents/ZavorthFinalAdapterDomainDecommissionPack.test.ts')).toContain('let source');
  });

  it('records before and after shard timings plus the remaining priority shard', () => {
    const content = read(DOC);

    [
      '| `3/16` | `143.566s` | `70.259s` | improved |',
      '| `8/16` | `190.480s` | `114.695s` | improved |',
      '| `11/16` | `125.866s` | `131.926s` | still heavy; needs next pass |',
      '| `12/16` | `139.133s` | `35.201s` | improved |',
      '| `15/16` | `123.121s` | `74.135s` | improved |',
      '246 heavy shard total: 722.166s',
      '252 final heavy shard total: 426.216s',
      'net reduction percent: about 41%',
      'remaining priority shard: 11/16',
    ].forEach((item) => expect(content).toContain(item));
  });

  it('adds a dedicated package script for the optimized heavy shard set', () => {
    const pkg = JSON.parse(read(PACKAGE_JSON)) as { scripts: Record<string, string> };

    expect(pkg.scripts['test:external-agents:heavy-shards']).toContain('3/16');
    expect(pkg.scripts['test:external-agents:heavy-shards']).toContain('8/16');
    expect(pkg.scripts['test:external-agents:heavy-shards']).toContain('11/16');
    expect(pkg.scripts['test:external-agents:heavy-shards']).toContain('12/16');
    expect(pkg.scripts['test:external-agents:heavy-shards']).toContain('15/16');
    expect(pkg.scripts['test:external-agents:heavy-shards']).toContain('--testTimeout=30000');
    expect(pkg.scripts['test:external-agents:full']).toBe('jest tests/runtime/external-agents --runInBand');
  });

  it('records focused and heavy shard verification without authorizing the full unsharded suite', () => {
    const content = read(DOC);

    expect(content).toContain('pass: 8 suites, 83 tests, 273.801s');
    expect(content).toContain('shard 3/16: pass, 10 suites, 77 tests, 70.259s');
    expect(content).toContain('shard 8/16: pass, 10 suites, 100 tests, 114.695s');
    expect(content).toContain('shard 11/16: pass, 10 suites, 74 tests, 131.926s');
    expect(content).toContain('shard 12/16: pass, 10 suites, 75 tests, 35.201s');
    expect(content).toContain('shard 15/16: pass, 10 suites, 59 tests, 74.135s');
    expect(content).toContain('Do not run the full unsharded external-agents suite by default');
  });

  it('does not authorize prohibited behavior or raw secret output', () => {
    const content = read(DOC);

    [
      'test removal without replacement or justification',
      'important assertion skipping',
      'ExternalExecutor live calls',
      'message send',
      'provider/tool/command execution',
      'state migration',
      'adapter removal',
      'raw token serialization',
    ].forEach((prohibited) => expect(content).toContain(prohibited));
  });

  it('keeps 252 evidence free of raw secrets', () => {
    const serialized = [
      read(DOC),
      read(TIMEOUT_INVESTIGATION),
      read(LONG_REGRESSION),
      read(PARALLEL_PACK),
      read(PACKAGE_JSON),
    ].join('\n');

    assertNoRawSecret(serialized);
  });
});
