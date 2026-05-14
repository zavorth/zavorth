import fs from 'node:fs';
import path from 'node:path';

const DOC = 'docs/251-post-absorption-parallel-hardening-pack.md';
const HANDOFF = 'docs/250-post-absorption-final-release-notes-and-handoff.md';
const TIMEOUT_INVESTIGATION = 'docs/245-post-absorption-external-agents-suite-timeout-investigation.md';
const LONG_REGRESSION = 'docs/246-post-absorption-long-regression-release-verification.md';
const RAW_IMPORT_DECISION = 'docs/247-post-absorption-raw-history-sqlite-import-decision.md';
const RELEASE_CANDIDATE = 'docs/249-post-absorption-release-candidate-report.md';
const PACKAGE_JSON = 'package.json';

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

describe('Post-absorption parallel hardening pack', () => {
  it('creates the 251 pack and records required safety guarantees', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `post-absorption-parallel-hardening-pack-created`');
    expect(content).toContain('postAbsorptionParallelHardeningPackCreated=true');
    expect(content).toContain('parallelHardeningFrontsRecorded=4');
    expect(content).toContain('runtimeBehaviorChanged=false');
    expect(content).toContain('messageActuallySent=false');
    expect(content).toContain('providerActuallyExecuted=false');
    expect(content).toContain('toolCommandActuallyExecuted=false');
    expect(content).toContain('rawHistorySqliteMigrationPerformed=false');
    expect(content).toContain('adapterRemovalGlobalAllowed=false');
    expect(content).toContain('publicExternalExecutorIdentityLeak=false');
    expect(content).toContain('rawSecretSerialized=false');
    assertNoRawSecret(content);
  });

  it('records all four independent hardening fronts', () => {
    const content = read(DOC);

    [
      'A - external-agents shard optimization',
      'B - release polish and operations',
      'C - optional raw history importer plan',
      'D - adapter fallback retirement analysis',
      'externalAgentsHeavyShardOptimizationRecorded=true',
      'releaseOperationsPolishRecorded=true',
      'optionalRawImporterPlanRecorded=true',
      'adapterFallbackRetirementAnalysisRecorded=true',
    ].forEach((item) => expect(content).toContain(item));
  });

  it('targets the heavy 246 shards without making unsharded external-agents the default', () => {
    const content = read(DOC);
    const regression = read(LONG_REGRESSION);
    const pkg = JSON.parse(read(PACKAGE_JSON)) as { scripts: Record<string, string> };

    ['8/16', '3/16', '12/16', '11/16', '15/16'].forEach((shard) => {
      expect(content).toContain(shard);
      expect(regression).toContain(shard);
    });
    expect(content).toContain('cache immutable fixture construction inside test files');
    expect(content).toContain('avoid whole-repo static scans inside every test');
    expect(content).toContain('The unsharded full suite remains non-default');
    expect(pkg.scripts['test:external-agents:shard']).toBe('jest tests/runtime/external-agents --runInBand --shard');
    expect(pkg.scripts['test:external-agents:open-handles']).toContain('--detectOpenHandles');
  });

  it('documents operations diagnostics, release hygiene, and monitoring without runtime changes', () => {
    const content = read(DOC);

    [
      'redaction scan',
      'public surface scan',
      'process cleanup check',
      'listener cleanup check for `18789`',
      'receipts/logs scan',
      'monitor runtime startup success',
      'monitor registry restore/load status',
      'monitor receipt write success',
      'adapter-default-path regressions',
      'No runtime behavior is changed by this pack',
    ].forEach((item) => expect(content).toContain(item));
  });

  it('keeps optional raw history/SQLite import disabled and future-only', () => {
    const content = read(DOC);
    const rawDecision = read(RAW_IMPORT_DECISION);

    expect(rawDecision).toContain('rawHistoryImportDefaultDisabled=true');
    expect(content).toContain('subagentCOptionalRawHistorySqliteImporterPlan=recorded');
    expect(content).toContain('raw import default: disabled');
    expect(content).toContain('raw importer implemented: false');
    expect(content).toContain('raw importer authorized: false');
    expect(content).toContain('source DB mode: read-only');
    expect(content).toContain('preview before write: required');
    expect(content).toContain('rawSqliteCopyAllowed=false');
    expect(content).toContain('sqliteWriteAllowed=false');
    expect(content).toContain('rawMessageContentSerialized=false');
    expect(content).toContain('attachmentsMigrationAllowed=false');
  });

  it('maps adapter fallback retirement without removing the global adapter', () => {
    const content = read(DOC);

    [
      'capability/plugin registry | `can-retire-next`',
      'dashboard/Command Center | `can-retire-next`',
      'session/history metadata/content | `can-retire-next`',
      'config/SecretRef/state metadata | `can-retire-next`',
      'provider metadata/execution | `can-retire-next`',
      'channel/transport/message send | `keep-fallback-only`',
      'tool/command execution | `can-retire-next`',
      'refresh/reconciliation | `keep-refresh-only`',
      'unrestricted production send | `blocked`',
      'raw history/SQLite import | `blocked`',
      'optional future adapter | `blocked`',
      'global adapter removal',
    ].forEach((item) => expect(content).toContain(item));
  });

  it('updates the 250 handoff to reference the post-250 hardening pack', () => {
    const handoff = read(HANDOFF);

    expect(handoff).toContain('docs/251-post-absorption-parallel-hardening-pack.md');
    expect(handoff).toContain('heavy shard');
    expect(handoff).toContain('optimization');
    expect(handoff).toContain('operational diagnostics');
    expect(handoff).toContain('optional raw importer guardrails');
    expect(handoff).toContain('adapter fallback retirement ordering');
  });

  it('keeps source evidence and package strategy aligned', () => {
    const content = read(DOC);

    [
      TIMEOUT_INVESTIGATION,
      LONG_REGRESSION,
      RAW_IMPORT_DECISION,
      RELEASE_CANDIDATE,
      HANDOFF,
    ].forEach((evidence) => expect(content).toContain(evidence));
    expect(read(TIMEOUT_INVESTIGATION)).toContain('recommended full strategy: 16 explicit Jest shards');
    expect(read(RELEASE_CANDIDATE)).toContain('release candidate: go');
  });

  it('does not authorize prohibited external effects or coverage reduction', () => {
    const content = read(DOC);

    [
      'real message send',
      'provider/tool/command execution',
      'raw history/SQLite migration',
      'global adapter removal',
      'ExternalExecutor public identity reintroduction',
      'raw token serialization',
      'coverage reduction to pass tests',
    ].forEach((prohibited) => expect(content).toContain(prohibited));
  });

  it('keeps the 251 docs and evidence free of raw secrets', () => {
    const serialized = [
      read(DOC),
      read(HANDOFF),
      read(TIMEOUT_INVESTIGATION),
      read(LONG_REGRESSION),
      read(RAW_IMPORT_DECISION),
      read(RELEASE_CANDIDATE),
      read(PACKAGE_JSON),
    ].join('\n');

    assertNoRawSecret(serialized);
  });
});
