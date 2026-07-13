import {
  CAPABILITY_ACTIVATION_FLOW_CONTRACT_VERSION,
  type CapabilityActivationFlowInput,
  type CapabilityActivationFlowReceipt,
  type CapabilityActivationFlowSnapshot,
  type CapabilityActivationFlowStatus,
  type CapabilityActivationFlowStep,
} from '../contracts/CapabilityActivationFlowContract.js';
import type { CapabilityHubItem } from '../contracts/CapabilityHubContract.js';
import type { CapabilityPackReadinessSnapshot } from '../contracts/CapabilityPackReadinessContract.js';
import type { NaturalSetupAssistantSnapshot } from '../contracts/NaturalSetupAssistantContract.js';
import { ZavorthCapabilityHubApiService } from './ZavorthCapabilityHubApiService.js';
import { ZavorthCapabilityImportService } from './ZavorthCapabilityImportService.js';
import type { ZavorthCapabilityImportRuntime } from './ZavorthCapabilityImportService.js';
import type { ZavorthCapabilityHubRuntime } from './ZavorthCapabilityHubService.js';
import { ZavorthCapabilityPackCatalogService } from './ZavorthCapabilityPackCatalogService.js';
import type { CapabilityPackCatalogQuery } from '../contracts/CapabilityPackCatalogContract.js';
import { ZavorthCapabilityPackReadinessDoctorService } from './ZavorthCapabilityPackReadinessDoctorService.js';
import { ZavorthGovernanceRecipeApiService } from './ZavorthGovernanceRecipeApiService.js';
import { ZavorthNaturalSetupAssistantService } from './ZavorthNaturalSetupAssistantService.js';
import { tService } from '../i18n/services.js';

type CapabilityPackCatalogLike = Pick<ZavorthCapabilityPackCatalogService, 'listManifests'>;

export type ZavorthCapabilityActivationFlowRuntime =
  ZavorthCapabilityHubRuntime
  & ZavorthCapabilityImportRuntime
  & {
    now?: () => Date;
    capabilityPackCatalogService?: CapabilityPackCatalogLike;
  };

export class ZavorthCapabilityActivationFlowService {
  private readonly now: () => Date;
  private readonly runtime: ZavorthCapabilityActivationFlowRuntime;
  private readonly packCatalog: CapabilityPackCatalogLike;

  constructor(runtime: ZavorthCapabilityActivationFlowRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.runtime = runtime;
    this.packCatalog = runtime.capabilityPackCatalogService || new ZavorthCapabilityPackCatalogService({ now: this.now });
  }

  public buildSnapshot(input: CapabilityActivationFlowInput = {}): CapabilityActivationFlowSnapshot {
    const packManifests = input.packId
      ? this.packCatalog.listManifests({ packId: input.packId } satisfies CapabilityPackCatalogQuery)
      : [];
    const importer = new ZavorthCapabilityImportService({
      ...this.runtime,
      manifests: [
        ...(this.runtime.manifests || []),
        ...packManifests,
        ...(input.manifests || []),
        ...(input.manifest ? [input.manifest] : []),
      ],
    });
    const importSnapshot = importer.buildSnapshot({
      rawJson: input.rawJson || null,
      sourceLabel: input.sourceLabel || null,
      includeItems: true,
    });
    const targetId = input.targetItemId || importSnapshot.items[0]?.id || null;
    const packReadinessSnapshot = input.packId
      ? new ZavorthCapabilityPackReadinessDoctorService(this.runtime).buildSnapshot({
          packId: input.packId,
          targetItemId: targetId,
          availableSecretRefs: input.availableSecretRefs || [],
          availableEnvKeys: input.availableEnvKeys || [],
          availableBinaries: input.availableBinaries || [],
          completedManualSteps: input.completedManualSteps || [],
          completedReadinessChecks: input.completedReadinessChecks || [],
          localRoutes: input.localRoutes || {},
        })
      : null;
    const hubApi = new ZavorthCapabilityHubApiService({
      ...this.runtime,
      capabilityImportService: importer,
    });
    const governanceApi = new ZavorthGovernanceRecipeApiService({
      ...this.runtime,
      capabilityImportService: importer,
    });
    const setup = new ZavorthNaturalSetupAssistantService({
      ...this.runtime,
      capabilityHubApiService: hubApi,
      governanceRecipeApiService: governanceApi,
    });
    const setupSnapshot = targetId
      ? setup.buildSnapshot({
          text: input.text || `ativar ${targetId}`,
          actorLabel: input.actorLabel || null,
          preferredCapabilityId: targetId,
          approvalId: input.approvalId || null,
          providedSecrets: input.providedSecrets || {},
          persistSecrets: false,
        })
      : null;
    const target = setupSnapshot?.selectedCapability || null;
    const status = this.resolveStatus(importSnapshot.summary.blocked > 0, target, setupSnapshot, packReadinessSnapshot, input.approvalId || null);
    const steps = this.buildSteps(importSnapshot.summary.blocked > 0, target, setupSnapshot, packReadinessSnapshot, status, input.approvalId || null);
    const receipts = this.buildReceipts(importSnapshot.receipts, setupSnapshot);

    return {
      contractVersion: CAPABILITY_ACTIVATION_FLOW_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      status,
      target,
      importSnapshot,
      packReadinessSnapshot,
      setupSnapshot,
      steps,
      receipts,
      activation: {
        dryRunOnly: true,
        liveActivationApplied: false,
        approvalId: input.approvalId || null,
        nextCommand: target ? this.nextCommand(target.id, status, input.packId || null) : null,
      },
      policy: {
        canonicalRootOnly: true,
        importedCapabilitiesAllowed: true,
        externalRootsAllowed: false,
        secretsSerialized: false,
        ownerApprovalBeforeLive: true,
      },
      narrative: this.buildNarrative(status, target, setupSnapshot),
    };
  }

  public renderReport(input: CapabilityActivationFlowInput = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Zavorth Capability Activation Flow',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Status: ${snapshot.status}`,
      `Target: ${snapshot.target?.id || 'none'}`,
      `Policy: dryRun=${snapshot.activation.dryRunOnly}; liveApplied=${snapshot.activation.liveActivationApplied}; secrets=${snapshot.policy.secretsSerialized}.`,
      '',
      'Steps:',
    ];
    for (const step of snapshot.steps) {
      lines.push(`- ${step.status} ${step.label}: ${step.summary}`);
    }
    if (snapshot.receipts.length > 0) {
      lines.push('', 'Receipts:');
      for (const receipt of snapshot.receipts.slice(0, 12)) {
        lines.push(`- ${receipt.source}/${receipt.id}: ${receipt.summary}`);
      }
    }
    lines.push('', `Next: ${snapshot.narrative.nextAction}`);
    return lines.join('\n');
  }

  private resolveStatus(
    importBlocked: boolean,
    target: CapabilityHubItem | null,
    setup: NaturalSetupAssistantSnapshot | null,
    packReadiness: CapabilityPackReadinessSnapshot | null,
    approvalId: string | null,
  ): CapabilityActivationFlowStatus {
    if (importBlocked || setup?.readiness.status === 'blocked') {
      return 'blocked';
    }
    if (!target || !setup) {
      return 'waiting_target';
    }
    if (setup.secretPlan.missingRefs.length > 0) {
      return 'waiting_secret_input';
    }
    const targetReadiness = this.targetReadiness(packReadiness, target.id);
    if (targetReadiness === 'blocked') {
      return 'blocked';
    }
    if (targetReadiness && targetReadiness !== 'ready_for_activation_request') {
      return 'waiting_readiness';
    }
    if (setup.safety.approvalRequired && !approvalId) {
      return 'waiting_approval';
    }
    return 'ready_for_controlled_activation';
  }

  private buildSteps(
    importBlocked: boolean,
    target: CapabilityHubItem | null,
    setup: NaturalSetupAssistantSnapshot | null,
    packReadiness: CapabilityPackReadinessSnapshot | null,
    status: CapabilityActivationFlowStatus,
    approvalId: string | null,
  ): CapabilityActivationFlowStep[] {
    const readiness = this.targetReadiness(packReadiness, target?.id || null);
    return [
      {
        id: 'import',
        label: 'Normalize capability',
        status: importBlocked ? 'blocked' : 'done',
        summary: importBlocked
          ? 'Manifest import was blocked before Hub exposure.'
          : 'Manifest items were normalized into Capability Hub contract.',
      },
      {
        id: 'target',
        label: 'Resolve target',
        status: target ? 'done' : 'next',
        summary: target ? `${target.id} selected.` : 'Choose a Capability Hub item.',
      },
      {
        id: 'natural-setup',
        label: 'Build guided setup plan',
        status: setup ? 'done' : 'pending',
        summary: setup?.conversation.headline || 'Natural setup has not started.',
      },
      {
        id: 'secrets',
        label: 'Collect secret refs',
        status: setup?.secretPlan.missingRefs.length
          ? 'next'
          : setup ? 'done' : 'pending',
        summary: setup?.secretPlan.missingRefs.length
          ? `Missing ${setup.secretPlan.missingRefs.length} secret ref(s).`
          : 'No raw secret is serialized by the activation flow.',
      },
      {
        id: 'governance',
        label: 'Apply governance recipe',
        status: setup?.governancePlan ? 'done' : 'pending',
        summary: setup?.governancePlan
          ? `${setup.governancePlan.recipeId} planned with dry-run receipts.`
          : 'Governance recipe is required before activation.',
      },
      {
        id: 'pack-readiness',
        label: 'Run pack readiness doctor',
        status: readiness === 'ready_for_activation_request'
          ? 'done'
          : readiness ? 'next' : 'done',
        summary: readiness
          ? `Pack readiness status is ${readiness}.`
          : 'No official pack readiness doctor was required for this flow.',
      },
      {
        id: 'approval',
        label: 'Owner approval',
        status: setup?.safety.approvalRequired && !approvalId
          ? 'next'
          : setup ? 'done' : 'pending',
        summary: setup?.safety.approvalRequired && !approvalId
          ? 'Explicit owner approval is required before any live activation request.'
          : 'Approval state is compatible with the dry-run plan.',
      },
      {
        id: 'activation',
        label: 'Controlled activation request',
        status: status === 'ready_for_controlled_activation' ? 'next' : 'pending',
        summary: 'Live activation is not applied by this flow; it only prepares the governed request.',
      },
    ];
  }

  private buildReceipts(
    importReceipts: Array<{ id: string; summary: string; itemId: string | null }>,
    setup: NaturalSetupAssistantSnapshot | null,
  ): CapabilityActivationFlowReceipt[] {
    const receipts: CapabilityActivationFlowReceipt[] = importReceipts.map((receipt) => ({
      id: receipt.id,
      source: 'importer',
      summary: receipt.summary,
      targetItemId: receipt.itemId,
    }));
    if (setup?.dryRunReceipt) {
      receipts.push({
        id: setup.dryRunReceipt.executionId,
        source: 'governance',
        summary: setup.dryRunReceipt.summary,
        targetItemId: setup.dryRunReceipt.targetItemId,
      });
    }
    if (setup?.selectedCapability) {
      receipts.push({
        id: `activation-flow:${setup.selectedCapability.id}:${setup.generatedAt}`,
        source: 'activation-flow',
        summary: 'Activation flow prepared a dry-run-only request.',
        targetItemId: setup.selectedCapability.id,
      });
    }
    return receipts;
  }

  private buildNarrative(
    status: CapabilityActivationFlowStatus,
    target: CapabilityHubItem | null,
    setup: NaturalSetupAssistantSnapshot | null,
  ): CapabilityActivationFlowSnapshot['narrative'] {
    if (!target || !setup) {
      return {
        headline: 'Activation flow precisa de um alvo.',
        operatorSummary: 'Nenhuma capacidade foi escolhida para ativacao governada.',
        nextAction: 'Informe um target do Capability Hub ou um manifesto com ao menos uma capacidade valida.',
      };
    }
    if (status === 'blocked') {
      return {
        headline: `Ativacao de ${target.label} bloqueada.`,
        operatorSummary: 'O fluxo encontrou uma barreira de importacao, readiness ou policy.',
        nextAction: 'Corrigir os bloqueios antes de gerar novo plano.',
      };
    }
    if (status === 'waiting_secret_input') {
      return {
        headline: tService('activation.ready_for_secret_collection', { label: target.label }),
        operatorSummary: tService('activation.secret_refs_missing', { count: String(setup.secretPlan.missingRefs.length) }),
        nextAction: tService('activation.collect_secret', { ref: setup.secretPlan.missingRefs[0] }),
      };
    }
    if (status === 'waiting_approval') {
      return {
        headline: tService('activation.waiting_approval', { label: target.label }),
        operatorSummary: tService('activation.waiting_approval_summary'),
        nextAction: tService('activation.waiting_approval_next'),
      };
    }
    if (status === 'waiting_readiness') {
      return {
        headline: tService('activation.waiting_readiness', { label: target.label }),
        operatorSummary: tService('activation.secrets_governance_pending'),
        nextAction: tService('activation.run_readiness_doctor'),
      };
    }
    return {
      headline: tService('activation.ready_for_activation', { label: target.label }),
      operatorSummary: tService('activation.all_steps_ready'),
      nextAction: tService('activation.send_activation_request'),
    };
  }

  private targetReadiness(
    snapshot: CapabilityPackReadinessSnapshot | null,
    targetId: string | null,
  ): CapabilityPackReadinessSnapshot['items'][number]['status'] | null {
    if (!snapshot || !targetId) {
      return null;
    }
    return snapshot.items.find((item) => item.itemId === targetId)?.status || null;
  }

  private nextCommand(targetId: string, status: CapabilityActivationFlowStatus, packId: string | null): string | null {
    if (status === 'waiting_approval') {
      return `npm run capability-activation-flow -- --target ${targetId} --approval-id <approval-id> --json`;
    }
    if (status === 'waiting_readiness' && packId) {
      return `npm run capability-pack-readiness -- --pack ${packId} --target ${targetId}`;
    }
    if (status === 'waiting_secret_input') {
      return `npm run natural-setup -- --capability ${targetId} --inspect`;
    }
    if (status === 'ready_for_controlled_activation') {
      return `npm run capability-activation-flow -- --target ${targetId} --approval-id <approval-id> --json`;
    }
    return null;
  }
}
