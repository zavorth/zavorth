import type {
  EngineeringContextSnapshot,
  EngineeringIntent,
  RequirementGap,
} from '../contracts/EngineeringCoreContract.js';

export class DependencyNegotiationService {
  public buildReply(input: {
    runId: string;
    intent: EngineeringIntent;
    context: EngineeringContextSnapshot;
    gaps: RequirementGap[];
  }): string {
    if (input.gaps.length === 0) {
      const scriptHints = Object.entries(input.context.scripts || {})
        .slice(0, 3)
        .map(([name, command]) => `${name}=${command}`);
      const lines = [
        `Run ${input.runId} prepared para engenharia no workspace ${input.context.workspaceName}.`,
        `Objetivo: ${input.intent.objective}.`,
        input.intent.preferredCapability
          ? `Supervised route: ${input.intent.preferredCapability} with profile ${input.intent.preferredProfile}${input.intent.preferredAutonomyLevel ? ` and autonomy ${input.intent.preferredAutonomyLevel}` : ''}.`
          : null,
        input.context.instructionSummary ? `ZAVORTH.md: ${input.context.instructionSummary}.`
          : 'ZAVORTH.md: without instrucoes extras detectadas.',
      ];
      if (scriptHints.length > 0) {
        lines.push(`Detected scripts: ${scriptHints.join(' | ')}.`);
      }
      lines.push(
        input.intent.preferredCapability ? 'Can continue through supervised System Overlord for this request.'
          : 'I can continue with the canonical flow for this request.',
      );
      return lines.join('\n');
    }

    const lines = [
      `Para seguir com "${input.intent.objective}", encontrei ${input.gaps.length} pendencia(s) no run ${input.runId}:`,
      ...input.gaps.map((gap, index) => `${index + 1}. ${gap.summary} ${gap.detail}`),
    ];

    const nextSteps = input.gaps.map((gap) => this.describeNextStep(gap));
    lines.push(`next passo: ${nextSteps.join(' | ')}`);
    return lines.join('\n');
  }

  private describeNextStep(gap: RequirementGap): string {
    switch (gap.operatorAction) {
      case 'approve_install':
        return 'If you approve the installation, I will continue with the canonical repair.';
      case 'enable_docker':
        return 'ative o Docker ou prepare a imagem de sandbox para seguir no boundary seguro';
      case 'provide_secret':
        return 'provide the missing credential/variable before continuing';
      case 'install_toolchain':
        return 'install the missing toolchain or expose this binary in the environment';
      default:
        return 'this manual step is required before continuing';
    }
  }
}
