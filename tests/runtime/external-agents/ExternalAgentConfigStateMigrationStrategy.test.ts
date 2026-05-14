import fs from 'node:fs';
import path from 'node:path';

const STRATEGY_DOC = 'docs/162-wave-0-external-agent-config-state-migration-strategy.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';

const DATA_CLASSES = [
  'runtime config',
  'auth/secrets',
  'gateway connection config',
  'plugin manifest/cache',
  'plugin runtime state',
  'channel credentials',
  'session/history store',
  'artifacts/logs',
  'node/worker registry',
  'provider config',
  'user preferences',
  'telemetry/diagnostics',
];

const DECISION_TYPES = [
  'zavorth-owned',
  'compatibility-read-only',
  'import-with-redaction',
  'externalize',
  'reject',
  'defer',
];

const EXTERNAL_EXECUTOR_ROWS = [
  'external-executor-config-file-path-classification',
  'external-executor-gateway-url-port-config',
  'external-executor-token-auth-config',
  'external-executor-plugin-manifest-data',
  'external-executor-plugin-runtime-cache',
  'external-executor-session-history-data',
  'external-executor-logs-diagnostics',
  'external-executor-channel-provider-credentials',
  'external-executor-worker-node-metadata',
];

const FIXTURE_SETS = [
  'config-runtime-readonly-path-fixture',
  'config-secretref-only-fixture',
  'config-gateway-metadata-fixture',
  'config-plugin-cache-quarantine-fixture',
  'config-session-history-readmodel-fixture',
  'config-log-redaction-fixture',
  'config-worker-node-externalize-fixture',
  'config-idempotent-dry-run-fixture',
  'config-rollback-required-fixture',
];

const FUTURE_GATES = [
  'docs/163-wave-1-external-agent-config-state-read-only-inventory.md',
  'docs/164-wave-1-redaction-and-secretref-mapping.md',
  'docs/165-wave-1-dry-run-migration-plan.md',
  'docs/166-wave-1-rollback-restore-rehearsal.md',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function lineFor(content: string, itemId: string): string {
  return content.split(/\r?\n/).find((line) => line.includes(`\`${itemId}\``)) || '';
}

describe('External agent config/state migration strategy', () => {
  it('is design-only and does not authorize migration or live ExternalExecutor work', () => {
    const content = read(STRATEGY_DOC);
    const lower = content.toLowerCase();

    expect(content).toContain('Status: design-only-no-migration');
    expect(content).toContain(PAUSE_DOC);
    [
      'migration execution blocked',
      'real file copy blocked',
      'ExternalExecutor config/state copy blocked',
      'raw secret read blocked',
      'raw token print blocked',
      'config/state mutation blocked',
      'ExternalExecutor start blocked',
      'gateway connection blocked',
      'real session import blocked',
      'plugin install blocked',
      'source module copy blocked',
      'adapter removal blocked',
      'native replacement blocked',
    ].forEach((blocked) => {
      expect(content).toContain(blocked);
    });
    expect(content).toContain('migration authorized: false');
    expect(content).toContain('state mutation authorized: false');
    expect(lower).not.toContain('migration authorized: true');
  });

  it('covers all required data classes and decision types', () => {
    const content = read(STRATEGY_DOC);

    DATA_CLASSES.forEach((dataClass) => {
      expect(content).toContain(`\`${dataClass}\``);
    });
    DECISION_TYPES.forEach((decisionType) => {
      expect(content).toContain(`\`${decisionType}\``);
    });
  });

  it('requires SecretRef, redaction, backup, rollback, idempotency, and Zavorth ownership', () => {
    const content = read(STRATEGY_DOC);

    [
      'no raw secret migration',
      'SecretRef only',
      'read-only inventory before migration',
      'no state mutation without backup plan',
      'rollback plan required',
      'source ids evidence-only',
      'Zavorth config names canonical',
      'compatibility names quarantined',
      'Command Center shows state as Zavorth concepts',
      'import must be idempotent',
    ].forEach((invariant) => {
      expect(content).toContain(invariant);
    });
    expect(content).toContain('raw secret migration authorized: false');
    expect(content).toContain('source paths and source ids are `sourceEvidence`');
    expect(content).toContain('compatibility names remain adapter-local or diagnostic-only');
  });

  it('defines initial ExternalExecutor evidence rows without granting source authority', () => {
    const content = read(STRATEGY_DOC);

    EXTERNAL_EXECUTOR_ROWS.forEach((rowId) => {
      const row = lineFor(content, rowId);

      expect(row).toContain(`\`${rowId}\``);
      expect(row).toContain('design-only-no-migration');
      expect(row).toMatch(/compatibility-read-only|import-with-redaction|externalize|defer/);
    });
    expect(content).toContain('no gateway start or connection');
    expect(content).toContain('No real session import, transcript replay, or memory mutation');
    expect(content).toContain('no process start or node takeover');
  });

  it('defines deterministic fixtures for future strategy gates', () => {
    const content = read(STRATEGY_DOC);

    FIXTURE_SETS.forEach((fixtureId) => {
      expect(content).toContain(`\`${fixtureId}\``);
    });
    expect(content).toContain('Credential material becomes `SecretRef` metadata');
    expect(content).toContain('Connection data becomes descriptor metadata with `connectAuthority: false`');
    expect(content).toContain('Mutation cannot proceed without backup manifest and rollback rehearsal metadata.');
  });

  it('declares inventory and mapping handoffs while keeping later future gates unexecuted', () => {
    const content = read(STRATEGY_DOC);

    FUTURE_GATES.forEach((gate) => {
      expect(content).toContain(gate);
    });
    expect(content).toContain('future gate 163 executed: true');
    expect(content).toContain('future gate 164 executed: true');
    expect(content).toContain('future gate 165 executed: true');
    expect(content).toContain('future gate 166 executed: true');
    expect(content).toContain('read-only inventory only');
    expect(content).toContain('redaction-secretref-mapping-no-migration');
    expect(content).toContain('dry-run-plan-no-migration');
    expect(content).toContain('rollback-restore-rehearsal-no-mutation');
    expect(content).toContain('controlled import');
    expect(content).toContain('false');
  });

  it('updates tracking docs while keeping the live track paused', () => {
    const pause = read(PAUSE_DOC);
    const goNoGo = read(GO_NO_GO_DOC);

    [pause, goNoGo].forEach((content) => {
      expect(content).toContain(STRATEGY_DOC);
      expect(content).toContain('design-only-no-migration');
    });
    expect(pause).toContain('docs/162 may prepare config/state migration strategy without migration');
    expect(pause).toMatch(/does not\s+migrate files, copy ExternalExecutor state, read secrets, start ExternalExecutor/);
    expect(goNoGo).toContain('config/state migration strategy');
    expect(goNoGo).toContain('migration remains blocked');
  });
});
