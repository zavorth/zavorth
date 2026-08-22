import {  type CapabilityNegotiationSnapshot } from './CapabilityNegotiationService.js';
import {  type ToolRehearsalSnapshot } from './ToolRehearsalService.js';






import type { TrustSliderPolicyDecision } from '../uni/UniversalIntentContracts.js';


import {  type UniversalIntentTrustEnforcementSnapshot } from './UniversalIntentTrustEnforcementService.js';

import type {   UniversalAgentRequest, UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';
import { asErrorLike } from '../../utils/errorLike.js';
import type {    AgentRunService } from './AgentRunService.js';
import { normalizeText, recordOrNull } from './AgentRunValueHelpers.js';

export class AgentRunApprovalGovernanceSupport {
  public constructor(private readonly owner: AgentRunService) {}

  public applyUniversalIntentTrustEnforcement(run: UniversalAgentRun, request?: UniversalAgentRequest | null, generatedAt: string = run.updatedAt || this.owner.now().toISOString()): UniversalIntentTrustEnforcementSnapshot {
    const snapshot = this.owner.universalIntentTrustEnforcement.buildSnapshot({
      run,
      request,
      generatedAt,
    });
    run.metadata = {
      ...run.metadata,
      universalIntent: snapshot.universalIntent,
      universalIntentTrustEnforcement: snapshot,
    };
    return snapshot;
  }

  public applyCapabilityLoopGovernance(run: UniversalAgentRun, input: UniversalAgentRequest, trustSlider: TrustSliderPolicyDecision | null = null): void {
    const generatedAt = this.owner.now().toISOString();
    const snapshot = this.owner.capabilityLoopGovernance.buildSnapshot({
      run,
      request: input,
      trustSlider,
      generatedAt,
    });
    run.metadata = {
      ...run.metadata,
      capabilityLoopGovernance: snapshot,
      capabilityLoopStatus: {
        source: 'CapabilityLoopGovernanceService',
        requestedCapabilityIds: snapshot.requestedCapabilityIds,
        blockedCapabilityIds: snapshot.blockedCapabilityIds,
        degradedCapabilityIds: snapshot.degradedCapabilityIds,
        summary: snapshot.summary,
      },
    };
    run.events.push({
      id: this.owner.idFactory('agent-event'),
      runId: run.id,
      kind: 'status',
      title: 'Governed capability loop',
      detail: snapshot.summary,
      status: snapshot.blockedCapabilityIds.length > 0 ? 'pending' : 'done',
      createdAt: generatedAt,
      metadata: {
        source: 'CapabilityLoopGovernanceService',
        requestedCapabilityIds: snapshot.requestedCapabilityIds,
        blockedCapabilityIds: snapshot.blockedCapabilityIds,
        degradedCapabilityIds: snapshot.degradedCapabilityIds,
      },
    });
    run.updatedAt = generatedAt;
    this.owner.applyEvidenceSnapshotChainOnce(run, input, generatedAt);
  }

  public applySafetyNarrative(run: UniversalAgentRun, generatedAt: string = run.updatedAt || this.owner.now().toISOString()) {
    const narrative = this.owner.safetyNarrative.buildSnapshot({
      run,
      generatedAt,
    });
    run.metadata = {
      ...run.metadata,
      safetyNarrative: narrative,
    };
    this.owner.applyEvidenceSnapshotChainOnce(run, null, generatedAt);
    return narrative;
  }

  public applyEvidenceSnapshotChainOnce(run: UniversalAgentRun, input: UniversalAgentRequest | null, generatedAt: string): void {
    if (this.owner.appliedEvidenceSnapshotChains.has(run)) {
      return;
    }

    this.owner.appliedEvidenceSnapshotChains.add(run);
    this.owner.evidencePipeline.applySecondary({
      run,
      request: input,
      generatedAt,
    });
  }

  public applyMemoryWithReceipts(run: UniversalAgentRun, generatedAt: string = run.updatedAt || this.owner.now().toISOString()) {
    const snapshot = this.owner.memoryWithReceipts.buildSnapshot({
      run,
      generatedAt,
    });
    if (snapshot.receipts.length === 0 && !recordOrNull(run.metadata.memoryWithReceipts)) {
      return null;
    }
    run.metadata = {
      ...run.metadata,
      memoryWithReceipts: snapshot,
    };
    return snapshot;
  }

  public async applyAutomaticSkillInvocationIfNeeded(run: UniversalAgentRun, request: UniversalAgentRequest): Promise<void> {
    if (!this.owner.autoSkillInvocation) {
      return;
    }
    const existing = recordOrNull(run.metadata.autoSkillInvocation);
    if (existing && ['selected', 'blocked', 'failed'].includes(normalizeText(existing.status))) {
      return;
    }
    try {
      await this.owner.autoSkillInvocation.apply({ run, request });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const generatedAt = this.owner.now().toISOString();
      const reason = error instanceof Error ? err.message : String(error);
      run.metadata = {
        ...run.metadata,
        autoSkillInvocation: {
          contractVersion: 'agent-run-automatic-skill-invocation/1',
          source: 'AgentRunAutomaticSkillInvocationService',
          generatedAt,
          status: 'failed',
          selectedSkillName: null,
          supportSkillName: null,
          mode: 'dry-run',
          bridgeStatus: 'error',
          receiptIds: [],
          promptEnvelopeText: null,
          rawSecretsSerialized: false,
          reason,
          skillCount: 0,
        },
      };
      run.events.push({
        id: this.owner.idFactory('agent-event'),
        runId: run.id,
        kind: 'planning',
        title: 'Skill auto-selected',
        detail: reason,
        status: 'pending',
        createdAt: generatedAt,
        metadata: {
          source: 'AgentRunAutomaticSkillInvocationService',
          contractVersion: 'agent-run-automatic-skill-invocation/1',
          status: 'failed',
          reason,
          rawSecretsSerialized: false,
        },
      });
    }
  }

  public applySkillMcpQuarantine(run: UniversalAgentRun, generatedAt: string = run.updatedAt || this.owner.now().toISOString()) {
    const snapshot = this.owner.skillMcpQuarantine.buildSnapshot({
      run,
      generatedAt,
    });
    if (snapshot.summary.total === 0 && !recordOrNull(run.metadata.skillMcpQuarantine)) {
      return null;
    }
    run.metadata = {
      ...run.metadata,
      skillMcpQuarantine: snapshot,
    };
    return snapshot;
  }

  public applyCapabilityNegotiation(run: UniversalAgentRun, request?: UniversalAgentRequest, generatedAt: string = run.updatedAt || this.owner.now().toISOString()): CapabilityNegotiationSnapshot | null {
    const existing = recordOrNull(run.metadata.capabilityNegotiation);
    const existingStatus = normalizeText(existing?.status);
    if (existingStatus === 'waiting-approval' || existingStatus === 'approved') {
      return existing as CapabilityNegotiationSnapshot;
    }
    if (request && this.owner.shouldBypassCapabilityNegotiationForSpecializedFlow(run, request)) {
      return null;
    }

    const snapshot = this.owner.capabilityNegotiation.buildSnapshot({
      run,
      request,
      generatedAt,
    });
    if (snapshot.status === 'not-needed' && !existing) {
      return null;
    }
    run.metadata = {
      ...run.metadata,
      capabilityNegotiation: snapshot,
    };
    return snapshot;
  }

  public markCapabilityNegotiationApprovedIfNeeded(run: UniversalAgentRun, approvedAt: string = run.updatedAt || this.owner.now().toISOString()): void {
    const existing = recordOrNull(run.metadata.capabilityNegotiation);
    if (!existing || normalizeText(existing.status) !== 'waiting-approval') {
      return;
    }
    const approvalId = normalizeText(existing.approvalId) || normalizeText(recordOrNull(existing.proposal)?.approvalId);
    if (!approvalId || !run.approvals.some((approval) => approval.id === approvalId && approval.status === 'approved')) {
      return;
    }
    const scope = recordOrNull(existing.scope) || {};
    run.metadata = {
      ...run.metadata,
      capabilityNegotiation: {
        ...existing,
        status: 'approved',
        approved: true,
        approvedAt,
        scope: {
          ...scope,
          approved: true,
        },
        policy: {
          ...(recordOrNull(existing.policy) || {}),
          approvalsStillRequired: false,
        },
        nextSafeAction: 'Execute only inside the approved scope.',
      },
    };
  }

  public applyToolRehearsal(run: UniversalAgentRun, request?: UniversalAgentRequest, generatedAt: string = run.updatedAt || this.owner.now().toISOString()): ToolRehearsalSnapshot | null {
    const existing = recordOrNull(run.metadata.toolRehearsal);
    const existingStatus = normalizeText(existing?.status);
    if (existingStatus === 'waiting-approval' || existingStatus === 'approved') {
      return existing as ToolRehearsalSnapshot;
    }

    const snapshot = this.owner.toolRehearsal.buildSnapshot({
      run,
      request,
      generatedAt,
    });
    if (snapshot.status === 'not-needed' && !existing) {
      return null;
    }
    run.metadata = {
      ...run.metadata,
      toolRehearsal: snapshot,
    };
    return snapshot;
  }

  public markToolRehearsalApprovedIfNeeded(run: UniversalAgentRun, approvedAt: string = run.updatedAt || this.owner.now().toISOString()): void {
    const existing = recordOrNull(run.metadata.toolRehearsal);
    if (!existing || normalizeText(existing.status) !== 'waiting-approval') {
      return;
    }
    const approvalId = normalizeText(existing.approvalId) || normalizeText(recordOrNull(existing.approval)?.approvalId);
    if (!approvalId || !run.approvals.some((approval) => approval.id === approvalId && approval.status === 'approved')) {
      return;
    }
    run.metadata = {
      ...run.metadata,
      toolRehearsal: {
        ...existing,
        status: 'approved',
        approved: true,
        approvedAt,
        approval: {
          ...(recordOrNull(existing.approval) || {}),
          required: false,
          approvalId,
        },
        policy: {
          ...(recordOrNull(existing.policy) || {}),
          approvalsStillRequired: false,
        },
        nextSafeAction: 'Execute only rehearsed and approved calls.',
      },
    };
  }
}
