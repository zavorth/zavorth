import fs from 'node:fs';
import path from 'node:path';

const DRY_RUN_DOC = 'docs/165-wave-1-dry-run-migration-plan.md';
const STRATEGY_DOC = 'docs/162-wave-0-external-agent-config-state-migration-strategy.md';
const INVENTORY_DOC = 'docs/163-wave-1-external-agent-config-state-read-only-inventory.md';
const MAPPING_DOC = 'docs/164-wave-1-redaction-and-secretref-mapping.md';
const SECRET_REF_BOUNDARY_DOC = 'docs/157-wave-1-external-agent-secret-ref-resolver-injection-boundary.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const NEXT_GATE = 'docs/166-wave-1-rollback-restore-rehearsal.md';

const MIGRATION_CANDIDATES = [
  '/home/grey/.external-executor/external-executor.json',
  '/home/grey/.external-executor/external-executor.json.bak*',
  '/home/grey/.external-executor/identity/device.json',
  '/home/grey/.external-executor/identity/device-auth.json',
  '/home/grey/.external-executor/devices/paired.json',
  'Channel credential candidates',
  'Provider config candidates',
  '/home/grey/.external-executor/acpx/',
  '/home/grey/.external-executor/logs/config-health.json',
  '/home/grey/.external-executor/memory/main.sqlite',
  '/home/grey/.external-executor/tasks/runs.sqlite*',
  '/home/grey/.external-executor/workspace/',
  '/home/grey/.external-executor/completions/',
  '/home/grey/.local/bin/external-executor',
];

const REQUIRED_COLUMNS = [
  'Source category/path',
  'Future Zavorth target',
  'Decision',
  'Dry-run action',
  'Redaction step',
  'SecretRef dependency',
  'Backup requirement',
  'Rollback requirement',
  'Idempotency key',
  'Import eligibility',
  'Blocked reasons',
];

const FIXTURES = [
  'dry-run-config-metadata-fixture',
  'dry-run-secretref-dependency-fixture',
  'dry-run-log-diagnostics-fixture',
  'dry-run-sqlite-session-defer-fixture',
  'dry-run-plugin-runtime-fixture',
  'dry-run-source-copy-reject-fixture',
  'dry-run-idempotency-fixture',
  'dry-run-rollback-required-fixture',
];

const OUTPUT_CONTRACT_FIELDS = [
  'nativeContract: ZavorthExternalAgentConfigStateDryRunPlan/v1',
  'executionMode: dry-run-only',
  'copyAuthorized: false',
  'migrationAuthorized: false',
  'mutationAuthorized: false',
  'rawSecretRead: false',
  'liveExternalExecutorStarted: false',
  'gatewayConnected: false',
  'sessionImported: false',
  'sqliteImported: false',
  'idempotencyKey',
  'blockedReasons',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function rowFor(content: string, itemId: string): string {
  return content.split(/\r?\n/).find((line) => line.includes(itemId)) || '';
}

describe('External agent dry-run migration plan', () => {
  it('is dry-run only and does not authorize copy, migration, mutation, or live ExternalExecutor', () => {
    const content = read(DRY_RUN_DOC);
    const lower = content.toLowerCase();

    expect(content).toContain('Status: dry-run-plan-no-migration');
    expect(content).toContain(INVENTORY_DOC);
    expect(content).toContain(MAPPING_DOC);
    [
      'real file copy blocked',
      'config/state migration blocked',
      'config/state mutation blocked',
      'raw secret read blocked',
      'raw secret print blocked',
      'token read blocked',
      'ExternalExecutor start blocked',
      'gateway connection blocked',
      'real session import blocked',
      'real SQLite import blocked',
      'tool/provider/command execution blocked',
      'plugin install blocked',
      'adapter removal blocked',
      'native replacement blocked',
      'source module copy blocked',
    ].forEach((blocked) => {
      expect(content).toContain(blocked);
    });
    expect(content).toContain('copy authorized: false');
    expect(content).toContain('migration authorized: false');
    expect(content).toContain('raw secret read authorized: false');
    expect(lower).not.toContain('migration authorized: true');
  });

  it('covers eligible and deferred categories from 163 using the required table columns', () => {
    const content = read(DRY_RUN_DOC);

    REQUIRED_COLUMNS.forEach((column) => {
      expect(content).toContain(column);
    });
    MIGRATION_CANDIDATES.forEach((candidate) => {
      const row = rowFor(content, candidate);

      expect(row).toContain(candidate);
      expect(row).toMatch(/Dry-run|Produce|Emit|Record|No-op|no-op/i);
      expect(row).toMatch(/external-executor-|Not eligible|Metadata-only|Deferred|Dry-run/i);
    });
  });

  it('consumes redaction and SecretRef mapping from 164', () => {
    const content = read(DRY_RUN_DOC);

    expect(content).toContain(SECRET_REF_BOUNDARY_DOC);
    [
      'external-executor-gateway-token',
      'external-executor-provider-api-key',
      'external-executor-channel-telegram-token',
      'external-executor-channel-discord-token',
      'external-executor-device-node-token',
      'external-executor-plugin-service-credential',
    ].forEach((secretRef) => {
      expect(content).toContain(secretRef);
    });
    expect(content).toContain('redaction steps from `164`');
    expect(content).toContain('No record may contain raw file content');
  });

  it('requires backup, rollback, and idempotency before any future mutation', () => {
    const content = read(DRY_RUN_DOC);

    [
      'backup manifest required before future mutation',
      'rollback rehearsal required before future mutation',
      'idempotency namespace assigned',
      'backup manifest required',
      'rollback operation list required',
      'draft record cleanup required',
      'SecretRef binding cleanup required',
    ].forEach((requirement) => {
      expect(content).toContain(requirement);
    });
    expect(content).toContain('dry-run-idempotency-fixture');
    expect(content).toContain('Stable idempotency keys and no duplicate planned actions.');
  });

  it('defines the dry-run output contract and deterministic fixtures', () => {
    const content = read(DRY_RUN_DOC);

    OUTPUT_CONTRACT_FIELDS.forEach((field) => {
      expect(content).toContain(field);
    });
    FIXTURES.forEach((fixture) => {
      expect(content).toContain(`\`${fixture}\``);
    });
  });

  it('blocks SQLite, session, task, and workspace import until specialized dry-runs', () => {
    const content = read(DRY_RUN_DOC);

    expect(content).toContain('Deferred; separate SQLite/session dry-run required.');
    expect(content).toContain('Deferred; separate SQLite/task dry-run required.');
    expect(content).toContain('Deferred; explicit workspace dry-run required.');
    expect(content).toContain('SQLite content import');
    expect(content).toContain('Real session import');
    expect(content).toContain('transcript replay');
  });

  it('keeps live ExternalExecutor paused and points to 166 without executing it', () => {
    const content = read(DRY_RUN_DOC);

    expect(content).toContain('live ExternalExecutor remains paused');
    expect(content).toContain(NEXT_GATE);
    expect(content).toContain('next gate executed: true');
    expect(content).toContain('rollback-restore-rehearsal-no-mutation');
    expect(content).toContain('next live gate executed: false');
    expect(content).toContain('It may rehearse backup/rollback metadata only.');
    expect(content).toContain('It must not mutate source files');
  });

  it('updates 164, 163, 162, 117, and 159 tracking docs', () => {
    const mapping = read(MAPPING_DOC);
    const inventory = read(INVENTORY_DOC);
    const strategy = read(STRATEGY_DOC);
    const pause = read(PAUSE_DOC);
    const goNoGo = read(GO_NO_GO_DOC);

    [mapping, inventory, strategy, pause, goNoGo].forEach((content) => {
      expect(content).toContain(DRY_RUN_DOC);
      expect(content).toContain('dry-run-plan-no-migration');
      expect(content).toContain(NEXT_GATE);
    });
    expect(mapping).toContain('dry-run migration plan is now documented');
    expect(inventory).toContain('next future gate after dry-run');
    expect(strategy).toContain('future gate 165 executed: true');
    expect(strategy).toContain('future gate 166 executed: true');
    expect(pause).toContain('docs/165 may define a dry-run migration plan without copying or migration');
    expect(goNoGo).toContain('dry-run migration plan');
  });
});
