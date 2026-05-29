import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthTransactionApprovalLedgerService } from '../../src/services/ZavorthTransactionApprovalLedgerService.js';
import { ZavorthTransactionZavorthControlProjectionService } from '../../src/services/ZavorthTransactionZavorthControlProjectionService.js';
import { ZavorthTransactionConnectorRegistryService } from '../../src/services/ZavorthTransactionConnectorRegistryService.js';
import { ZavorthTransactionCredentialRefService } from '../../src/services/ZavorthTransactionCredentialRefService.js';
import { ZavorthTransactionPreviewService } from '../../src/services/ZavorthTransactionPreviewService.js';
import { ZavorthTransactionRuntimeOrchestratorService } from '../../src/services/ZavorthTransactionRuntimeOrchestratorService.js';
import { ZavorthTransactionSurfaceGatewayService } from '../../src/services/ZavorthTransactionSurfaceGatewayService.js';

const now = new Date('2026-05-11T12:00:00.000Z');
const signingKey = 'zavorthControl-controls-test-signing-key-000000000000000000000000000000';

describe('ZavorthTransactionZavorthControlProjectionService', () => {
  let tempDir: string;
  let service: ZavorthTransactionZavorthControlProjectionService;
  let credentialRefs: ZavorthTransactionCredentialRefService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-transaction-zavorthControl-test-'));
    const previewService = new ZavorthTransactionPreviewService();
    credentialRefs = new ZavorthTransactionCredentialRefService({
      storeFile: path.join(tempDir, 'credential-refs.jsonl'),
      now: () => now,
    });
    service = new ZavorthTransactionZavorthControlProjectionService({
      now: () => now,
      surfaceGateway: new ZavorthTransactionSurfaceGatewayService({
        now: () => now,
        runtime: new ZavorthTransactionRuntimeOrchestratorService({
          now: () => now,
          previewService,
          approvalLedger: new ZavorthTransactionApprovalLedgerService({
            ledgerFile: path.join(tempDir, 'approval-ledger.jsonl'),
            signingKey,
            now: () => now,
            previewService,
          }),
          credentialRefs,
          connectorRegistry: new ZavorthTransactionConnectorRegistryService({
            now: () => now,
          }),
        }),
      }),
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('projects a web trade into cockpit lanes, tiles and approval actions', () => {
    const projection = service.project({
      text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
      surface: 'web',
      mode: 'paper',
    });

    expect(projection.version).toBe('zavorth-transaction-zavorthControl/checkpoint-8');
    expect(projection.status).toBe('approval-required');
    expect(projection.tone).toBe('attention');
    expect(projection.lanes.map((lane) => lane.kind)).toEqual([
      'intake',
      'natural-first',
      'preview',
      'approval',
      'credential',
      'connector',
      'ledger',
      'safety',
    ]);
    expect(projection.tiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'status', value: 'approval-required' }),
        expect.objectContaining({ kind: 'approval', value: 'pending' }),
        expect.objectContaining({ kind: 'safety', value: 'disabled' }),
      ]),
    );
    expect(projection.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'approval', status: 'pending' }),
        expect.objectContaining({ id: 'connector', status: 'pending' }),
        expect.objectContaining({ id: 'safety', status: 'done' }),
      ]),
    );
    expect(projection.operatorActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceActionId: 'request-approval',
          enabled: true,
          placement: 'primary',
        }),
        expect.objectContaining({
          sourceActionId: 'reject-preview',
          enabled: true,
          placement: 'danger',
        }),
        expect.objectContaining({
          sourceActionId: 'no-live-action',
          enabled: false,
          placement: 'disabled',
        }),
      ]),
    );
    expect(projection.safety).toEqual(expect.objectContaining({
      noLiveExecution: true,
      noHiddenLiveAction: true,
      liveActionApplied: false,
    }));
  });

  it('projects an approved credential-backed API run as a successful paper simulation', () => {
    const credential = credentialRefs.register({
      label: 'Demo exchange paper ref',
      connectorKind: 'exchange',
      environment: 'paper',
      allowedActions: ['trade-order'],
      ownerApproved: true,
      now,
    });

    const projection = service.project({
      text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
      surface: 'api',
      approve: true,
      mode: 'paper',
      credentialRef: credential.record?.ref,
    });

    expect(projection.status).toBe('simulated');
    expect(projection.tone).toBe('success');
    expect(projection.lanes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'connector',
          status: 'simulated',
          severity: 'success',
        }),
        expect.objectContaining({
          kind: 'credential',
          status: 'ready',
        }),
      ]),
    );
    expect(projection.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'approval', status: 'done' }),
        expect.objectContaining({ id: 'credential', status: 'done' }),
        expect.objectContaining({ id: 'connector', status: 'done' }),
      ]),
    );
    expect(projection.apiPayload.safety).toEqual(projection.safety);
    expect(projection.apiPayload.safety.externalSideEffects).toBe(false);
  });

  it('projects Telegram monitoring with concise notification and skipped approval', () => {
    const projection = service.project({
      text: 'Monitore notebook abaixo de R$3500 e me avise.',
      surface: 'telegram',
      mode: 'sandbox',
    });

    expect(projection.status).toBe('simulated');
    expect(projection.sourceProjectionId).toBe(projection.surfaceProjection.id);
    expect(projection.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'approval', status: 'skipped' }),
        expect.objectContaining({ id: 'connector', status: 'done' }),
      ]),
    );
    expect(projection.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: 'telegram',
          body: expect.stringContaining('Simulado'),
        }),
      ]),
    );
  });

  it('keeps raw secrets out of cockpit projections when the runtime blocks the request', () => {
    const projection = service.project({
      text: 'Compre ETH ate R$100 usando api_key=sk-super-secret-value-123456.',
      surface: 'web',
      approve: true,
      mode: 'paper',
    });

    expect(projection.status).toBe('blocked');
    expect(projection.tone).toBe('blocked');
    expect(JSON.stringify(projection)).not.toContain('sk-super-secret-value-123456');
    expect(projection.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'preview', status: 'blocked' }),
        expect.objectContaining({ id: 'connector', status: 'blocked' }),
      ]),
    );
    expect(projection.safety.noRawSecretSerialized).toBe(true);
  });
});
