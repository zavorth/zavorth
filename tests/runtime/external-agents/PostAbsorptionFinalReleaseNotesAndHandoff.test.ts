import fs from 'node:fs';
import path from 'node:path';

const DOC = 'docs/250-post-absorption-final-release-notes-and-handoff.md';
const FINAL_REPORT = 'docs/244-final-zavorth-only-absorption-hardening-and-report.md';
const RELEASE_CANDIDATE = 'docs/249-post-absorption-release-candidate-report.md';
const TEST_STRATEGY = 'docs/245-post-absorption-external-agents-suite-timeout-investigation.md';
const LONG_REGRESSION = 'docs/246-post-absorption-long-regression-release-verification.md';
const RAW_IMPORT_DECISION = 'docs/247-post-absorption-raw-history-sqlite-import-decision.md';
const DOCS_INSTALL_CLEANUP = 'docs/248-post-absorption-release-docs-install-cleanup.md';
const PACKAGE_JSON = 'package.json';
const PUBLIC_DOCS = [
  'README.md',
  'package.json',
  'docs/00-overview.md',
  'docs/01-product-pitch.md',
  'docs/02-quickstart.md',
  'docs/03-architecture.md',
  'docs/04-executors.md',
  'docs/05-security.md',
  'docs/06-telegram.md',
  'docs/07-web.md',
  'docs/08-capabilities-plugins.md',
  'docs/09-operations.md',
  'docs/10-troubleshooting.md',
  'docs/11-roadmap.md',
  'docs/roadmap-p0-p2.md',
  'docs/capability-plugins.md',
  'docs/gateway-cli.md',
  'docs/gateway-control-api.md',
  'docs/nexus-runtime.md',
  'docs/self-modification.md',
  'docs/stitch-setup.md',
  'docs/product/operator-cockpit.md',
  'docs/product/quickstart-developer.md',
  'docs/product/quickstart-operator.md',
  'docs/product/troubleshooting-guiado.md',
  'docs/platform/criar-extensao.md',
  'docs/platform/integrar-client.md',
  'docs/platform/publicar-plugin.md',
  'docs/platform/registrar-node.md',
  'docs/platform/usar-recipe.md',
  'docs/protocol/rest-v1.md',
  'docs/protocol/sdk-usage.md',
  'docs/protocol/websocket-v1.md',
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

describe('Post-absorption final release notes and handoff', () => {
  it('documents the final release notes and required guarantees', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `post-absorption-final-release-notes-and-handoff-complete`');
    expect(content).toContain('finalReleaseNotesAndHandoffCreated=true');
    expect(content).toContain('runtimeBehaviorChanged=false');
    expect(content).toContain('defaultRuntimeZavorthOwned=true');
    expect(content).toContain('defaultInstallExternalExecutorRequired=false');
    expect(content).toContain('publicExternalExecutorIdentityLeak=false');
    expect(content).toContain('rawSecretSerialized=false');
    expect(content).toContain('post-250 hardening pack: docs/251-post-absorption-parallel-hardening-pack.md');
    assertNoRawSecret(content);
  });

  it('summarizes absorbed capabilities and Zavorth-owned execution domains', () => {
    const content = read(DOC);

    [
      'capability/plugin registry',
      'dashboard/Command Center view models',
      'provider/channel/transport metadata registries',
      'session/history metadata and redacted/derived content views',
      'config/SecretRef/state metadata registries',
      'production-loaded/native-first registry restore path',
      'low-risk metadata validation',
      'native registry reconciliation commit',
      'production snapshot verify/repair',
      'target/session/channel validation',
      'transport readiness check',
      'message-send dry-run',
      'first controlled test/sandbox message send',
      'provider execution absorption in sandbox/no-cost mode',
      'tool/command execution absorption in sandbox/no-op/read-only mode',
    ].forEach((item) => expect(content).toContain(item));
  });

  it('records operational handoff commands and release hygiene checks', () => {
    const content = read(DOC);

    [
      'npm install',
      'npm run build',
      'node dist/zavorth-cli.js onboard',
      'node dist/zavorth-cli.js go',
      'zavorth onboard',
      'zavorth go',
      'npm run runtime:check --silent',
      'npm run test:external-agents:shard -- 1/16',
      'npx jest tests/ai-gateway/control --runInBand',
      'confirm no residual jest/external-executor/external-agents node processes',
      'confirm no listener on 18789',
    ].forEach((commandOrCheck) => expect(content).toContain(commandOrCheck));
  });

  it('documents safety flags and blocked production/raw-import paths', () => {
    const content = read(DOC);

    [
      'ZAVORTH_NATIVE_REGISTRY_PRODUCTION_WRITE',
      'ZAVORTH_WAVE4A_METADATA_MIGRATION_WRITE',
      'ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_WRITE',
      'ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_WRITE',
      'ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE',
      'ZAVORTH_WAVE4B_REGISTRY_RECONCILIATION_COMMIT_EXECUTE',
      'ZAVORTH_WAVE4B_PRODUCTION_SNAPSHOT_REPAIR_EXECUTE',
      'ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTE',
      'ZAVORTH_WAVE4B2_TRANSPORT_READINESS_CHECK_EXECUTE',
      'ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE',
      'ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_EXECUTE',
      'ZAVORTH_WAVE4D_FINAL_TEST_TARGET_DRY_RUN_EXECUTE',
      'ZAVORTH_WAVE4D_FIRST_REAL_MESSAGE_SEND_EXECUTE',
      'ZAVORTH_WAVE4E_PROVIDER_EXECUTION_EXECUTE',
      'ZAVORTH_WAVE4F_TOOL_COMMAND_EXECUTION_EXECUTE',
      'unrestricted production message send remains blocked',
      'raw history/SQLite import remains disabled by default and has no default flag',
      'global adapter removal remains blocked without its own gate',
    ].forEach((item) => expect(content).toContain(item));
  });

  it('links the final handoff to 244-249 evidence and package test strategy', () => {
    const content = read(DOC);
    const pkg = JSON.parse(read(PACKAGE_JSON)) as { scripts: Record<string, string> };

    expect(read(FINAL_REPORT)).toContain('finalZavorthOnlyAbsorptionHardeningComplete=true');
    expect(read(RELEASE_CANDIDATE)).toContain('release candidate: go');
    expect(read(TEST_STRATEGY)).toContain('recommended full strategy: 16 explicit Jest shards');
    expect(read(LONG_REGRESSION)).toContain('external-agents shards passed: 16/16');
    expect(read(RAW_IMPORT_DECISION)).toContain('rawHistoryImportDefaultDisabled=true');
    expect(read(DOCS_INSTALL_CLEANUP)).toContain('postAbsorptionReleaseDocsInstallCleanupCreated=true');
    expect(pkg.scripts['test:external-agents:shard']).toBe('jest tests/runtime/external-agents --runInBand --shard');
    expect(content).toContain('The `246` release verification passed all `16/16` shards');
  });

  it('keeps residual work and go/no-go state explicit', () => {
    const content = read(DOC);

    [
      'optimize heavy external-agents shards',
      'add CI matrix support',
      'optional limited production message expansion',
      'optional raw import tooling',
      'per-domain fallback adapter retirement',
      'release smoke',
      'post-absorption parallel hardening pack',
      'RC decision from 249: go',
      'critical blockers: none recorded',
      'Any future secret leak',
      'adapter default reintroduction',
    ].forEach((item) => expect(content).toContain(item));
  });

  it('keeps public docs Zavorth-native without public source identity leaks', () => {
    PUBLIC_DOCS.forEach((relativePath) => {
      expect(read(relativePath)).not.toMatch(/ExternalExecutor|external-executor/);
    });
  });

  it('does not authorize runtime behavior changes, migration, execution, adapter removal, or raw token output', () => {
    const content = read(DOC);

    [
      'runtime behavior changes',
      'new migration execution',
      'message send',
      'provider/tool/command execution',
      'global adapter removal',
      'ExternalExecutor public identity reintroduction',
      'raw token serialization',
    ].forEach((prohibited) => expect(content).toContain(prohibited));
  });

  it('keeps final handoff docs and evidence free of raw secrets', () => {
    const serialized = [
      read(DOC),
      read(FINAL_REPORT),
      read(RELEASE_CANDIDATE),
      read(TEST_STRATEGY),
      read(LONG_REGRESSION),
      read(RAW_IMPORT_DECISION),
      read(DOCS_INSTALL_CLEANUP),
      read(PACKAGE_JSON),
    ].join('\n');

    assertNoRawSecret(serialized);
  });
});
