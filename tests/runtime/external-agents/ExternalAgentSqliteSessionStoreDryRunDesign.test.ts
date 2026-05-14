import fs from 'node:fs';
import path from 'node:path';

const SQLITE_DESIGN_DOC = 'docs/167-wave-1-sqlite-session-store-dry-run-design.md';
const STRATEGY_DOC = 'docs/162-wave-0-external-agent-config-state-migration-strategy.md';
const INVENTORY_DOC = 'docs/163-wave-1-external-agent-config-state-read-only-inventory.md';
const MAPPING_DOC = 'docs/164-wave-1-redaction-and-secretref-mapping.md';
const DRY_RUN_DOC = 'docs/165-wave-1-dry-run-migration-plan.md';
const ROLLBACK_DOC = 'docs/166-wave-1-rollback-restore-rehearsal.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';

const INPUT_DOCS = [
  STRATEGY_DOC,
  INVENTORY_DOC,
  MAPPING_DOC,
  DRY_RUN_DOC,
  ROLLBACK_DOC,
  PAUSE_DOC,
];

const DATA_CLASSES = [
  'session metadata',
  'message history',
  'memory entries',
  'task records',
  'artifact references',
  'user/channel links',
];

const RISKS = [
  'private content',
  'secrets in messages',
  'duplicate sessions',
  'schema drift',
  'corrupted db',
  'huge history',
];

const FUTURE_STEPS = [
  'schema fingerprint',
  'row count only',
  'redaction plan',
  'import mapping',
  'idempotency plan',
  'rollback rehearsal',
];

const FAKE_FIXTURES = [
  'sqlite-session-metadata-fake-schema-fixture',
  'sqlite-message-history-fake-schema-fixture',
  'sqlite-memory-entries-fake-schema-fixture',
  'sqlite-task-records-fake-schema-fixture',
  'sqlite-artifact-references-fake-schema-fixture',
  'sqlite-user-channel-links-fake-schema-fixture',
  'sqlite-schema-drift-fake-schema-fixture',
  'sqlite-corrupted-db-fake-fixture',
  'sqlite-huge-history-fake-fixture',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function rowFor(content: string, itemId: string): string {
  return content.split(/\r?\n/).find((line) => line.startsWith(`| ${itemId}`)) || '';
}

describe('External agent SQLite/session store dry-run design', () => {
  it('is design-only and does not open, copy, migrate, import, or go live', () => {
    const content = read(SQLITE_DESIGN_DOC);
    const lower = content.toLowerCase();

    expect(content).toContain('Status: sqlite-session-dry-run-design-no-real-db');
    [
      'real SQLite open blocked',
      'real DB copy blocked',
      'real session migration blocked',
      'real message read blocked',
      'real memory import blocked',
      'file alteration blocked',
      'ExternalExecutor start blocked',
      'gateway connection blocked',
      'token read blocked',
      'tool/provider/command execution blocked',
      'native replacement blocked',
    ].forEach((blocked) => {
      expect(content).toContain(blocked);
    });
    [
      'real SQLite DB opened: false',
      'real DB copied: false',
      'real session migrated: false',
      'real messages read: false',
      'real memory imported: false',
      'file altered: false',
      'ExternalExecutor started: false',
      'gateway connected: false',
      'token read: false',
      'import authorized: false',
    ].forEach((decision) => {
      expect(content).toContain(decision);
    });
    expect(lower).not.toContain('import authorized: true');
  });

  it('consumes the 162 through 166 gates and the pause document', () => {
    const content = read(SQLITE_DESIGN_DOC);

    INPUT_DOCS.forEach((doc) => {
      expect(content).toContain(doc);
    });
    expect(content).toContain('inputs consumed: docs/162, docs/163, docs/164, docs/165, docs/166, docs/159');
    expect(content).toContain('Any later SQLite/session import must consume the `166` rehearsal model');
  });

  it('covers session, history, memory, task, artifact, and link classes with risks', () => {
    const content = read(SQLITE_DESIGN_DOC);

    DATA_CLASSES.forEach((dataClass) => {
      const row = rowFor(content, dataClass);

      expect(row).toContain(dataClass);
      expect(row).toMatch(/Zavorth|Deferred|Eligible|blocked|references-only/i);
    });
    RISKS.forEach((risk) => {
      expect(content).toContain(risk);
    });
  });

  it('defines schema discovery as future read-only metadata and row-count-only planning', () => {
    const content = read(SQLITE_DESIGN_DOC);

    [
      'nativeContract: ZavorthExternalAgentSqliteSchemaDiscovery/v1',
      'realDbOpenedBy167: false',
      'schemaFingerprint',
      'tableNames',
      'columnNames',
      'rowCountOnly',
      'rowContentRead: false',
      'messageContentRead: false',
      'secretContentRead: false',
      'sourceMutationAllowed: false',
    ].forEach((contractField) => {
      expect(content).toContain(contractField);
    });
    FUTURE_STEPS.forEach((step) => {
      expect(content).toContain(step);
    });
  });

  it('requires redaction, idempotency, backup, and rollback before import', () => {
    const content = read(SQLITE_DESIGN_DOC);

    DATA_CLASSES.forEach((dataClass) => {
      const row = rowFor(content, dataClass);

      expect(row).toContain(dataClass);
    });
    [
      'No row is importable by `167`',
      'Every row remains design-only',
      'backup manifest required before future mutation',
      'restore manifest required before future mutation',
      'rollback receipt required before future mutation',
      'source DB backup not created by 167',
      'source DB restore not authorized by 167',
      'source SQLite path is evidence only',
      'message redaction fixture gate',
      'stable idempotency namespace',
    ].forEach((requirement) => {
      expect(content).toContain(requirement);
    });
  });

  it('uses deterministic fake schemas and represents drift, corruption, and huge history honestly', () => {
    const content = read(SQLITE_DESIGN_DOC);

    FAKE_FIXTURES.forEach((fixture) => {
      expect(content).toContain(`\`${fixture}\``);
    });
    expect(content).toContain('Proves unknown schemas become degraded/blocked.');
    expect(content).toContain('Proves corruption is represented honestly.');
    expect(content).toContain('Proves huge history produces pagination/count planning only.');
  });

  it('keeps live ExternalExecutor paused and does not execute the next gate', () => {
    const content = read(SQLITE_DESIGN_DOC);

    expect(content).toContain('docs/168-wave-1-external-agent-live-readiness-assimilation-pack.md');
    expect(content).toContain('or specialized SQLite fixture gate');
    expect(content).toContain('Neither next gate is executed by `167`.');
    expect(content).toContain('158 -> secret-present-redacted');
    expect(content).toContain('156 -> authenticated-health-ok');
    expect(content).toContain('live ExternalExecutor paused: true');
    expect(content).toContain('next gate executed: false');
  });

  it('updates 166, 165, 117, and 159 tracking docs', () => {
    const rollback = read(ROLLBACK_DOC);
    const dryRun = read(DRY_RUN_DOC);
    const pause = read(PAUSE_DOC);
    const goNoGo = read(GO_NO_GO_DOC);

    [rollback, dryRun, pause, goNoGo].forEach((content) => {
      expect(content).toContain(SQLITE_DESIGN_DOC);
      expect(content).toContain('sqlite-session-dry-run-design-no-real-db');
    });
    expect(rollback).toContain('specialized SQLite/session dry-run design is now documented');
    expect(dryRun).toContain('specialized SQLite/session dry-run design is now documented');
    expect(pause).toContain('167` is SQLite/session dry-run design only');
    expect(goNoGo).toContain('SQLite/session store dry-run design');
  });
});
