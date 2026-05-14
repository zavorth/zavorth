import fs from 'node:fs';
import path from 'node:path';

const INVENTORY_DOC = 'docs/163-wave-1-external-agent-config-state-read-only-inventory.md';
const STRATEGY_DOC = 'docs/162-wave-0-external-agent-config-state-migration-strategy.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const NEXT_GATE = 'docs/164-wave-1-redaction-and-secretref-mapping.md';
const NEXT_FUTURE_GATE = 'docs/165-wave-1-dry-run-migration-plan.md';
const ROLLBACK_GATE = 'docs/166-wave-1-rollback-restore-rehearsal.md';

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

const REQUIRED_COLUMNS = [
  'Path/category',
  'Exists',
  'Kind',
  'Size/count metadata',
  'Decision from `162`',
  'Risk',
  'Secret/redaction requirement',
  'Backup/rollback requirement',
  'Import eligibility',
  'Notes',
];

const INVENTORY_ROWS = [
  '/home/grey/.external-executor/external-executor.json',
  '/home/grey/.external-executor/external-executor.json.bak',
  '/home/grey/.external-executor/external-executor.json.last-good',
  '/home/grey/.external-executor/identity/device-auth.json',
  '/home/grey/.external-executor/devices/paired.json',
  '/home/grey/.external-executor/memory/main.sqlite',
  '/home/grey/.external-executor/tasks/runs.sqlite*',
  '/home/grey/.external-executor/logs/config-health.json',
  '/home/grey/.external-executor/logs/config-audit.jsonl',
  '/home/grey/.external-executor/acpx/',
  '/home/grey/.external-executor/workspace/',
  'C:\\TESTES DEV\\zavorth-core\\Zavorth\\data\\vendor\\external-executor-repo',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function rowFor(content: string, itemId: string): string {
  return content.split(/\r?\n/).reverse().find((line) => line.includes(itemId)) || '';
}

describe('External agent config/state read-only inventory', () => {
  it('is read-only and keeps migration, copy, mutation, and live ExternalExecutor blocked', () => {
    const content = read(INVENTORY_DOC);
    const lower = content.toLowerCase();

    expect(content).toContain('Status: read-only-inventory-no-migration');
    expect(content).toContain(STRATEGY_DOC);
    expect(content).toContain(PAUSE_DOC);
    [
      'migration execution blocked',
      'file copy blocked',
      'ExternalExecutor config/state copy blocked',
      'raw secret read blocked',
      'raw secret print blocked',
      'token read blocked',
      'token print blocked',
      'config/state mutation blocked',
      'ExternalExecutor start blocked',
      'gateway connection blocked',
      'real session import blocked',
      'plugin install blocked',
      'tool/provider/command execution blocked',
      'source module copy blocked',
      'adapter removal blocked',
      'native replacement blocked',
    ].forEach((blocked) => {
      expect(content).toContain(blocked);
    });
    expect(content).toContain('migration authorized: false');
    expect(content).toContain('copy authorized: false');
    expect(content).toContain('live ExternalExecutor authorized: false');
    expect(lower).not.toContain('migration authorized: true');
  });

  it('uses metadata-only collection and records the required inventory columns', () => {
    const content = read(INVENTORY_DOC);

    expect(content).toContain('No file content was accepted into this report.');
    expect(content).toContain('Hashing was intentionally skipped');
    expect(content).toContain('existence, type, size, timestamp, mode, and shallow child-count collection');
    REQUIRED_COLUMNS.forEach((column) => {
      expect(content).toContain(column);
    });
    [
      'Windows Get-Item/Get-ChildItem metadata',
      'WSL test/stat metadata',
      'WSL find -maxdepth 1 or 2',
    ].forEach((method) => {
      expect(content).toContain(method);
    });
  });

  it('covers all data classes from the 162 strategy', () => {
    const content = read(INVENTORY_DOC);

    DATA_CLASSES.forEach((dataClass) => {
      expect(content).toContain(`${dataClass} covered`);
    });
  });

  it('records candidate roots and inventory rows with risk and import eligibility', () => {
    const content = read(INVENTORY_DOC);

    [
      '/home/grey/.local/bin/external-executor',
      '/home/grey/.external-executor',
      '/home/grey/.external-executor/logs',
      '/tmp/external-executor',
      'docs/external-agent-absorption/external-executor/',
    ].forEach((root) => {
      expect(content).toContain(root);
    });

    INVENTORY_ROWS.forEach((rowId) => {
      const row = rowFor(content, rowId);

      expect(row).toContain(rowId);
      expect(row).toMatch(/Critical|High|Medium|Low/);
      expect(row).toMatch(/Not eligible|Eligible only|Metadata-only/);
    });
  });

  it('classifies secret-bearing paths as SecretRef or redaction-only', () => {
    const content = read(INVENTORY_DOC);

    [
      '/home/grey/.external-executor/external-executor.json',
      '/home/grey/.external-executor/identity/device-auth.json',
      '/home/grey/.external-executor/devices/paired.json',
    ].forEach((rowId) => {
      const row = rowFor(content, rowId);

      expect(row).toMatch(/SecretRef only|Redaction required|redaction required/);
      expect(row).not.toMatch(/raw token|secret value/i);
    });
    expect(content).toContain('secret-bearing candidates exist and must be `SecretRef only`');
    expect(content).toContain('raw secret read authorized: false');
  });

  it('documents forbidden findings and keeps raw content out of the gate', () => {
    const content = read(INVENTORY_DOC);

    [
      'raw secret printed: false',
      'raw token printed: false',
      'file content accepted: false',
      'file copied: false',
      'config migrated: false',
      'state migrated: false',
      'session imported: false',
      'ExternalExecutor started: false',
      'gateway connected: false',
      'tool/provider/command executed: false',
      'source module copied: false',
      'adapter removed: false',
      'native replacement performed: false',
    ].forEach((finding) => {
      expect(content).toContain(finding);
    });
  });

  it('records the redaction/SecretRef mapping handoff and keeps dry-run unexecuted', () => {
    const content = read(INVENTORY_DOC);

    expect(content).toContain(NEXT_GATE);
    expect(content).toContain('next gate executed: true');
    expect(content).toContain(NEXT_FUTURE_GATE);
    expect(content).toContain('next future gate executed: true');
    expect(content).toContain(ROLLBACK_GATE);
    expect(content).toContain('next future gate after dry-run executed: true');
    expect(content).toContain('redaction-secretref-mapping-no-migration');
    expect(content).toContain('dry-run-plan-no-migration');
    expect(content).toContain('rollback-restore-rehearsal-no-mutation');
    expect(content).toContain('That gate must map secret-bearing paths and keys into `SecretRef`/redaction');
    expect(content).toMatch(/It must not migrate, copy,\s+mutate, start ExternalExecutor/);
  });

  it('updates 162, 117, and 159 while keeping migration blocked', () => {
    const strategy = read(STRATEGY_DOC);
    const pause = read(PAUSE_DOC);
    const goNoGo = read(GO_NO_GO_DOC);

    [strategy, pause, goNoGo].forEach((content) => {
      expect(content).toContain(INVENTORY_DOC);
      expect(content).toContain('read-only-inventory-no-migration');
    });
    expect(strategy).toContain('future gate 163 executed: true');
    expect(strategy).toContain(NEXT_GATE);
    expect(strategy).toContain('future gate 164 executed: true');
    expect(strategy).toContain(NEXT_FUTURE_GATE);
    expect(strategy).toContain('future gate 165 executed: true');
    expect(strategy).toContain(ROLLBACK_GATE);
    expect(pause).toContain('real-capability-snapshot-read-only-ok');
    expect(pause).toContain('docs/163 may inventory config/state path metadata read-only without migration');
    expect(goNoGo).toContain('the next allowed artifact is');
    expect(goNoGo).toContain(ROLLBACK_GATE);
  });
});
