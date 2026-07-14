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
        `Run ${input.runId} preparado para engenharia no workspace ${input.context.workspaceName}.`,
        `Objetivo: ${input.intent.objective}.`,
        input.intent.preferredCapability
          ? `Rota supervisionada: ${input.intent.preferredCapability} com perfil ${input.intent.preferredProfile}${input.intent.preferredAutonomyLevel ? ` e autonomia ${input.intent.preferredAutonomyLevel}` : ''}.`
          : null,
        input.context.instructionSummary
          ? `ZAVORTH.md: ${input.context.instructionSummary}.`
          : 'ZAVORTH.md: sem instrucoes extras detectadas.',
      ];
      if (scriptHints.length > 0) {
        lines.push(`Detected scripts: ${scriptHints.join(' | ')}.`);
      }
      lines.push(
        input.intent.preferredCapability
          ? 'Posso seguir pelo System Overlord supervisionado desse pedido.'
          : 'Posso seguir com o fluxo canonico desse pedido.',
      );
      return lines.join('\n');
    }

    const lines = [
      `Para seguir com "${input.intent.objective}", encontrei ${input.gaps.length} pendencia(s) no run ${input.runId}:`,
      ...input.gaps.map((gap, index) => `${index + 1}. ${gap.summary} ${gap.detail}`),
    ];

    const nextSteps = input.gaps.map((gap) => this.describeNextStep(gap));
    lines.push(`Proximo passo: ${nextSteps.join(' | ')}`);
    return lines.join('\n');
  }

  private describeNextStep(gap: RequirementGap): string {
    switch (gap.operatorAction) {
      case 'approve_install':
        return 'se voce autorizar a instalacao, eu sigo com o repair canonico';
      case 'enable_docker':
        return 'ative o Docker ou prepare a imagem de sandbox para seguir no boundary seguro';
      case 'provide_secret':
        return 'forneca a credencial/variavel faltante antes de prosseguir';
      case 'install_toolchain':
        return 'instale a toolchain faltante ou exponha esse binario no ambiente';
      default:
        return 'preciso desse passo manual antes de continuar';
    }
  }
}
