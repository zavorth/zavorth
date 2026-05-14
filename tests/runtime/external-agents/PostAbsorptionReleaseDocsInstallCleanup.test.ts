import fs from 'node:fs';
import path from 'node:path';

const DOC = 'docs/248-post-absorption-release-docs-install-cleanup.md';
const README = 'README.md';
const QUICKSTART = 'docs/02-quickstart.md';
const EXECUTORS = 'docs/04-executors.md';
const SECURITY = 'docs/05-security.md';
const TELEGRAM = 'docs/06-telegram.md';
const OPERATIONS = 'docs/09-operations.md';
const TROUBLESHOOTING = 'docs/10-troubleshooting.md';
const ROADMAP = 'docs/roadmap-p0-p2.md';
const PACKAGE_JSON = 'package.json';
const PUBLIC_DOCS = [
  README,
  QUICKSTART,
  EXECUTORS,
  SECURITY,
  TELEGRAM,
  OPERATIONS,
  TROUBLESHOOTING,
  ROADMAP,
  'docs/00-overview.md',
  'docs/01-product-pitch.md',
  'docs/03-architecture.md',
  'docs/07-web.md',
  'docs/08-capabilities-plugins.md',
  'docs/11-roadmap.md',
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

describe('Post-absorption release docs/install cleanup', () => {
  it('documents 248 with Zavorth-only release/install/test guarantees', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `post-absorption-release-docs-install-cleanup-ready`');
    expect(content).toContain('postAbsorptionReleaseDocsInstallCleanupCreated=true');
    expect(content).toContain('publicDocsZavorthNative=true');
    expect(content).toContain('defaultInstallExternalExecutorRequired=false');
    expect(content).toContain('defaultRuntimeZavorthOwned=true');
    expect(content).toContain('adapterDefaultPathForAbsorbedDomains=false');
    expect(content).toContain('rawHistoryImportDefaultDisabled=true');
    expect(content).toContain('testStrategyDocumented=true');
    expect(content).toContain('rawSecretSerialized=false');
    expect(content).toContain('publicExternalExecutorIdentityLeak=false');
    assertNoRawSecret(content);
  });

  it('keeps public docs Zavorth-native without public ExternalExecutor identity leaks', () => {
    PUBLIC_DOCS.forEach((relativePath) => {
      expect(read(relativePath)).not.toMatch(/ExternalExecutor|external-executor/);
    });
    expect(read(README)).toContain('Runtime Zavorth-Only Por Padrao');
    expect(read(README)).toContain('registries, projections e executors Zavorth-owned');
    expect(read(QUICKSTART)).toContain('O caminho padrao nao exige adapters externos');
    expect(read(EXECUTORS)).toContain('external_review');
    expect(read(TELEGRAM)).toContain('/workflow review tarefa');
    expect(read(ROADMAP)).toContain('native-review');
  });

  it('documents default install/runtime as Zavorth-owned without external source runtime requirement', () => {
    const content = read(DOC);

    expect(content).toContain('defaultInstallExternalExecutorRequired=false');
    expect(content).toContain('defaultRuntimeZavorthOwned=true');
    expect(content).toContain('registryLookupDefault=Zavorth-owned registries');
    expect(content).toContain('dashboardRenderDefault=production-loaded/native-first');
    expect(content).toContain('adapterRefreshFallbackExplicitOnly=true');
    expect(content).toContain('npm install');
    expect(content).toContain('node dist/zavorth-cli.js onboard');
    expect(content).toContain('zavorth go');
  });

  it('documents relevant feature flags and raw import default-disabled posture', () => {
    const content = read(DOC);

    [
      'ZAVORTH_NATIVE_REGISTRY_PRODUCTION_WRITE',
      'ZAVORTH_WAVE4A_METADATA_MIGRATION_WRITE',
      'ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_WRITE',
      'ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_WRITE',
      'ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE',
      'ZAVORTH_WAVE4B_REGISTRY_RECONCILIATION_COMMIT_EXECUTE',
      'ZAVORTH_WAVE4D_FIRST_REAL_MESSAGE_SEND_EXECUTE',
      'ZAVORTH_WAVE4E_PROVIDER_EXECUTION_EXECUTE',
      'ZAVORTH_WAVE4F_TOOL_COMMAND_EXECUTION_EXECUTE',
    ].forEach((flag) => expect(content).toContain(flag));
    expect(content).toContain('Raw history/SQLite import has no default enablement');
    expect(content).toContain('future optional tool behind a separate explicit gate');
  });

  it('documents test strategy scripts from 245/246 and public release scans', () => {
    const content = read(DOC);
    const operations = read(OPERATIONS);
    const troubleshooting = read(TROUBLESHOOTING);
    const pkg = JSON.parse(read(PACKAGE_JSON)) as { scripts: Record<string, string> };

    expect(content).toContain('external-agents shards 1/16 through 16/16');
    expect(content).toContain('monolithic external-agents: not recommended for interactive gates');
    expect(content).toContain('redaction scan');
    expect(content).toContain('public surface scan');
    expect(content).toContain('process/listener cleanup check');
    expect(operations).toContain('Estrategia Pos-Absorcao External Agents');
    expect(troubleshooting).toContain('Suite External Agents Lenta');
    expect(pkg.scripts['test:external-agents:shard']).toBe('jest tests/runtime/external-agents --runInBand --shard');
    expect(pkg.scripts['test:external-agents:open-handles']).toContain('--testTimeout=30000');
  });

  it('keeps release readiness residuals explicit without authorizing execution, migration, or adapter removal', () => {
    const content = read(DOC);

    expect(content).toContain('heavy external-agents shards still need fixture optimization');
    expect(content).toContain('raw import remains only a future optional tool with explicit consent');
    expect(content).toContain('limited production message expansion requires future policy/approval gates');
    expect(content).toContain('global adapter removal still requires a separate gate');
    [
      'provider/tool/command execution',
      'message send',
      'new state migration',
      'global adapter removal without its own gate',
    ].forEach((prohibited) => expect(content).toContain(prohibited));
  });

  it('keeps docs/install cleanup scope free of raw secrets', () => {
    const serialized = [
      read(DOC),
      read(README),
      read(QUICKSTART),
      read(OPERATIONS),
      read(TROUBLESHOOTING),
      read(PACKAGE_JSON),
    ].join('\n');

    assertNoRawSecret(serialized);
  });
});
