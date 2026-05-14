import type {
  ConversationalPermissionRequest,
  NaturalClarificationPolicy,
  PermissionNarrative,
  TrustSliderPolicyDecision,
  TrustPostureSnapshot,
  UniversalIntentDecision,
  UniversalIntentInput,
  UniversalIntentNextSafeAction,
  UniversalIntentSafetyClassification,
  UserAbstractionProfile,
} from './UniversalIntentContracts.js';
import { ConversationalPermissionService } from './ConversationalPermissionService.js';
import { IntentSafetyClassifier } from './IntentSafetyClassifier.js';
import { NaturalClarificationPolicyService } from './NaturalClarificationPolicyService.js';
import { PermissionNarrativeService } from './PermissionNarrativeService.js';
import { TrustSliderPolicyService } from './TrustSliderPolicyService.js';
import { TrustPostureService } from './TrustPostureService.js';
import { UserAbstractionProfileService } from './UserAbstractionProfileService.js';

type UniversalIntentServiceRuntime = {
  now?: () => Date;
  safetyClassifier?: IntentSafetyClassifier;
  clarificationPolicy?: NaturalClarificationPolicyService;
  permissionService?: ConversationalPermissionService;
  trustSliderPolicy?: TrustSliderPolicyService;
  trustPostureService?: TrustPostureService;
  narrativeService?: PermissionNarrativeService;
  userProfileService?: UserAbstractionProfileService;
};

export class UniversalIntentService {
  private readonly now: () => Date;
  private readonly safetyClassifier: IntentSafetyClassifier;
  private readonly clarificationPolicy: NaturalClarificationPolicyService;
  private readonly permissionService: ConversationalPermissionService;
  private readonly trustSliderPolicy: TrustSliderPolicyService;
  private readonly trustPostureService: TrustPostureService;
  private readonly narrativeService: PermissionNarrativeService;
  private readonly userProfileService: UserAbstractionProfileService;

  constructor(runtime: UniversalIntentServiceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.safetyClassifier = runtime.safetyClassifier || new IntentSafetyClassifier();
    this.clarificationPolicy = runtime.clarificationPolicy || new NaturalClarificationPolicyService();
    this.permissionService = runtime.permissionService || new ConversationalPermissionService({
      now: this.now,
    });
    this.trustSliderPolicy = runtime.trustSliderPolicy || new TrustSliderPolicyService({
      now: this.now,
    });
    this.trustPostureService = runtime.trustPostureService || new TrustPostureService();
    this.narrativeService = runtime.narrativeService || new PermissionNarrativeService();
    this.userProfileService = runtime.userProfileService || new UserAbstractionProfileService();
  }

  public decide(input: UniversalIntentInput): UniversalIntentDecision {
    const safety = this.safetyClassifier.classify(input);
    const userAbstraction = this.userProfileService.resolve(input);
    const clarification = this.clarificationPolicy.build(safety);
    const requiresClarification = clarification.askBeforeAssumption;
    const preliminaryPermissionRequest = !requiresClarification && this.permissionService.requiresPermission(input, safety)
      ? this.permissionService.buildRequest(input, safety)
      : null;
    const trustSlider = this.trustSliderPolicy.evaluate({
      level: input.trustMode || null,
      previousLevel: input.previousTrustMode || null,
      userRole: userAbstraction.role,
      ownerConfirmed: input.ownerConfirmed || false,
      killSwitchActive: input.killSwitchActive || false,
      classification: safety,
      permissionRequest: preliminaryPermissionRequest,
      contextHints: input.contextHints || null,
    });
    const trustPosture = this.trustPostureService.decide({
      userRole: userAbstraction.role,
      trustMode: input.trustMode || null,
      classification: safety,
      requiresClarification,
      permissionRequest: preliminaryPermissionRequest,
      trustSlider,
    });
    const permissionRequest = trustPosture.blocked ? null : preliminaryPermissionRequest;
    const requiresPermission = Boolean(permissionRequest);
    const permissionNarrative = this.narrativeService.build({
      classification: safety,
      clarification,
      permissionRequest,
      trustPosture,
      userProfile: userAbstraction,
    });

    return this.buildDecision({
      input,
      safety,
      userAbstraction,
      clarification,
      requiresClarification,
      permissionRequest,
      requiresPermission,
      trustPosture,
      trustSlider,
      permissionNarrative,
    });
  }

  private buildDecision(input: {
    input: UniversalIntentInput;
    safety: UniversalIntentSafetyClassification;
    userAbstraction: UserAbstractionProfile;
    clarification: NaturalClarificationPolicy;
    requiresClarification: boolean;
    permissionRequest: ConversationalPermissionRequest | null;
    requiresPermission: boolean;
    trustPosture: TrustPostureSnapshot;
    trustSlider: TrustSliderPolicyDecision;
    permissionNarrative: PermissionNarrative;
  }): UniversalIntentDecision {
    const intent = input.requiresClarification ? 'clarification' : input.safety.intent;
    return {
      schemaVersion: 1,
      generatedAt: this.now().toISOString(),
      intent,
      capabilityRequired: input.safety.capabilityRequired,
      risk: input.safety.risk,
      confidence: input.requiresClarification ? Math.min(input.safety.confidence, 0.55) : input.safety.confidence,
      requiresClarification: input.requiresClarification,
      clarification: input.clarification,
      requiresPermission: input.requiresPermission,
      permissionRequest: input.permissionRequest,
      permissionNarrative: input.permissionNarrative,
      nextSafeAction: this.inferNextSafeAction(
        input.safety,
        input.requiresClarification,
        input.permissionRequest,
        input.trustPosture,
      ),
      trustSlider: input.trustSlider,
      trustPosture: input.trustPosture,
      userAbstraction: input.userAbstraction,
      safety: input.safety,
      diagnostics: {
        source: 'UniversalIntentService',
        surface: String(input.input.surface || 'unknown'),
        matchedSignals: input.safety.signals.matchedSignals,
        textEmpty: input.safety.signals.textEmpty,
        toolsFromRequest: input.safety.signals.toolsFromRequest,
        toolsFromCapabilities: input.safety.signals.toolsFromCapabilities,
      },
    };
  }

  private inferNextSafeAction(
    safety: UniversalIntentSafetyClassification,
    requiresClarification: boolean,
    permissionRequest: ConversationalPermissionRequest | null,
    trustPosture: TrustPostureSnapshot,
  ): UniversalIntentNextSafeAction {
    if (trustPosture.blocked) {
      return 'block';
    }
    if (requiresClarification) {
      return 'ask_clarification';
    }
    if (permissionRequest?.previewRequired) {
      return 'preview_then_request_permission';
    }
    if (permissionRequest) {
      return 'request_permission';
    }
    if (safety.signals.inspection || safety.signals.network || safety.capabilityRequired.length > 0) {
      return 'execute_governed';
    }
    return 'answer';
  }
}
