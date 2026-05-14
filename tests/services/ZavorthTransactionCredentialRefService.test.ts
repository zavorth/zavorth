import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthTransactionCredentialRefService } from '../../src/services/ZavorthTransactionCredentialRefService.js';

const now = new Date('2026-05-11T12:00:00.000Z');

describe('ZavorthTransactionCredentialRefService', () => {
  let tempDir: string;
  let storeFile: string;
  let service: ZavorthTransactionCredentialRefService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-credential-test-'));
    storeFile = path.join(tempDir, 'credential-refs.jsonl');
    service = new ZavorthTransactionCredentialRefService({
      storeFile,
      now: () => now,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('registers a metadata-only exchange credential reference', () => {
    const result = service.register({
      label: 'Demo exchange paper ref',
      connectorKind: 'exchange',
      environment: 'paper',
      allowedActions: ['trade-order'],
      ownerApproved: true,
      now,
    });

    expect(result.status).toBe('registered');
    expect(result.record).toEqual(expect.objectContaining({
      connectorKind: 'exchange',
      environment: 'paper',
      allowedActions: ['trade-order'],
      ownerApproved: true,
      rawSecretStored: false,
      rawSecretSerialized: false,
      valueReadableByLlm: false,
      valueSerialized: false,
    }));
    expect(result.record?.ref).toMatch(/^vault:\/\/zavorth\/transaction\/exchange\//);
    expect(service.buildSummary()).toEqual(expect.objectContaining({
      records: 1,
      registered: 1,
      rawSecretStored: false,
      rawSecretSerialized: false,
    }));
  });

  it('validates a matching credential reference for connector dry-run use', () => {
    const registration = service.register({
      label: 'Demo exchange',
      connectorKind: 'exchange',
      environment: 'paper',
      allowedActions: ['trade-order'],
      ownerApproved: true,
      now,
    });

    const validation = service.validate({
      ref: registration.record?.ref ?? '',
      connectorKind: 'exchange',
      actionKind: 'trade-order',
      now,
    });

    expect(validation.status).toBe('ready');
    expect(validation.canUseForConnectorRun).toBe(true);
    expect(validation.valueReadableByLlm).toBe(false);
    expect(validation.rawSecretSerialized).toBe(false);
  });

  it('rejects connector kind or action mismatches', () => {
    const registration = service.register({
      label: 'Payment ref',
      connectorKind: 'payment',
      environment: 'sandbox',
      allowedActions: ['payment-submit'],
      now,
    });

    const validation = service.validate({
      ref: registration.record?.ref ?? '',
      connectorKind: 'exchange',
      actionKind: 'trade-order',
      now,
    });

    expect(validation.status).toBe('mismatch');
    expect(validation.canUseForConnectorRun).toBe(false);
    expect(validation.blockers).toEqual(
      expect.arrayContaining(['credential_connector_kind_mismatch', 'credential_action_not_allowed']),
    );
  });

  it('marks expired references as expired', () => {
    const registration = service.register({
      label: 'Old exchange',
      connectorKind: 'exchange',
      environment: 'paper',
      allowedActions: ['trade-order'],
      expiresAt: '2026-05-10T00:00:00.000Z',
      now,
    });

    const validation = service.validate({
      ref: registration.record?.ref ?? '',
      connectorKind: 'exchange',
      actionKind: 'trade-order',
      now,
    });

    expect(validation.status).toBe('expired');
    expect(validation.blockers).toContain('credential_ref_expired');
  });

  it('blocks raw secret registration without writing it to the store', () => {
    const result = service.register({
      label: 'Bad ref',
      connectorKind: 'exchange',
      secretValue: 'api_key=sk-super-secret-value-123456',
      now,
    });

    expect(result.status).toBe('blocked');
    expect(result.blockers).toContain('raw_secret_value_blocked');
    expect(JSON.stringify(result)).not.toContain('sk-super-secret-value-123456');
    expect(fs.existsSync(storeFile)).toBe(false);
  });

  it('blocks raw secret validation output', () => {
    const validation = service.validate({
      ref: 'api_key=sk-super-secret-value-123456',
      connectorKind: 'exchange',
      actionKind: 'trade-order',
      now,
    });

    expect(validation.status).toBe('blocked');
    expect(validation.ref).toBe('[REDACTED_CREDENTIAL_REF]');
    expect(JSON.stringify(validation)).not.toContain('sk-super-secret-value-123456');
  });
});
