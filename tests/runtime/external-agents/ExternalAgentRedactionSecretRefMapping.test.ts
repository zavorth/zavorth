import fs from 'node:fs';
import path from 'node:path';

const MAPPING_DOC = 'docs/164-wave-1-redaction-and-secretref-mapping.md';
const INVENTORY_DOC = 'docs/163-wave-1-external-agent-config-state-read-only-inventory.md';
const STRATEGY_DOC = 'docs/162-wave-0-external-agent-config-state-migration-strategy.md';
const SECRET_REF_BOUNDARY_DOC = 'docs/157-wave-1-external-agent-secret-ref-resolver-injection-boundary.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const NEXT_GATE = 'docs/165-wave-1-dry-run-migration-plan.md';
const NEXT_FUTURE_GATE = 'docs/166-wave-1-rollback-restore-rehearsal.md';

const SENSITIVE_CATEGORIES = [
  '/home/grey/.external-executor/external-executor.json',
  '/home/grey/.external-executor/external-executor.json.bak*',
  '/home/grey/.external-executor/identity/device-auth.json',
  '/home/grey/.external-executor/devices/paired.json',
  'Channel credential candidates',
  'Provider config candidates',
  '/home/grey/.external-executor/acpx/',
  '/home/grey/.external-executor/memory/main.sqlite',
  '/home/grey/.external-executor/tasks/runs.sqlite*',
  '/home/grey/.external-executor/logs/config-health.json',
  '/home/grey/.external-executor/workspace/',
  '/home/grey/.local/bin/external-executor',
];

const CANONICAL_SECRET_REFS = [
  'external-executor-gateway-token',
  'external-executor-channel-telegram-token',
  'external-executor-channel-discord-token',
  'external-executor-provider-api-key',
  'external-executor-device-node-token',
  'external-executor-plugin-service-credential',
];

const SAFE_METADATA_FIELDS = [
  'path',
  'exists',
  'kind',
  'size',
  'mode',
  'mtime',
  'childCount',
  'storeType',
  'gatewayPort',
  'gatewayBind',
  'gatewayMode',
  'authMode',
  'configuredBoolean',
  'enabledBoolean',
  'degradedState',
  'offlineState',
  'errorClass',
  'sourceEvidenceId',
  'SecretRef id',
];

const FORBIDDEN_OUTPUTS = [
  'raw token',
  'raw password',
  'raw API key',
  'raw bearer credential',
  'raw OAuth token',
  'raw webhook secret',
  'raw signing secret',
  'raw provider credential',
  'raw device auth secret',
  'raw node trust secret',
  'raw plugin service credential',
  'raw session transcript',
  'raw memory content',
  'raw task payload containing secrets',
  'secret hash',
  'secret length',
  'credentialed URL',
  'Authorization header',
  'source env value',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function rowFor(content: string, itemId: string): string {
  return content.split(/\r?\n/).find((line) => line.includes(itemId)) || '';
}

describe('External agent redaction and SecretRef mapping', () => {
  it('is a no-migration mapping gate that consumes the 163 inventory', () => {
    const content = read(MAPPING_DOC);
    const lower = content.toLowerCase();

    expect(content).toContain('Status: redaction-secretref-mapping-no-migration');
    expect(content).toContain(INVENTORY_DOC);
    expect(content).toContain(SECRET_REF_BOUNDARY_DOC);
    [
      'raw secret read blocked',
      'raw secret print blocked',
      'token read blocked',
      'token print blocked',
      'file copy blocked',
      'config/state migration blocked',
      'config/state mutation blocked',
      'ExternalExecutor start blocked',
      'gateway connection blocked',
      'real session import blocked',
      'tool/provider/command execution blocked',
      'source module copy blocked',
      'adapter removal blocked',
      'native replacement blocked',
    ].forEach((blocked) => {
      expect(content).toContain(blocked);
    });
    expect(content).toContain('migration authorized: false');
    expect(content).toContain('copy authorized: false');
    expect(lower).not.toContain('migration authorized: true');
  });

  it('covers all sensitive categories from the read-only inventory', () => {
    const content = read(MAPPING_DOC);

    SENSITIVE_CATEGORIES.forEach((category) => {
      expect(content).toContain(category);
    });
    [
      'auth/secrets',
      'channel credentials',
      'provider config',
      'node/worker registry',
      'plugin manifest/cache',
      'plugin runtime state',
      'session/history store',
      'artifacts/logs',
      'telemetry/diagnostics',
    ].forEach((category) => {
      expect(content).toContain(category);
    });
  });

  it('defines canonical Zavorth SecretRefs and keeps command args prohibited by default', () => {
    const content = read(MAPPING_DOC);

    CANONICAL_SECRET_REFS.forEach((secretRef) => {
      const row = rowFor(content, secretRef);

      expect(row).toContain(secretRef);
      expect(row).toMatch(/defined|candidate/);
    });
    expect(content).toContain('All names above are Zavorth canonical names');
    expect(content).toMatch(/Source config\s+names remain evidence only/);
    expect(content).toContain('command-arg` prohibited by default');
  });

  it('blocks raw secret output and secret-derived metadata', () => {
    const content = read(MAPPING_DOC);

    FORBIDDEN_OUTPUTS.forEach((forbidden) => {
      expect(content).toContain(forbidden);
    });
    expect(content).toContain('raw secret never serialized');
    expect(content).toContain('raw secret output authorized: false');
    expect(content).toContain('raw token, API key, password, bearer string');
    expect(content).toContain('secret hash');
    expect(content).toContain('secret length');
  });

  it('marks safe metadata fields without granting source authority', () => {
    const content = read(MAPPING_DOC);

    SAFE_METADATA_FIELDS.forEach((field) => {
      expect(content).toContain(field);
    });
    expect(content).toContain('Safe metadata is still evidence');
    expect(content).toContain('does not grant runtime authority');
    expect(content).toContain('does not grant runtime authority, source');
  });

  it('requires separate dry-run gates for logs, SQLite, sessions, and future mutation', () => {
    const content = read(MAPPING_DOC);

    expect(content).toContain('logs are redacted before any future import');
    expect(content).toContain('SQLite/session stores require separate dry-run gate');
    expect(content).toContain('backup required before future mutation');
    expect(content).toContain('Not eligible until separate `165` dry-run and privacy gate.');
    expect(content).toContain('Eligible only as redacted diagnostics after tests pass; no import yet.');
  });

  it('records the dry-run plan handoff and keeps rollback rehearsal unexecuted', () => {
    const content = read(MAPPING_DOC);

    expect(content).toContain(NEXT_GATE);
    expect(content).toContain('next gate executed: true');
    expect(content).toContain('dry-run-plan-no-migration');
    expect(content).toContain(NEXT_FUTURE_GATE);
    expect(content).toContain('next future gate executed: true');
    expect(content).toContain('rollback-restore-rehearsal-no-mutation');
    expect(content).toContain('It may produce an idempotent dry-run plan only.');
    expect(content).toContain('It must not copy files, mutate');
  });

  it('updates 163, 162, and 117 tracking docs', () => {
    const inventory = read(INVENTORY_DOC);
    const strategy = read(STRATEGY_DOC);
    const goNoGo = read(GO_NO_GO_DOC);

    [inventory, strategy, goNoGo].forEach((content) => {
      expect(content).toContain(MAPPING_DOC);
      expect(content).toContain('redaction-secretref-mapping-no-migration');
      expect(content).toContain(NEXT_GATE);
      expect(content).toContain(NEXT_FUTURE_GATE);
    });
    expect(inventory).toContain('redaction and SecretRef mapping is now documented');
    expect(strategy).toContain('future gate 164 executed: true');
    expect(strategy).toContain('future gate 165 executed: true');
    expect(strategy).toContain('future gate 166 executed: true');
    expect(goNoGo).toContain('redaction and SecretRef mapping');
  });
});
