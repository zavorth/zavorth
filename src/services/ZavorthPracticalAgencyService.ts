import {
  PRACTICAL_AGENCY_CONTRACT_VERSION,
  type PracticalAgencyPhaseStatus,
  type PracticalAgencySnapshot,
} from '../contracts/PracticalAgencyContract.js';
import type { IntelligenceFabricInput, IntelligenceFabricSnapshot } from '../contracts/native/IntelligenceFabricContract.js';
import { CapabilityLabService } from './CapabilityLabService.js';
import { ConversationalAgencyPresenter } from './ConversationalAgencyPresenter.js';
import { FabricToolIntentService } from './FabricToolIntentService.js';
import { OperationalPreferenceLearner } from './OperationalPreferenceLearner.js';
import { ProjectConstitutionLoader } from './ProjectConstitutionLoader.js';
import { SkillMiningService } from './SkillMiningService.js';
import { ZavorthCapabilityBuilderService } from './ZavorthCapabilityBuilderService.js';
import { ZavorthIntelligenceFabricService } from './ZavorthIntelligenceFabricService.js';
import { ZavorthPolicyCompilerService } from './ZavorthPolicyCompilerService.js';
import { ZavorthSecurityRedTeamService } from './ZavorthSecurityRedTeamService.js';
import type { LearningCandidateSnapshot } from './ZavorthLearningPlaneService.js';

type PracticalAgencyRuntime = {
  now?: () => Date;
  fabric?: Pick<ZavorthIntelligenceFabricService, 'buildShadowSnapshot'> | null;
  presenter?: ConversationalAgencyPresenter | null;
  toolIntent?: FabricToolIntentService | null;
  capabilityBuilder?: ZavorthCapabilityBuilderService | null;
  capabilityLab?: CapabilityLabService | null;
  preferenceLearner?: OperationalPreferenceLearner | null;
  skillMining?: SkillMiningService | null;
  redTeam?: ZavorthSecurityRedTeamService | null;
  policyCompiler?: ZavorthPolicyCompilerService | null;
  constitutionLoader?: ProjectConstitutionLoader | null;
};

export class ZavorthPracticalAgencyService {
  private readonly now: () => Date;
  private readonly fabric: Pick<ZavorthIntelligenceFabricService, 'buildShadowSnapshot'>;
  private readonly presenter: ConversationalAgencyPresenter;
  private readonly toolIntent: FabricToolIntentService;
  private readonly capabilityBuilder: ZavorthCapabilityBuilderService;
  private readonly capabilityLab: CapabilityLabService;
  private readonly preferenceLearner: OperationalPreferenceLearner;
  private readonly skillMining: SkillMiningService;
  private readonly redTeam: ZavorthSecurityRedTeamService;
  private readonly policyCompiler: ZavorthPolicyCompilerService;
  private readonly constitutionLoader: ProjectConstitutionLoader;

  constructor(runtime: PracticalAgencyRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.fabric = runtime.fabric || new ZavorthIntelligenceFabricService({ now: this.now });
    this.presenter = runtime.presenter || new ConversationalAgencyPresenter();
    this.toolIntent = runtime.toolIntent || new FabricToolIntentService();
    this.capabilityBuilder = runtime.capabilityBuilder || new ZavorthCapabilityBuilderService();
    this.capabilityLab = runtime.capabilityLab || new CapabilityLabService();
    this.preferenceLearner = runtime.preferenceLearner || new OperationalPreferenceLearner();
    this.skillMining = runtime.skillMining || new SkillMiningService();
    this.redTeam = runtime.redTeam || new ZavorthSecurityRedTeamService();
    this.policyCompiler = runtime.policyCompiler || new ZavorthPolicyCompilerService();
    this.constitutionLoader = runtime.constitutionLoader || new ProjectConstitutionLoader();
  }

  public buildSnapshot(input: IntelligenceFabricInput & {
    policySource?: string | Record<string, unknown> | null;
    constitutionContent?: string | null;
    learningCandidates?: LearningCandidateSnapshot[] | null;
  }): PracticalAgencySnapshot {
    const fabric = this.fabric.buildShadowSnapshot(input);
    return this.compose({
      fabric,
      text: input.text,
      workspaceRoot: input.workspaceRoot || null,
      policySource: input.policySource,
      constitutionContent: input.constitutionContent,
      learningCandidates: input.learningCandidates || [],
    });
  }

  public compose(input: {
    fabric: IntelligenceFabricSnapshot;
    text: string;
    workspaceRoot?: string | null;
    policySource?: string | Record<string, unknown> | null;
    constitutionContent?: string | null;
    learningCandidates?: LearningCandidateSnapshot[] | null;
  }): PracticalAgencySnapshot {
    const conversation = this.presenter.present({ fabric: input.fabric });
    const toolIntent = this.toolIntent.buildSnapshot({ fabric: input.fabric });
    const capabilityBuilder = this.capabilityBuilder.buildProposal({ fabric: input.fabric });
    const capabilityLab = this.capabilityLab.simulate({ manifest: capabilityBuilder.manifest });
    const operationalPreferences = this.preferenceLearner.learn({ text: input.text });
    const skillMining = this.skillMining.mine({ text: input.text, candidates: input.learningCandidates || [] });
    const redTeam = this.redTeam.review({
      proposal: input.fabric.executionProposal,
      capability: capabilityBuilder,
    });
    const policyCompiler = this.policyCompiler.compile({ source: input.policySource });
    const projectConstitution = this.constitutionLoader.load({
      workspaceRoot: input.workspaceRoot || null,
      content: input.constitutionContent || null,
    });
    const phaseStatuses: PracticalAgencyPhaseStatus[] = [
      capabilityLab.status,
      redTeam.status,
      policyCompiler.status,
    ];
    const phasesBlocked = phaseStatuses.filter((status) => status === 'blocked').length;
    const phasesWarning = phaseStatuses.filter((status) => status === 'warning').length;
    const phasesPassed = phaseStatuses.filter((status) => status === 'passed').length;

    return {
      contractVersion: PRACTICAL_AGENCY_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      fabric: {
        taskKind: input.fabric.classification.taskKind,
        riskLevel: input.fabric.executionProposal.riskLevel,
        recommendedMode: input.fabric.classification.recommendedMode,
      },
      conversation,
      toolIntent,
      capabilityBuilder,
      capabilityLab,
      operationalPreferences,
      skillMining,
      redTeam,
      policyCompiler,
      projectConstitution,
      safety: {
        thinkingBlocked: false,
        liveActivationApplied: false,
        dangerousImpactRequiresGate: true,
        rawSecretsSerialized: false,
      },
      readiness: {
        status: phasesBlocked > 0 ? 'blocked' : phasesWarning > 0 ? 'warning' : 'passed',
        phasesPassed,
        phasesWarning,
        phasesBlocked,
      },
    };
  }
}
