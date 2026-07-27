import type {
  ConversationalPermissionRequest,
  TrustSliderPolicyDecision,
  TrustPostureSnapshot,
  UniversalIntentTrustMode,
  UniversalIntentUserRole,
  UniversalIntentSafetyClassification,
} from './UniversalIntentContracts.js';

export class TrustPostureService {
  public decide(input: {
    userRole: UniversalIntentUserRole;
    trustMode?: UniversalIntentTrustMode | null;
    classification: UniversalIntentSafetyClassification;
    requiresClarification: boolean;
    permissionRequest: ConversationalPermissionRequest | null;
    trustSlider?: TrustSliderPolicyDecision | null;
  }): TrustPostureSnapshot {
    const trustMode = input.trustMode || 'collaborator';
    if (input.requiresClarification) {
      return {
        posture: 'clarify-first',
        reason: 'Pergunta de esclarecimento obrigatoria before assumir alvo ou action.',
        userRole: input.userRole,
        trustMode,
        approvalRequired: false,
        previewRequired: false,
        rollbackExpected: false,
        blocked: false,
        blockReason: null,
      };
    }

    if (input.trustSlider?.blocked) {
      const blockReason = input.trustSlider.blockReason || input.trustSlider.reason;
      return {
        posture: 'blocked',
        reason: blockReason,
        userRole: input.userRole,
        trustMode,
        approvalRequired: false,
        previewRequired: input.trustSlider.previewRequired,
        rollbackExpected: false,
        blocked: true,
        blockReason,
      };
    }

    const blockReason = this.resolveBlockReason(trustMode, input.classification);
    if (blockReason) {
      return {
        posture: 'blocked',
        reason: blockReason,
        userRole: input.userRole,
        trustMode,
        approvalRequired: false,
        previewRequired: false,
        rollbackExpected: false,
        blocked: true,
        blockReason,
      };
    }

    if (input.trustSlider?.decision === 'requires_permission' && !input.permissionRequest) {
      return {
        posture: input.trustSlider.previewRequired ? 'preview-first' : 'approval-required',
        reason: input.trustSlider.reason,
        userRole: input.userRole,
        trustMode,
        approvalRequired: input.trustSlider.approvalRequired,
        previewRequired: input.trustSlider.previewRequired,
        rollbackExpected: input.trustSlider.permissionScope !== 'none',
        blocked: false,
        blockReason: null,
      };
    }

    if (input.permissionRequest && input.classification.risk === 'danger') {
      return {
        posture: 'approval-required',
        reason: 'Dangerous action requires preview and approval before execution.',
        userRole: input.userRole,
        trustMode,
        approvalRequired: true,
        previewRequired: input.permissionRequest.previewRequired,
        rollbackExpected: input.permissionRequest.sideEffect !== 'external',
        blocked: false,
        blockReason: null,
      };
    }

    if (input.permissionRequest) {
      return {
        posture: 'preview-first',
        reason: 'Mutable action requires preview and conversational permission.',
        userRole: input.userRole,
        trustMode,
        approvalRequired: input.permissionRequest.approvalRequired,
        previewRequired: input.permissionRequest.previewRequired,
        rollbackExpected: input.permissionRequest.sideEffect !== 'external',
        blocked: false,
        blockReason: null,
      };
    }

    if (input.classification.signals.inspection || input.classification.signals.network) {
      return {
        posture: 'governed-execution',
        reason: 'Reading or lookup can continue through the governed runtime.',
        userRole: input.userRole,
        trustMode,
        approvalRequired: false,
        previewRequired: false,
        rollbackExpected: false,
        blocked: false,
        blockReason: null,
      };
    }

    return {
      posture: 'direct-answer',
      reason: 'Common conversation requires no tool or permission.',
      userRole: input.userRole,
      trustMode,
      approvalRequired: false,
      previewRequired: false,
      rollbackExpected: false,
      blocked: false,
      blockReason: null,
    };
  }

  private resolveBlockReason(
    trustMode: UniversalIntentTrustMode,
    classification: UniversalIntentSafetyClassification,
  ): string | null {
    const governedOperatorTool = classification.capabilityRequired.some((tool) => [
      'selfmod.preview',
      'selfmod.apply',
      'selfmod.rollback',
      'watchmode.control',
    ].includes(tool));
    if (classification.signals.hostScopeRequested) {
      return 'Conversational permission does not cover the whole host.';
    }
    if (classification.signals.operatorRequired && trustMode !== 'overlord' && !governedOperatorTool) {
      return 'Request requires Overlord; current mode does not allow operator control.';
    }
    if (trustMode === 'protected' && classification.risk === 'danger' && !governedOperatorTool) {
      return 'Modo protected blocks operactions perigosas.';
    }
    return null;
  }
}
