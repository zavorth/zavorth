import { randomUUID } from 'crypto';
import type {
  EngineeringContextSnapshot,
  EngineeringIntent,
  RequirementGap,
} from '../contracts/EngineeringCoreContract.js';
import { SandboxExecutionService } from './SandboxExecutionService.js';

type RequirementGapServiceOptions = {
  sandboxExecutionService?: Pick<SandboxExecutionService, 'isDockerAvailable' | 'getDockerImageForLanguage'>;
};

export class RequirementGapService {
  private readonly sandboxExecutionService: Pick<SandboxExecutionService, 'isDockerAvailable' | 'getDockerImageForLanguage'>;

  constructor(options: RequirementGapServiceOptions = {}) {
    this.sandboxExecutionService = options.sandboxExecutionService || new SandboxExecutionService();
  }

  public detectForIntent(input: {
    intent: EngineeringIntent;
    context: EngineeringContextSnapshot;
    stderr?: string | null;
  }): RequirementGap[] {
    const gaps: RequirementGap[] = [];
    const stderr = String(input.stderr || '').trim();

    if (this.requiresDockerBoundary(input.intent) && !this.sandboxExecutionService.isDockerAvailable()) {
      gaps.push({
        id: randomUUID(),
        kind: 'missing_docker',
        blocking: true,
        summary: input.intent.preferredCapability === 'docker.exec'
          ? 'Docker ainda nao esta pronto para executar essa acao supervisionada.'
          : 'Docker ainda nao esta pronto para execucao mutavel guardada.',
        detail: input.intent.preferredCapability === 'docker.exec'
          ? `Para seguir com "${input.intent.objective}", o Zavorth precisa do runtime Docker acessivel neste host.`
          : `Para seguir com "${input.intent.objective}", o Zavorth quer usar container por padrao e nao encontrou Docker pronto no host.`,
        operatorAction: 'enable_docker',
      });
    }

    gaps.push(...this.detectFromStderr(stderr));
    return gaps;
  }

  private requiresDockerBoundary(intent: EngineeringIntent): boolean {
    if (intent.preferredCapability === 'docker.exec' || intent.kind === 'install_and_retry' || intent.kind === 'create_project') {
      return true;
    }
    if (
      intent.preferredCapability === 'browser.control'
      || intent.preferredCapability === 'network.tunnel'
      || intent.preferredCapability === 'wsl.exec'
      || intent.preferredCapability === 'desktop.automation'
      || intent.preferredCapability === 'computer_use.visual_action'
      || intent.preferredCapability === 'node.invoke'
      || intent.preferredCapability === 'secrets.read'
    ) {
      return false;
    }
    return intent.mutating;
  }

  private detectFromStderr(stderr: string): RequirementGap[] {
    if (!stderr) {
      return [];
    }

    const gaps: RequirementGap[] = [];

    const missingModuleMatch =
      stderr.match(/cannot find module ['"]([^'"]+)['"]/i)
      || stderr.match(/module not found[:\s]+['"]?([^'"\s]+)/i);
    if (missingModuleMatch) {
      gaps.push({
        id: randomUUID(),
        kind: 'missing_dependency',
        blocking: false,
        summary: `Dependencia faltando: ${missingModuleMatch[1]}.`,
        detail: `O runtime reportou que a dependencia ${missingModuleMatch[1]} nao esta disponivel.`,
        operatorAction: 'approve_install',
      });
    }

    if (/is not recognized as an internal or external command|command not found|No such file or directory/i.test(stderr)) {
      gaps.push({
        id: randomUUID(),
        kind: 'missing_toolchain',
        blocking: true,
        summary: 'Uma ferramenta necessaria nao esta disponivel no ambiente.',
        detail: 'O comando pedido nao existe neste host ou container atual.',
        operatorAction: 'install_toolchain',
      });
    }

    if (/missing required env|secret|token|credential|unauthorized|forbidden/i.test(stderr)) {
      gaps.push({
        id: randomUUID(),
        kind: 'missing_secret',
        blocking: true,
        summary: 'Falta uma credencial, token ou variavel de ambiente.',
        detail: 'O run depende de configuracao sensivel que ainda nao foi fornecida.',
        operatorAction: 'provide_secret',
      });
    }

    if (/timeout|timed out|eai_again|temporarily unavailable|network/i.test(stderr)) {
      gaps.push({
        id: randomUUID(),
        kind: 'external_transient_error',
        blocking: false,
        summary: 'Houve um erro externo/transitorio durante a tentativa.',
        detail: 'A falha parece temporaria e pode exigir retry ou troca de boundary.',
        operatorAction: 'manual_step',
      });
    }

    return gaps;
  }
}
