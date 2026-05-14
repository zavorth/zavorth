import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AI_FIRST_FINAL_ACTIVATION_GATE_CONTRACT_VERSION,
  type AiFirstFinalActivationGateSnapshot,
} from '../../src/contracts/AiFirstFinalActivationGateContract.js';
import { AiFirstOwnerControlledDefaultActivationService } from '../../src/services/AiFirstOwnerControlledDefaultActivationService.js';

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ai-first-default-'));
}

function createService(dataDir: string): AiFirstOwnerControlledDefaultActivationService {
  let counter = 0;
  return new AiFirstOwnerControlledDefaultActivationService({
    dataDir,
    runtime: {
      now: () => new Date('2026-05-06T23:45:00.000Z'),
      idFactory: (prefix) => `${prefix}-${++counter}`,
    },
  });
}

function cleanSnapshot(input: Partial<AiFirstFinalActivationGateSnapshot> = {}): AiFirstFinalActivationGateSnapshot {
  return {
    contractVersion: AI_FIRST_FINAL_ACTIVATION_GATE_CONTRACT_VERSION,
    source: 'ai-first-final-activation-gate',
    generatedAt: '2026-05-06T23:45:00.000Z',
    activationGateId: 'activation-gate-clean',
    input: {
      activationName: 'clean-final-gate',
      batchId: 'batch-clean',
      registryId: 'registry-clean',
      switchboardId: 'switchboard-clean',
      ledgerId: 'ledger-clean',
      historicalGateId: 'historical-gate-clean',
    },
    phaseSummaries: [],
    aggregate: {
      sampleCount: 3,
      batchPassRate: 1,
      batchBlockRate: 0,
      eligibleFamilies: 1,
      proposedAllowlistEntries: 1,
      canaryEnabledRoutes: 1,
      canarySelections: 1,
      fallbackSelections: 1,
      ledgerEntries: 2,
      latestCanaryRate: 0.5,
      latestFallbackRate: 0.5,
      historicalFindingCount: 0,
      finalFindingCount: 0,
      allReceiptsPresent: true,
      allRuntimeInvariantsPreserved: true,
      ownerApprovalRequired: true,
      automaticActivationAllowed: false,
    },
    findings: [],
    recommendation: {
      readiness: 'ready-for-owner-controlled-default',
      action: 'prepare-owner-controlled-default',
      reason: 'fixture',
      defaultRuntimeChanged: false,
      keepCurrentRuntimeDecision: true,
      canExecuteNow: false,
      activateAutomatically: false,
      ownerApprovalRequired: true,
      promoteDefaultRuntime: false,
    },
    receipts: [],
    gates: [],
    ...input,
  };
}

describe('AiFirstOwnerControlledDefaultActivationService', () => {
  it('plans activation from a clean Phase 10 snapshot without writing state', () => {
    const dir = tempDir();
    try {
      const service = createService(dir);
      const result = service.plan({
        snapshot: cleanSnapshot(),
        ownerApprovalId: 'owner-approved-ai-first-default',
      });

      expect(result.status).toBe('ready');
      expect(result.applied).toBe(false);
      expect(result.dryRun).toBe(true);
      expect(result.findings).toEqual([]);
      expect(result.state?.defaultRouter).toBe('ai-first');
      expect(fs.existsSync(result.paths.statePath)).toBe(false);
      expect(fs.existsSync(result.paths.ledgerPath)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('blocks applied activation unless approval and confirmation are explicit', () => {
    const dir = tempDir();
    try {
      const service = createService(dir);
      const result = service.activate({
        snapshot: cleanSnapshot(),
        apply: true,
      });

      expect(result.status).toBe('blocked');
      expect(result.applied).toBe(false);
      expect(result.findings.map((finding) => finding.kind)).toEqual(expect.arrayContaining([
        'owner-approval-missing',
        'activation-confirmation-missing',
      ]));
      expect(fs.existsSync(result.paths.statePath)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('applies owner-controlled default activation and records a receipt', () => {
    const dir = tempDir();
    try {
      const service = createService(dir);
      const result = service.activate({
        snapshot: cleanSnapshot(),
        ownerApprovalId: 'owner-approved-ai-first-default',
        apply: true,
        confirmOwnerControlledDefault: true,
      });

      expect(result.status).toBe('active');
      expect(result.applied).toBe(true);
      expect(result.state).toEqual(expect.objectContaining({
        status: 'active',
        defaultRouter: 'ai-first',
        fallbackRouter: 'current-runtime',
        ownerApprovalId: 'owner-approved-ai-first-default',
      }));
      const state = JSON.parse(fs.readFileSync(result.paths.statePath, 'utf8'));
      expect(state.defaultRouter).toBe('ai-first');
      expect(fs.readFileSync(result.paths.ledgerPath, 'utf8').trim().split('\n')).toHaveLength(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports active status from the persisted state', () => {
    const dir = tempDir();
    try {
      const service = createService(dir);
      service.activate({
        snapshot: cleanSnapshot(),
        ownerApprovalId: 'owner-approved-ai-first-default',
        apply: true,
        confirmOwnerControlledDefault: true,
      });
      const status = service.status();

      expect(status.status).toBe('active');
      expect(status.state?.defaultRouter).toBe('ai-first');
      expect(status.ledger?.total).toBe(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rolls back active AI-first default to the current runtime', () => {
    const dir = tempDir();
    try {
      const service = createService(dir);
      service.activate({
        snapshot: cleanSnapshot(),
        ownerApprovalId: 'owner-approved-ai-first-default',
        apply: true,
        confirmOwnerControlledDefault: true,
      });
      const result = service.rollback({
        ownerApprovalId: 'owner-approved-rollback',
        apply: true,
        confirmRollback: true,
      });

      expect(result.status).toBe('rolled-back');
      expect(result.applied).toBe(true);
      expect(result.state).toEqual(expect.objectContaining({
        status: 'rolled-back',
        defaultRouter: 'current-runtime',
        ownerApprovalId: 'owner-approved-rollback',
      }));
      expect(fs.readFileSync(result.paths.ledgerPath, 'utf8').trim().split('\n')).toHaveLength(2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects snapshots that are not ready or that contain secret-like material', () => {
    const dir = tempDir();
    try {
      const service = createService(dir);
      const result = service.plan({
        snapshot: cleanSnapshot({
          input: {
            activationName: 'bad sk-ownerdefaultsecret123',
            batchId: 'batch-clean',
            registryId: 'registry-clean',
            switchboardId: 'switchboard-clean',
            ledgerId: 'ledger-clean',
            historicalGateId: 'historical-gate-clean',
          },
          recommendation: {
            ...cleanSnapshot().recommendation,
            readiness: 'hold',
            action: 'continue-canary',
          },
        }),
        ownerApprovalId: 'owner-approved-ai-first-default',
      });

      expect(result.status).toBe('blocked');
      expect(result.findings.map((finding) => finding.kind)).toEqual(expect.arrayContaining([
        'snapshot-not-ready',
        'secret-like-input',
      ]));
      expect(JSON.stringify(result)).not.toContain('sk-ownerdefaultsecret123');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
