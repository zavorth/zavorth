import fs from 'node:fs';
import path from 'node:path';

const REHEARSAL_DOC = 'docs/166-wave-1-rollback-restore-rehearsal.md';
const DRY_RUN_DOC = 'docs/165-wave-1-dry-run-migration-plan.md';
const STRATEGY_DOC = 'docs/162-wave-0-external-agent-config-state-migration-strategy.md';
const MAPPING_DOC = 'docs/164-wave-1-redaction-and-secretref-mapping.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';

const REHEARSAL_CANDIDATES = [
  'ExternalExecutor runtime/gateway config metadata',
  'Config backup evidence',
  'Device identity metadata',
  'Device auth',
  'Paired device state',
  'Channel credential candidates',
  'Provider config candidates',
  'Plugin manifest/cache and runtime metadata',
  'Redacted diagnostics from logs',
  'Memory/session SQLite store',
  'Task SQLite store',
  'Workspace/user artifacts',
  'Generated completions, canvas artifact, update metadata',
  'CLI binary and vendor checkout',
];

const FAILURE_CASES = [
  'backup-unavailable',
  'checksum-mismatch',
  'restore-target-unsafe',
  'rollback-partial',
  'secret-redaction-violation',
  'idempotency-conflict',
];

const FIXTURES = [
  'rollback-config-metadata-rehearsal-fixture',
  'rollback-secretref-binding-rehearsal-fixture',
  'rollback-log-diagnostics-rehearsal-fixture',
  'rollback-sqlite-session-defer-fixture',
  'rollback-workspace-privacy-defer-fixture',
  'rollback-source-copy-reject-fixture',
  'rollback-checksum-mismatch-fixture',
  'rollback-unsafe-target-fixture',
  'rollback-idempotency-conflict-fixture',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function rowFor(content: string, itemId: string): string {
  return content.split(/\r?\n/).find((line) => line.includes(itemId)) || '';
}

describe('External agent rollback/restore rehearsal', () => {
  it('is rehearsal-only and does not create, copy, restore, mutate, or go live', () => {
    const content = read(REHEARSAL_DOC);
    const lower = content.toLowerCase();

    expect(content).toContain('Status: rollback-restore-rehearsal-no-mutation');
    expect(content).toContain(DRY_RUN_DOC);
    [
      'real file copy blocked',
      'real backup creation blocked',
      'real restore blocked',
      'config/state migration blocked',
      'config/state mutation blocked',
      'raw secret read blocked',
      'token read blocked',
      'ExternalExecutor start blocked',
      'gateway connection blocked',
      'real session import blocked',
      'real SQLite import blocked',
      'tool/provider/command execution blocked',
      'adapter removal blocked',
      'native replacement blocked',
      'source module copy blocked',
    ].forEach((blocked) => {
      expect(content).toContain(blocked);
    });
    expect(content).toContain('real backup created: false');
    expect(content).toContain('real restore executed: false');
    expect(content).toContain('file copied: false');
    expect(content).toContain('migration authorized: false');
    expect(lower).not.toContain('migration authorized: true');
  });

  it('defines backup, restore, and rollback receipt contracts', () => {
    const content = read(REHEARSAL_DOC);

    [
      'nativeContract: ZavorthExternalAgentBackupManifest/v1',
      'nativeContract: ZavorthExternalAgentRestoreManifest/v1',
      'nativeContract: ZavorthExternalAgentRollbackReceipt/v1',
      'backup manifest contract defined: true',
      'restore manifest contract defined: true',
      'rollback receipt contract defined: true',
      'expectedChecksumMode',
      'expectedChecksumValue: absent-in-166',
      'sourceFilesChanged: false',
      'ZavorthRecordsChanged: false',
      'rawSecretObserved: false',
    ].forEach((contractField) => {
      expect(content).toContain(contractField);
    });
  });

  it('rehearses candidates from the 165 dry-run plan', () => {
    const content = read(REHEARSAL_DOC);

    REHEARSAL_CANDIDATES.forEach((candidate) => {
      const row = rowFor(content, candidate);

      expect(row).toContain(candidate);
      expect(row).toMatch(/receipt|rehearsed|blocked|deferred|rejected|no-op/i);
    });
  });

  it('blocks unsafe restore targets and secret redaction violations', () => {
    const content = read(REHEARSAL_DOC);

    expect(content).toContain('Restore targets must be Zavorth-owned draft records');
    expect(content).toContain('Source paths are evidence only and cannot be');
    expect(content).toContain('restore-target-unsafe');
    expect(content).toContain('secret-redaction-violation');
    expect(content).toContain('rawSecretObserved false');
    expect(content).toContain('Block plan and require `164` redaction rule fix.');
  });

  it('covers required failure cases and deterministic fixtures', () => {
    const content = read(REHEARSAL_DOC);

    FAILURE_CASES.forEach((failureCase) => {
      expect(content).toContain(`\`${failureCase}\``);
    });
    FIXTURES.forEach((fixture) => {
      expect(content).toContain(`\`${fixture}\``);
    });
  });

  it('keeps SQLite, sessions, workspace, credentials, and source copy deferred or rejected', () => {
    const content = read(REHEARSAL_DOC);

    [
      'defer SQLite/session restore to specialized dry-run',
      'defer workspace/user artifact restore to privacy dry-run',
      'defer channel credential restore until SecretRef provisioning',
      'defer provider credential restore until SecretRef provisioning',
      'defer device/node trust restore until worker policy gate',
      'reject source module copy',
      'sessionImportedFalse',
      'sqliteImportedFalse',
    ].forEach((rule) => {
      expect(content).toContain(rule);
    });
  });

  it('keeps live ExternalExecutor paused and does not authorize migration', () => {
    const content = read(REHEARSAL_DOC);

    expect(content).toContain('remain paused-on-secret-provisioning');
    expect(content).toContain('remain paused until secret provisioned');
    expect(content).toContain('then docs/158-wave-1-external-executor-gateway-secret-ref-provisioning.md -> secret-present-redacted');
    expect(content).toContain('then docs/156-wave-1-authenticated-ephemeral-external-executor-gateway-health-probe.md -> authenticated-health-ok');
    expect(content).toContain('then docs/161-wave-1-real-capability-snapshot-read-only.md');
    expect(content).toContain('or open a specialized dry-run for SQLite/session stores');
    expect(content).toContain('None of those are executed by `166`.');
    expect(content).toContain('next live gate executed: false');
  });

  it('updates 165, 164, 162, 117, and 159 tracking docs', () => {
    const dryRun = read(DRY_RUN_DOC);
    const mapping = read(MAPPING_DOC);
    const strategy = read(STRATEGY_DOC);
    const pause = read(PAUSE_DOC);
    const goNoGo = read(GO_NO_GO_DOC);

    [dryRun, mapping, strategy, pause, goNoGo].forEach((content) => {
      expect(content).toContain(REHEARSAL_DOC);
      expect(content).toContain('rollback-restore-rehearsal-no-mutation');
    });
    expect(dryRun).toContain('rollback/restore rehearsal is now documented');
    expect(mapping).toContain('next future gate executed: true');
    expect(strategy).toContain('future gate 166 executed: true');
    expect(pause).toContain('166` is rollback/restore rehearsal only');
    expect(goNoGo).toContain('rollback/restore rehearsal');
  });
});
