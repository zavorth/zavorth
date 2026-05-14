import fs from 'node:fs';
import path from 'node:path';

const DOC = 'docs/246-post-absorption-long-regression-release-verification.md';
const PRIOR_DOC = 'docs/245-post-absorption-external-agents-suite-timeout-investigation.md';
const FINAL_REPORT = 'docs/244-final-zavorth-only-absorption-hardening-and-report.md';
const TODO = 'docs/todo-investigate-external-agents-full-suite-timeout.md';
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

describe('Post-absorption long regression release verification', () => {
  it('documents 246 as the post-absorption long regression release verification', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `post-absorption-long-regression-release-verified`');
    expect(content).toContain(FINAL_REPORT);
    expect(content).toContain(PRIOR_DOC);
    expect(content).toContain(TODO);
    expect(content).toContain('postAbsorptionLongRegressionCreated=true');
    expect(content).toContain('releaseVerificationStrategyRecorded=true');
    expect(content).toContain('runtimeCheckPassedOrFailureRecorded=true');
    expect(content).toContain('redactionScanRecorded=true');
    expect(content).toContain('processCleanupRecorded=true');
    expect(content).toContain('externalExecutorNotRequiredForDefaultRuntime=true');
    expect(content).toContain('rawSecretSerialized=false');
    assertNoRawSecret(content);
  });

  it('records all 16 external-agents shards and aggregate release coverage', () => {
    const content = read(DOC);

    Array.from({ length: 16 }, (_, index) => `${index + 1}/16`).forEach((shard) => {
      expect(content).toContain(`\`${shard}\` | passed`);
    });
    expect(content).toContain('external-agents shards passed: 16/16');
    expect(content).toContain('external-agents suites passed: 153');
    expect(content).toContain('external-agents tests passed: 1049');
    expect(content).toContain('sum of shard runtimes: 1066.219s');
    expect(content).toContain('batched operator wall time: about 598s');
    expect(content).toContain('unsharded external-agents full suite: skipped by 245 strategy');
  });

  it('records ai-gateway/control, runtime check, redaction, public surface, process, and listener checks', () => {
    const content = read(DOC);

    expect(content).toContain('npx jest tests/ai-gateway/control --runInBand');
    expect(content).toContain('pass: 21 suites, 86 tests, 42.766s');
    expect(content).toContain('npm run runtime:check --silent');
    expect(content).toContain('pass: 27.282s');
    expect(content).toContain('final re-run after documentation hardening: 21.672s');
    expect(content).toContain('redaction-scan: no raw secret/token patterns found');
    expect(content).toContain('redaction-scan-final: no raw secret/token patterns found');
    expect(content).toContain('public-surface-scan: no ExternalExecutor/external-executor mentions in public docs/package scan');
    expect(content).toContain('public-surface-scan-final: no ExternalExecutor/external-executor mentions in public docs/package scan');
    expect(content).toContain('process-check: no residual jest/external-executor/external-agents node processes found');
    expect(content).toContain('process-check-final: no residual jest/external-executor/external-agents node processes found');
    expect(content).toContain('listener-check: no listener on 18789');
    expect(content).toContain('listener-check-final: no listener on 18789');
  });

  it('keeps public docs Zavorth-native after hardening legacy labels', () => {
    PUBLIC_DOCS.forEach((relativePath) => {
      const content = read(relativePath);

      expect(content).not.toMatch(/ExternalExecutor|external-executor/);
    });
  });

  it('keeps external-agents scripts aligned with the 245/246 sharded strategy', () => {
    const pkg = JSON.parse(read(PACKAGE_JSON)) as { scripts: Record<string, string> };

    expect(pkg.scripts['test:external-agents:full']).toBe('jest tests/runtime/external-agents --runInBand');
    expect(pkg.scripts['test:external-agents:shard']).toBe('jest tests/runtime/external-agents --runInBand --shard');
    expect(pkg.scripts['test:external-agents:open-handles']).toContain('--testTimeout=30000');
    expect(pkg.scripts['test:external-agents:representative']).toContain(
      'ZavorthWave4FToolCommandExecutionAbsorptionPack.test.ts',
    );
  });

  it('records a passed release-readiness decision with residual risks and next hardening fixes', () => {
    const content = read(DOC);

    expect(content).toContain('result: passed');
    expect(content).toContain('critical tests failed: false');
    expect(content).toContain('degraded: false');
    expect(content).toContain('blocked: false');
    expect(content).toContain('Heavy shards that remain optimization candidates');
    expect(content).toContain('add CI matrix support for `--shard=1/16` through `--shard=16/16`');
    expect(content).toContain('public surface scan: passed after hardening');
    expect(content).toContain('decision: post-absorption-long-regression-release-verified');
  });

  it('keeps release verification docs/package free of raw secrets', () => {
    const serialized = [
      read(DOC),
      read(PRIOR_DOC),
      read(FINAL_REPORT),
      read(TODO),
      read(PACKAGE_JSON),
    ].join('\n');

    assertNoRawSecret(serialized);
  });
});
