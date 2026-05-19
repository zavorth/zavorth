import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthTransactionApprovalLedgerService } from '../../src/services/ZavorthTransactionApprovalLedgerService.js';
import { ZavorthTransactionConnectorRegistryService } from '../../src/services/ZavorthTransactionConnectorRegistryService.js';
import { ZavorthTransactionCredentialRefService } from '../../src/services/ZavorthTransactionCredentialRefService.js';
import { ZavorthTransactionPreviewService } from '../../src/services/ZavorthTransactionPreviewService.js';
import { ZavorthTransactionRuntimeOrchestratorService } from '../../src/services/ZavorthTransactionRuntimeOrchestratorService.js';
import { ZavorthTransactionSurfaceGatewayService } from '../../src/services/ZavorthTransactionSurfaceGatewayService.js';

const now = new Date('2026-05-11T12:00:00.000Z');
const signingKey = 'surface-controls-test-signing-key-000000000000000000000000000000';

describe('ZavorthTransactionSurfaceGatewayService', () => {
  let tempDir: string;
  let service: ZavorthTransactionSurfaceGatewayService;
  let credentialRefs: ZavorthTransactionCredentialRefService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-surface-test-'));
    const previewService = new ZavorthTransactionPreviewService();
    credentialRefs = new ZavorthTransactionCredentialRefService({
      storeFile: path.join(tempDir, 'credential-refs.jsonl'),
      now: () => now,
    });
    service = new ZavorthTransactionSurfaceGatewayService({
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
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('projects a web trade into approval cards and actions', () => {
    const projection = service.project({
      text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
      surface: 'web',
      mode: 'paper',
    });

    expect(projection.status).toBe('approval-required');
    expect(projection.surface).toBe('web');
    expect(projection.naturalFirst).toEqual(expect.objectContaining({
      route: 'approval-proposal',
      intent: 'sensitive-action',
      shouldEnterGateway: true,
      requiresApproval: true,
    }));
    expect(projection.cards.map((card) => card.kind)).toEqual([
      'runtime-summary',
      'preview',
      'approval',
      'credential',
      'connector',
      'safety',
    ]);
    expect(projection.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'request-approval',
          enabled: true,
          requiresConfirmation: true,
        }),
        expect.objectContaining({
          kind: 'reject-preview',
          enabled: true,
          requiresConfirmation: true,
        }),
        expect.objectContaining({
          kind: 'no-live-action',
          enabled: false,
        }),
      ]),
    );
    expect(projection.externalSideEffects).toBe(false);
    expect(projection.liveActionApplied).toBe(false);
    expect(projection.executableNow).toBe(false);
  });

  it('projects an approved API trade as a paper simulation with credential ref', () => {
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
    expect(projection.runtime.connectorRun?.status).toBe('simulated');
    expect(projection.runtime.credentialValidation?.status).toBe('ready');
    expect(projection.apiPayload).toEqual(expect.objectContaining({
      status: 'simulated',
      runId: projection.runtime.id,
      previewId: projection.runtime.preview.id,
    }));
    expect(projection.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'safety',
          lines: expect.arrayContaining([
            'externalSideEffects=false',
            'liveExecutionAuthorized=false',
            'executableNow=false',
            'liveActionApplied=false',
          ]),
        }),
      ]),
    );
    expect(projection.liveExecutionAuthorized).toBe(false);
  });

  it('projects a Telegram monitor as concise localized simulation text', () => {
    const projection = service.project({
      text: 'Monitore notebook abaixo de R$3500 e me avise.',
      surface: 'telegram',
      mode: 'sandbox',
    });

    expect(projection.status).toBe('simulated');
    expect(projection.naturalFirst.route).toBe('tool-preview');
    expect(projection.runtime.connectorRun?.connector?.kind).toBe('market-data');
    expect(projection.replyText).toContain('Simulado');
    expect(projection.replyText).toContain('Nada live foi executado');
  });

  it('redacts raw secrets before projecting surface payloads', () => {
    const projection = service.project({
      text: 'Compre ETH ate R$100 usando api_key=sk-super-secret-value-123456.',
      surface: 'web',
      approve: true,
      mode: 'paper',
    });

    expect(projection.status).toBe('blocked');
    expect(JSON.stringify(projection)).not.toContain('sk-super-secret-value-123456');
    expect(projection.runtime.blockers).toContain('preview_blocked');
    expect(projection.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'safety',
          status: 'live-disabled',
        }),
      ]),
    );
  });
});
