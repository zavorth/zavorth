import fs from 'node:fs';
import path from 'node:path';

const DOC = 'docs/247-post-absorption-raw-history-sqlite-import-decision.md';
const SCHEMA_PARITY_DOC = 'docs/235-wave-4c3-session-storage-schema-parity-absorption-pack.md';
const METADATA_MILESTONE_DOC = 'docs/221-wave-4c-session-history-metadata-migration-milestone-report.md';
const REDACTED_MILESTONE_DOC = 'docs/229-wave-4c2-redacted-session-content-migration-milestone-report.md';
const FINAL_REPORT_DOC = 'docs/244-final-zavorth-only-absorption-hardening-and-report.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecretOrContent(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(?<![A-Za-z])sk-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  expect(serialized).not.toContain('<redacted-local-secret>');
  expect(serialized).not.toContain('raw user message body that must never migrate');
  expect(serialized).not.toContain('unredacted private message fixture');
  expect(serialized).not.toContain('attachment binary fixture that must never migrate');
}

describe('Post-absorption raw history/SQLite import decision', () => {
  it('records the raw history/SQLite import decision with default import disabled', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `post-absorption-raw-history-sqlite-import-decision-recorded`');
    expect(content).toContain('raw SQLite/history import default: disabled');
    expect(content).toContain('schema/model parity absorption: completed and preserved');
    expect(content).toContain('redacted/derived content migration: accepted');
    expect(content).toContain('raw import: optional future tool only');
    expect(content).toContain('rawHistorySqliteImportDecisionRecorded=true');
    expect(content).toContain('rawHistoryImportDefaultDisabled=true');
    expect(content).toContain('schemaModelParityAbsorptionPreserved=true');
    expect(content).toContain('rawImportFutureOptionalOnly=true');
  });

  it('keeps schema/model parity and redacted/derived migration accepted while blocking raw import classes', () => {
    const content = read(DOC);

    [
      'raw message content',
      'raw SQLite DB',
      'attachments/files',
      'logs/cache/workspace raw data',
      'secrets/tokens',
      'mutable execution state',
    ].forEach((blockedItem) => expect(content).toContain(blockedItem));

    expect(content).toContain('schema/model parity absorption: allowed and preserved');
    expect(content).toContain('session/history metadata migration: allowed');
    expect(content).toContain('redacted/derived content migration: allowed');
    expect(content).toContain('raw history import: disabled');
    expect(content).toContain('raw SQLite copy: disabled');
    expect(content).toContain('SQLite write: disabled');
    expect(content).toContain('raw secret migration: disabled');
  });

  it('defines explicit future optional raw import guardrails without authorizing the tool now', () => {
    const content = read(DOC);

    [
      'explicit operator consent',
      'preview before write',
      'redaction policy',
      'backup and rollback plan',
      'idempotency key',
      'source DB read-only open mode',
      'no SQLite source write',
      'no raw DB copy',
      'no attachments/binary payload migration',
      'no raw secret/token read or serialization',
      'no public source identity leak',
      'no provider/tool/command execution',
      'no message send',
      'This decision does not authorize that future tool',
    ].forEach((guardrail) => expect(content).toContain(guardrail));
  });

  it('updates go/no-go, pause, and final report docs with the post-absorption decision', () => {
    expect(read(GO_NO_GO_DOC)).toContain(DOC);
    expect(read(GO_NO_GO_DOC)).toContain('raw history/SQLite import decision');
    expect(read(GO_NO_GO_DOC)).toContain('is disabled by default');
    expect(read(PAUSE_DOC)).toContain('`247` records the post-absorption raw history/SQLite import decision');
    expect(read(FINAL_REPORT_DOC)).toContain('Post-absorption decision `247` keeps raw history/SQLite import disabled by');
    expect(read(FINAL_REPORT_DOC)).toContain('default. Schema/model parity absorption from `235` remains the accepted source');
    expect(read(FINAL_REPORT_DOC)).toContain('future optional tool behind a new explicit gate');
  });

  it('preserves schema parity absorption from 235 as the accepted storage model path', () => {
    const schemaParity = read(SCHEMA_PARITY_DOC);
    const decision = read(DOC);

    expect(schemaParity).toContain('rawHistoryDataMigrationAllowed=false');
    expect(schemaParity).toContain('sqliteSchemaReadOnlyAuditAllowed=true');
    expect(schemaParity).toContain('zavorthNativeSchemaAuthority=true');
    expect(schemaParity).toContain('externalExecutorSchemaUsedAsReferenceOnly=true');
    expect(decision).toContain('`235` absorbed the session/history storage schema and model shape');
    expect(decision).toContain('schema/model reference only');
  });

  it('preserves metadata and redacted/derived content migration while raw content stays blocked', () => {
    const metadata = read(METADATA_MILESTONE_DOC);
    const redacted = read(REDACTED_MILESTONE_DOC);
    const decision = read(DOC);

    expect(metadata).toContain('rawMessageContentMigrationAllowed=false');
    expect(metadata).toContain('rawSqliteCopyAllowed=false');
    expect(redacted).toContain('redactedDerivedContentMigrationMilestoneRecorded=true');
    expect(redacted).toContain('rawMessageContentMigrationAllowed=false');
    expect(redacted).toContain('rawSqliteCopyAllowed=false');
    expect(decision).toContain('`218-221` migrated only session/history metadata');
    expect(decision).toContain('`226-229` migrated only redacted or derived content metadata');
  });

  it('keeps all raw import, execution, adapter-removal, and public-identity prohibitions explicit', () => {
    const content = read(DOC);

    [
      'raw data import',
      'SQLite database copy',
      'SQLite write',
      'attachments/logs/cache/workspace raw migration',
      'provider/tool/command execution',
      'message send',
      'global adapter removal',
      'public ExternalExecutor product identity',
      'raw token serialization',
    ].forEach((prohibited) => expect(content).toContain(prohibited));
    expect(content).toContain('rawMessageContentMigrationAllowed=false');
    expect(content).toContain('rawSqliteCopyAllowed=false');
    expect(content).toContain('sqliteWriteAllowed=false');
    expect(content).toContain('attachmentsMigrationAllowed=false');
    expect(content).toContain('rawSecretMigrationAllowed=false');
    expect(content).toContain('rawSecretSerialized=false');
  });

  it('keeps the decision and updated docs free of raw data and raw secrets', () => {
    const serialized = [
      read(DOC),
      read(GO_NO_GO_DOC),
      read(PAUSE_DOC),
      read(FINAL_REPORT_DOC),
    ].join('\n');

    assertNoRawSecretOrContent(serialized);
  });
});
