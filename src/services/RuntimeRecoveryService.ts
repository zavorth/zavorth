import { DiscordGatewayRepairFlowService, type DiscordGatewayRepairFlowReport } from './DiscordGatewayRepairFlowService.js';
import { GatewayHealthRenewalService, type GatewayHealthRenewalReport } from './GatewayHealthRenewalService.js';
import type { RuntimeAccessReadinessReport } from '../runtime/access/RuntimeAccessReadinessService.js';
import { config } from '../config/index.js';

export type RuntimeRecoveryAssessment = {
  readyForUse: boolean;
  blockingReasons: string[];
  warnings: string[];
  healthRenewal: GatewayHealthRenewalReport;
  discordRepair: DiscordGatewayRepairFlowReport;
  summary: string;
};

export class RuntimeRecoveryService {
  private readonly healthRenewalService: GatewayHealthRenewalService;
  private readonly discordRepairFlowService: DiscordGatewayRepairFlowService;

  constructor(options: {
    healthRenewalService?: GatewayHealthRenewalService;
    discordRepairFlowService?: DiscordGatewayRepairFlowService;
  } = {}) {
    this.healthRenewalService = options.healthRenewalService || new GatewayHealthRenewalService();
    this.discordRepairFlowService = options.discordRepairFlowService || new DiscordGatewayRepairFlowService({
      capabilityLifecycleStateFile: config.capabilityLifecycleStateFile,
      discordRequiredOnBoot: config.discordRequiredOnBoot,
    });
  }

  public assess(readiness: RuntimeAccessReadinessReport, requireMutableAccess: boolean): RuntimeRecoveryAssessment {
    const healthRenewal = this.healthRenewalService.inspect(readiness);
    const discordRepair = this.discordRepairFlowService.inspect(readiness.runtime.discordBridge);
    const blockingReasons: string[] = [];
    const warnings: string[] = [];

    const readonlyReady =
      readiness.runtime.telegramWorker.alive
      && (readiness.runtime.hostSupervisor.alive || readiness.runtime.dashboard?.active === true)
      && !readiness.local.issues.some((issue) => {
        const normalized = String(issue || '').trim().toLowerCase();
        return normalized.startsWith('o host supervisor nao esta ativo')
          || normalized.startsWith('o worker principal do zavorth nao esta ativo')
          || normalized.startsWith('a superficie web do zavorth nao respondeu');
      });

    const readyForUse = readiness.local.ready || (!requireMutableAccess && readonlyReady);

    if (!readyForUse) {
      blockingReasons.push(...readiness.local.issues.slice(0, 4));
    }

    if (discordRepair.status === 'attention') {
      warnings.push(discordRepair.summary);
    }
    if (healthRenewal.status === 'renewal_recommended') {
      warnings.push(healthRenewal.summary);
    }

    const summary = readyForUse
      ? warnings.length > 0
        ? `${readiness.summary} Avisos: ${warnings.join(' | ')}`
        : readiness.summary
      : blockingReasons[0] || readiness.summary;

    return {
      readyForUse,
      blockingReasons,
      warnings,
      healthRenewal,
      discordRepair,
      summary,
    };
  }
}

