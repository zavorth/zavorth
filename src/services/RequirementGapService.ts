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
          ? 'Docker is not ready to execute this supervised action yet.'
          : 'Docker is not ready for guarded mutable execution yet.',
        detail: input.intent.preferredCapability === 'docker.exec'
          ? `To continue with "${input.intent.objective}", Zavorth needs Docker runtime accessible on this host.`
          : `To continue with "${input.intent.objective}", Zavorth wants to use container by default and did not find Docker ready on the host.`,
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
        detail: `The runtime reported that dependency ${missingModuleMatch[1]} is not available.`,
        operatorAction: 'approve_install',
      });
    }

    if (/is not recognized as an internal or external command|command not found|No such file or directory/i.test(stderr)) {
      gaps.push({
        id: randomUUID(),
        kind: 'missing_toolchain',
        blocking: true,
        summary: 'A required tool is not available in the environment.',
        detail: 'The requested command does not exist on this host or current container.',
        operatorAction: 'install_toolchain',
      });
    }

    if (/missing required env|secret|token|credential|unauthorized|forbidden/i.test(stderr)) {
      gaps.push({
        id: randomUUID(),
        kind: 'missing_secret',
        blocking: true,
        summary: 'missing uma credential, token ou variable de ambiente.',
        detail: 'The run depends on sensitive configuration that has not been provided yet.',
        operatorAction: 'provide_secret',
      });
    }

    if (/timeout|timed out|eai_again|temporarily unavailable|network/i.test(stderr)) {
      gaps.push({
        id: randomUUID(),
        kind: 'external_transient_error',
        blocking: false,
        summary: 'Houve um error external/transitorio durante a tentactive.',
        detail: 'A failure parece temporaria e pode exigir retry ou troca de boundary.',
        operatorAction: 'manual_step',
      });
    }

    return gaps;
  }
}
