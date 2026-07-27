import type {
  ConversationalPermissionRequest,
  NaturalClarificationPolicy,
  PermissionNarrative,
  TrustPostureSnapshot,
  UniversalIntentSafetyClassification,
  UserAbstractionProfile,
} from './UniversalIntentContracts.js';

export class PermissionNarrativeService {
  public build(input: {
    classification: UniversalIntentSafetyClassification;
    clarification: NaturalClarificationPolicy;
    permissionRequest: ConversationalPermissionRequest | null;
    trustPosture: TrustPostureSnapshot;
    userProfile: UserAbstractionProfile;
  }): PermissionNarrative {
    if (input.trustPosture.blocked) {
      return this.blocked(input.trustPosture);
    }
    if (input.clarification.askBeforeAssumption) {
      return this.clarification(input.clarification);
    }
    if (input.permissionRequest) {
      return input.permissionRequest.narrative;
    }
    return this.direct(input.classification, input.userProfile);
  }

  public forRequest(input: {
    classification: UniversalIntentSafetyClassification;
    where: string;
    permission: string;
    validity: string;
    technicalDetails: string[];
  }): PermissionNarrative {
    return {
      summary: this.summaryFor(input.classification),
      whatWillHappen: this.whatWillHappen(input.classification),
      where: input.where,
      permission: input.permission,
      risk: this.riskText(input.classification),
      review: this.reviewText(input.classification),
      validity: input.validity,
      technicalDetails: input.technicalDetails,
    };
  }

  private blocked(trustPosture: TrustPostureSnapshot): PermissionNarrative {
    return {
      summary: 'I will not execute this in this mode.',
      whatWillHappen: 'Execution stays paused until mode or scope is adjusted.',
      where: 'No resource will be changed.',
      permission: 'Permission was not requested because the current posture blocks the action.',
      risk: trustPosture.blockReason || trustPosture.reason,
      review: 'Review the request, reduce scope, or use a higher-trust mode when appropriate.',
      validity: 'No active authorization.',
      technicalDetails: [trustPosture.reason],
    };
  }

  private clarification(clarification: NaturalClarificationPolicy): PermissionNarrative {
    return {
      summary: 'I need to confirm the target before acting.',
      whatWillHappen: clarification.question || 'I will ask a clarification question.',
      where: 'There is no confirmed target yet.',
      permission: 'No permission will be consumed before the response.',
      risk: clarification.reason || 'Avoids assuming the wrong target.',
      review: 'Reply with the exact file, folder, resource, or command.',
      validity: 'There is no active authorization.',
      technicalDetails: clarification.missing.map((item) => `missing:${item}`),
    };
  }

  private direct(
    classification: UniversalIntentSafetyClassification,
    userProfile: UserAbstractionProfile,
  ): PermissionNarrative {
    return {
      summary: classification.intent === 'conversation'
        ? 'I can answer directly.'
        : 'I can proceed through the governed runtime without extra permission.',
      whatWillHappen: classification.intent === 'conversation'
        ? 'I will answer in text.'
        : 'I will execute only read-only or governed lookup work.',
      where: 'No persistent workspace change.',
      permission: 'No additional permission is required.',
      risk: 'Low risk.',
      review: 'You can ask for details or stop before any mutation.',
      validity: 'Only valid for this response.',
      technicalDetails: userProfile.shouldExposeTechnicalDetails
        ? [`intent:${classification.intent}`, `risk:${classification.risk}`]
        : [],
    };
  }

  private summaryFor(classification: UniversalIntentSafetyClassification): string {
    if (classification.intent === 'command_execution') {
      return 'This needs permission to run a command.';
    }
    if (classification.intent === 'external_side_effect') {
      return 'This needs permission before sending or publishing.';
    }
    if (classification.intent === 'automation') {
      return 'This needs permission before activating automation.';
    }
    if (classification.intent === 'operator_control') {
      return 'This needs operator permission.';
    }
    return 'This needs permission before changing the workspace.';
  }

  private whatWillHappen(classification: UniversalIntentSafetyClassification): string {
    if (classification.intent === 'command_execution') {
      return 'I will prepare the command and show the preview before execution.';
    }
    if (classification.intent === 'external_side_effect') {
      return 'I will prepare the content and ask for confirmation before it leaves the workspace.';
    }
    if (classification.intent === 'automation') {
      return 'I will prepare the plan and ask for confirmation before activation.';
    }
    if (classification.intent === 'operator_control') {
      return 'I will pause for operator authorization before any broad action.';
    }
    return 'I will prepare a preview of changes before applying.';
  }

  private riskText(classification: UniversalIntentSafetyClassification): string {
    if (classification.sideEffect === 'destructive') {
      return 'High: may delete, replace, or make rollback difficult.';
    }
    if (classification.sideEffect === 'external') {
      return 'High: may expose information outside the workspace.';
    }
    if (classification.sideEffect === 'system') {
      return 'High: may run a command or system action.';
    }
    if (classification.sideEffect === 'local_workspace') {
      return 'Medium: may change files or local state.';
    }
    return 'Low.';
  }

  private reviewText(classification: UniversalIntentSafetyClassification): string {
    if (classification.sideEffect === 'external') {
      return 'Review destination, content, and attachments before approving.';
    }
    if (classification.sideEffect === 'destructive') {
      return 'Review backup, diff, and rollback plan before approving.';
    }
    return 'Review the preview/diff before approving.';
  }
}
