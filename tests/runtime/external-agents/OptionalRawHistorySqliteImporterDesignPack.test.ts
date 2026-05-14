import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_OPTIONAL_RAW_HISTORY_SQLITE_IMPORTER_DESIGN_PACK_RUNTIME_ID,
  createOptionalRawHistorySqliteImporterDesignSource,
  createOptionalRawHistorySqliteImporterFixture,
  normalizeOptionalRawHistorySqliteImporterDesignPack,
} from '../../../src/runtime/external-agents/index.js';
import type {
  OptionalRawHistorySqliteImporterDesignSource,
  OptionalRawHistorySqliteSourceDbState,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/254-post-absorption-optional-raw-history-sqlite-importer-design-pack.md';
const RAW_IMPORT_DECISION_DOC = 'docs/247-post-absorption-raw-history-sqlite-import-decision.md';
const PARALLEL_HARDENING_DOC = 'docs/251-post-absorption-parallel-hardening-pack.md';
const SCHEMA_PARITY_DOC = 'docs/235-wave-4c3-session-storage-schema-parity-absorption-pack.md';
const BOUNDARY = 'src/runtime/external-agents/OptionalRawHistorySqliteImporterDesignPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

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

describe('Optional raw history/SQLite importer design pack', () => {
  let source: OptionalRawHistorySqliteImporterDesignSource;
  let importer: ReturnType<typeof createOptionalRawHistorySqliteImporterFixture>;

  beforeAll(() => {
    source = createOptionalRawHistorySqliteImporterDesignSource();
    importer = createOptionalRawHistorySqliteImporterFixture();
  });

  it('documents 254 as a design-only optional raw history/SQLite importer gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `optional-raw-history-sqlite-importer-design-ready`');
    expect(content).toContain('OptionalRawHistorySqliteImporterDesignPack.ts');
    expect(content).toContain('OptionalRawHistorySqliteImporterDesignPack/v1');
    expect(content).toContain('OptionalRawHistorySqliteImporterModePolicy/v1');
    expect(content).toContain('OptionalRawHistorySqliteConsentPolicy/v1');
    expect(content).toContain('OptionalRawHistorySqliteSourceDbSafety/v1');
    expect(content).toContain('OptionalRawHistorySqlitePreviewReceipt/v1');
    expect(content).toContain('optionalRawHistorySqliteImporterDesignCreated=true');
    expect(content).toContain('rawImportDefaultDisabled=true');
    expect(content).toContain('explicitOperatorConsentRequired=true');
    expect(content).toContain('previewRequiredBeforeImport=true');
    expect(content).toContain('sourceDbReadOnlyRequired=true');
    expect(content).toContain('sqliteWriteAllowed=false');
    expect(content).toContain('rawImportActuallyPerformed=false');
    expect(content).toContain('rawDbCopied=false');
    expect(content).toContain('attachmentsImportAllowed=false');
    expect(content).toContain('Do not advance to `255`');
    assertNoRawSecretOrContent(content);
  });

  it('uses 247, 251, and 235 evidence without reopening default raw import', () => {
    const decision = read(RAW_IMPORT_DECISION_DOC);
    const parallel = read(PARALLEL_HARDENING_DOC);
    const schema = read(SCHEMA_PARITY_DOC);
    const doc = read(DOC);

    expect(decision).toContain('rawHistoryImportDefaultDisabled=true');
    expect(decision).toContain('raw import: optional future tool only');
    expect(parallel).toContain('subagentCOptionalRawHistorySqliteImporterPlan=recorded');
    expect(parallel).toContain('raw import default: disabled');
    expect(schema).toContain('sqliteSchemaReadOnlyAuditAllowed=true');
    expect(schema).toContain('sqliteDataImportAllowed=false');
    expect(doc).toContain(RAW_IMPORT_DECISION_DOC);
    expect(doc).toContain(PARALLEL_HARDENING_DOC);
    expect(doc).toContain(SCHEMA_PARITY_DOC);
  });

  it('exports the importer boundary and native contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('OptionalRawHistorySqliteImporterDesignPack/v1');
    expect(boundary).toContain('OptionalRawHistorySqliteImporterModePolicy/v1');
    expect(boundary).toContain('OptionalRawHistorySqliteSourceDbSafety/v1');
    expect(boundary).toContain('OptionalRawHistorySqlitePreviewReceipt/v1');
    expect(index).toContain("from './OptionalRawHistorySqliteImporterDesignPack.js'");
    expect(index).toContain('ZAVORTH_OPTIONAL_RAW_HISTORY_SQLITE_IMPORTER_DESIGN_PACK_RUNTIME_ID');
  });

  it('keeps raw import disabled by default and supports only non-import modes in this gate', () => {
    expect(importer.normalization.decision).toBe('optional-raw-history-sqlite-importer-design-ready');
    expect(importer.rawImportDisabledByDefault()).toBe(true);
    expect(importer.defaultMode()).toEqual(expect.objectContaining({
      mode: 'disabled',
      defaultMode: true,
      importMayRunInThisGate: false,
      rawContentSerializedByDefault: false,
      rawSecretSerialized: false,
    }));
    expect(importer.normalization.modePolicies.map((mode) => mode.mode)).toEqual([
      'disabled',
      'preview-only',
      'redacted-import-future',
      'raw-import-future-explicit-consent',
      'blocked',
    ]);
    importer.normalization.modePolicies.forEach((mode) => {
      expect(mode.importMayRunInThisGate).toBe(false);
      expect(mode.rawSecretSerialized).toBe(false);
    });
  });

  it('models preview as metadata and redacted stats only without raw content serialization', () => {
    const previewImporter = createOptionalRawHistorySqliteImporterFixture({
      requestedMode: 'preview-only',
      previewCompleted: true,
      sourceDbState: 'compatible-for-preview',
    });

    expect(previewImporter.normalization.decision).toBe('optional-raw-history-sqlite-importer-design-ready');
    expect(previewImporter.normalization.previewReceipt).toEqual({
      nativeContract: 'OptionalRawHistorySqlitePreviewReceipt/v1',
      previewMode: 'metadata-redacted-stats-only',
      previewRequiredBeforeImport: true,
      previewCompleted: true,
      tableStatsOnly: true,
      schemaFingerprintIncluded: true,
      checksumPlanned: true,
      idempotencyKeyPlanned: true,
      redactedStatsIncluded: true,
      rawRowsRead: false,
      rawMessageContentSerialized: false,
      rawDbCopied: false,
      attachmentPayloadSerialized: false,
      rawSecretSerialized: false,
    });
  });

  it('requires explicit consent, preview, redaction policy, and backup/rollback for future import modes', () => {
    const missingConsent = normalizeOptionalRawHistorySqliteImporterDesignPack({
      generatedAt: '2026-05-01T20:01:00.000Z',
      runtimeId: ZAVORTH_OPTIONAL_RAW_HISTORY_SQLITE_IMPORTER_DESIGN_PACK_RUNTIME_ID,
      source: createOptionalRawHistorySqliteImporterDesignSource({
        requestedMode: 'raw-import-future-explicit-consent',
        sourceDbState: 'compatible-for-preview',
      }),
    });
    const futureReadyDesign = createOptionalRawHistorySqliteImporterFixture({
      requestedMode: 'raw-import-future-explicit-consent',
      explicitOperatorConsentProvided: true,
      previewCompleted: true,
      redactionPolicyApprovedForFutureGate: true,
      backupRollbackPlanned: true,
      sourceDbState: 'compatible-for-preview',
    });

    expect(missingConsent.decision).toBe('blocked');
    expect(missingConsent.consentPolicy.explicitOperatorConsentRequired).toBe(true);
    expect(missingConsent.consentPolicy.consentAllowsImportInThisGate).toBe(false);
    expect(futureReadyDesign.normalization.decision).toBe('optional-raw-history-sqlite-importer-design-ready');
    expect(futureReadyDesign.normalization.consentPolicy.consentProvidedForThisGate).toBe(true);
    expect(futureReadyDesign.normalization.consentPolicy.consentAllowsImportInThisGate).toBe(false);
    ['explicit-operator-consent', 'preview-before-write', 'redaction-policy', 'backup-rollback'].forEach((requirementId) => {
      expect(futureReadyDesign.futureGateRequirement(requirementId as never)).toEqual(expect.objectContaining({
        requiredForFutureImport: true,
        satisfiedInThisDesignGate: true,
        importAuthorizedNow: false,
      }));
    });
  });

  it('blocks SQLite write, raw DB copy, attachments, secrets, messages, providers, tools, commands, adapter removal, and public source identity', () => {
    const blockedCases: Array<keyof OptionalRawHistorySqliteImporterDesignSource> = [
      'rawImportAttempted',
      'sqliteWriteAttempted',
      'rawDbCopyAttempted',
      'rawContentSerialized',
      'attachmentImportAttempted',
      'secretMigrationAttempted',
      'messageSendAttempted',
      'providerExecutionAttempted',
      'toolCommandExecutionAttempted',
      'adapterRemovalAttempted',
      'publicExternalExecutorIdentityExposed',
      'rawSecretSerialized',
    ];

    blockedCases.forEach((key) => {
      const normalization = normalizeOptionalRawHistorySqliteImporterDesignPack({
        generatedAt: '2026-05-01T20:02:00.000Z',
        runtimeId: ZAVORTH_OPTIONAL_RAW_HISTORY_SQLITE_IMPORTER_DESIGN_PACK_RUNTIME_ID,
        source: { ...source, [key]: true } as unknown as OptionalRawHistorySqliteImporterDesignSource,
      });

      expect(normalization.decision).toBe('blocked');
      expect(normalization.executionGate.sqliteWriteAllowed).toBe(false);
      expect(normalization.executionGate.rawImportActuallyPerformed).toBe(false);
      expect(normalization.executionGate.rawDbCopied).toBe(false);
      expect(normalization.executionGate.attachmentsImportAllowed).toBe(false);
      expect(normalization.executionGate.rawSecretSerialized).toBe(false);
      expect(normalization.executionGate.messageActuallySent).toBe(false);
      expect(normalization.executionGate.providerActuallyExecuted).toBe(false);
      expect(normalization.executionGate.toolCommandActuallyExecuted).toBe(false);
      expect(normalization.executionGate.adapterRemovalGlobalAllowed).toBe(false);
    });
  });

  it('blocks or degrades unknown, corrupt, and incompatible source DB states', () => {
    const cases: Array<[OptionalRawHistorySqliteSourceDbState, string]> = [
      ['unknown', 'blocked-unknown-db'],
      ['corrupt', 'blocked-corrupt-db'],
      ['incompatible', 'blocked-incompatible-db'],
    ];

    cases.forEach(([sourceDbState, outcome]) => {
      const normalization = normalizeOptionalRawHistorySqliteImporterDesignPack({
        generatedAt: '2026-05-01T20:03:00.000Z',
        runtimeId: ZAVORTH_OPTIONAL_RAW_HISTORY_SQLITE_IMPORTER_DESIGN_PACK_RUNTIME_ID,
        source: createOptionalRawHistorySqliteImporterDesignSource({
          requestedMode: 'preview-only',
          previewCompleted: true,
          sourceDbState,
        }),
      });

      expect(normalization.decision).toBe('blocked');
      expect(normalization.sourceDbSafety.outcome).toBe(outcome);
      expect(
        normalization.sourceDbSafety.unknownDbBlocked ||
          normalization.sourceDbSafety.corruptDbBlocked ||
          normalization.sourceDbSafety.incompatibleDbBlocked,
      ).toBe(true);
    });
  });

  it('keeps execution gate guarantees exact and future gate requirements documented', () => {
    expect(importer.normalization.executionGate).toEqual({
      optionalRawHistorySqliteImporterDesignCreated: true,
      rawImportDefaultDisabled: true,
      explicitOperatorConsentRequired: true,
      previewRequiredBeforeImport: true,
      sourceDbReadOnlyRequired: true,
      sqliteWriteAllowed: false,
      rawImportActuallyPerformed: false,
      rawDbCopied: false,
      attachmentsImportAllowed: false,
      rawSecretSerialized: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      adapterRemovalGlobalAllowed: false,
    });
    expect(importer.normalization.futureImportGateRequirements.map((requirement) => requirement.requirementId)).toEqual([
      'explicit-operator-consent',
      'preview-before-write',
      'redaction-policy',
      'backup-rollback',
      'idempotency-key',
      'checksum-validation',
      'source-db-read-only',
      'target-namespace',
      'write-feature-flag',
      'audit-receipt',
    ]);
    importer.normalization.futureImportGateRequirements.forEach((requirement) => {
      expect(requirement.requiredForFutureImport).toBe(true);
      expect(requirement.importAuthorizedNow).toBe(false);
    });
  });

  it('keeps serialized output redacted and free of raw history, content, attachments, or secrets', () => {
    const serialized = JSON.stringify(importer.normalization);

    expect(importer.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      rawHistoryDataSerialized: false,
      attachmentPayloadSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(importer.normalization.nextGateRecommended).toBe(
      'future-optional-raw-import-implementation-only-with-explicit-operator-consent',
    );
    assertNoRawSecretOrContent(serialized);
  });
});
