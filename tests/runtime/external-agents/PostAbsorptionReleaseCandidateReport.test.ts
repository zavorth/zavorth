import fs from 'node:fs';
import path from 'node:path';

const DOC = 'docs/249-post-absorption-release-candidate-report.md';
const FINAL_REPORT = 'docs/244-final-zavorth-only-absorption-hardening-and-report.md';
const TIMEOUT_INVESTIGATION = 'docs/245-post-absorption-external-agents-suite-timeout-investigation.md';
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

describe('Post-absorption release candidate report', () => {
  it('documents the RC summary and required guarantees', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `post-absorption-release-candidate-ready`');
    expect(content).toContain('postAbsorptionReleaseCandidateReportCreated=true');
    expect(content).toContain('releaseCandidateGoNoGoRecorded=true');
    expect(content).toContain('defaultRuntimeZavorthOwned=true');
    expect(content).toContain('defaultInstallExternalExecutorRequired=false');
    expect(content).toContain('adapterDefaultPathForAbsorbedDomains=false');
    expect(content).toContain('rawHistoryImportDefaultDisabled=true');
    expect(content).toContain('publicExternalExecutorIdentityLeak=false');
    expect(content).toContain('rawSecretSerialized=false');
    expect(content).toContain('testStrategyRecorded=true');
    expect(content).toContain('release candidate: go');
    assertNoRawSecret(content);
  });

  it('consolidates evidence from 244 through 248 and package scripts', () => {
    const content = read(DOC);

    [
      FINAL_REPORT,
      TIMEOUT_INVESTIGATION,
      LONG_REGRESSION,
      RAW_IMPORT_DECISION,
      DOCS_INSTALL_CLEANUP,
      'package.json',
    ].forEach((evidence) => expect(content).toContain(evidence));
  });

  it('records the verification matrix from 246 and 248', () => {
    const content = read(DOC);
    const longRegression = read(LONG_REGRESSION);
    const cleanup = read(DOCS_INSTALL_CLEANUP);

    expect(content).toContain('passed, 16/16 shards');
    expect(content).toContain('153 suites, 1049 tests');
    expect(content).toContain('passed, 21 suites, 86 tests');
    expect(content).toContain('redaction scan');
    expect(content).toContain('public surface scan');
    expect(content).toContain('process cleanup');
    expect(content).toContain('listener cleanup');
    expect(content).toContain('docs/install cleanup');
    expect(longRegression).toContain('external-agents shards passed: 16/16');
    expect(longRegression).toContain('ai-gateway/control: passed');
    expect(cleanup).toContain('postAbsorptionReleaseDocsInstallCleanupCreated=true');
  });

  it('defines explicit go/no-go criteria for release candidate promotion', () => {
    const content = read(DOC);

    [
      'default runtime is Zavorth-owned',
      'default install does not require ExternalExecutor',
      'absorbed domains do not require ExternalExecutor',
      'adapter is not a default path for absorbed domains',
      'no raw secret/token serialization',
      'raw history/SQLite import remains disabled by default',
      'external-agents shards pass',
    ].forEach((goCriterion) => expect(content).toContain(goCriterion));

    [
      'secret or token leak',
      'public ExternalExecutor/source identity leak',
      'default runtime or default install requires ExternalExecutor',
      'raw history/SQLite import is accidentally enabled',
      'adapter default path is reintroduced for absorbed domains',
      'critical shard/control/typecheck failure is untriaged',
      'process/listener cleanup fails',
    ].forEach((noGoCriterion) => expect(content).toContain(noGoCriterion));
  });

  it('keeps residual risks and post-RC next steps explicit', () => {
    const content = read(DOC);

    [
      'full external-agents unsharded remains not recommended',
      'heavy external-agents shards still need fixture optimization',
      'optional raw import tool is not implemented',
      'limited production message expansion remains optional',
      'fallback/refresh adapter still exists where explicitly allowed',
      'global adapter removal still requires a separate gate',
      'optimize heavy shards',
      'optional limited production message expansion',
      'optional raw import tooling',
      'per-domain fallback adapter retirement',
      'prepare release notes',
    ].forEach((item) => expect(content).toContain(item));
  });

  it('keeps package test strategy aligned with 245/246', () => {
    const pkg = JSON.parse(read(PACKAGE_JSON)) as { scripts: Record<string, string> };
    const content = read(DOC);

    expect(pkg.scripts['test:external-agents:full']).toBe('jest tests/runtime/external-agents --runInBand');
    expect(pkg.scripts['test:external-agents:shard']).toBe('jest tests/runtime/external-agents --runInBand --shard');
    expect(pkg.scripts['test:external-agents:open-handles']).toContain('--testTimeout=30000');
    expect(content).toContain('Do not run the full unsharded external-agents suite for this RC report');
  });

  it('keeps public docs Zavorth-native without public source identity leaks', () => {
    PUBLIC_DOCS.forEach((relativePath) => {
      expect(read(relativePath)).not.toMatch(/ExternalExecutor|external-executor/);
    });
  });

  it('does not authorize migration, message send, provider/tool/command execution, runtime behavior change, adapter removal, or raw token output', () => {
    const content = read(DOC);

    [
      'new migration execution',
      'message send',
      'provider/tool/command execution',
      'runtime behavior alteration',
      'global adapter removal',
      'ExternalExecutor public identity reintroduction',
      'raw token serialization',
    ].forEach((prohibited) => expect(content).toContain(prohibited));
  });

  it('keeps RC docs and evidence free of raw secrets', () => {
    const serialized = [
      read(DOC),
      read(FINAL_REPORT),
      read(TIMEOUT_INVESTIGATION),
      read(LONG_REGRESSION),
      read(RAW_IMPORT_DECISION),
      read(DOCS_INSTALL_CLEANUP),
      read(PACKAGE_JSON),
    ].join('\n');

    assertNoRawSecret(serialized);
  });
});
