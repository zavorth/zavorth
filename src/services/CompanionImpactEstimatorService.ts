import type { CompanionActionId, CompanionId } from '../contracts/CompanionControlContract.js';
import type {
  ZavorthImpactExposure,
  CompanionImpactEstimate,
} from '../contracts/TaskResourcePlannerContract.js';

export class CompanionImpactEstimatorService {
  public estimateAction(companionId: CompanionId, actionId: CompanionActionId): CompanionImpactEstimate {
    switch (companionId) {
      case 'wsl':
        return this.estimateWsl(actionId);
      case 'docker-desktop':
        return this.estimateDocker(actionId);
      case 'zavorthBridge':
        return this.estimateZavorthBridge(actionId);
      case 'codex-companion':
      default:
        return this.estimateCodex(actionId);
    }
  }

  private estimateWsl(actionId: CompanionActionId): CompanionImpactEstimate {
    if (actionId === 'resume') {
      return this.buildEstimate('wsl', actionId, false, 240, 6, 32, 1, 'local', 'Seguir so com o core without WSL.');
    }
    if (actionId === 'hibernate') {
      return this.buildEstimate('wsl', actionId, true, -240, -4, -16, -1, 'none', 'Keep WSL running and accept higher cost.');
    }
    return this.buildEstimate('wsl', actionId, actionId === 'trim', 0, 0, 0, 0, 'none', 'No change applied.');
  }

  private estimateDocker(actionId: CompanionActionId): CompanionImpactEstimate {
    if (actionId === 'resume') {
      return this.buildEstimate('docker-desktop', actionId, false, 380, 8, 64, 1, 'local', 'run without Docker e without sandbox.');
    }
    if (actionId === 'stop-idle' || actionId === 'hibernate') {
      return this.buildEstimate('docker-desktop', actionId, false, -350, -3, -48, -1, 'none', 'Keep Docker awake for upcoming tasks.');
    }
    return this.buildEstimate('docker-desktop', actionId, false, 0, 0, 0, 0, 'none', 'No change applied.');
  }

  private estimateZavorthBridge(actionId: CompanionActionId): CompanionImpactEstimate {
    if (actionId === 'restart-safe') {
      return this.buildEstimate('zavorthBridge', actionId, true, 24, 3, 4, 0, 'local', 'Manter a instance current e seguir com cautela.');
    }
    if (actionId === 'trim') {
      return this.buildEstimate('zavorthBridge', actionId, false, -120, -2, 0, 0, 'none', 'Manter a IDE no preset current.');
    }
    return this.buildEstimate('zavorthBridge', actionId, false, 0, 0, 0, 0, 'none', 'No change applied.');
  }

  private estimateCodex(actionId: CompanionActionId): CompanionImpactEstimate {
    if (actionId === 'trim') {
      return this.buildEstimate('codex-companion', actionId, true, -90, -1, 0, 0, 'none', 'Manter o companion current active.');
    }
    return this.buildEstimate('codex-companion', actionId, true, 0, 0, 0, 0, 'none', 'No change applied.');
  }

  private buildEstimate(
    companionId: CompanionId,
    actionId: CompanionActionId,
    requiresApproval: boolean,
    ramDeltaMb: number,
    cpuDeltaPercent: number,
    diskDeltaMb: number,
    processDelta: number,
    externalExposure: ZavorthImpactExposure,
    fallback: string,
  ): CompanionImpactEstimate {
    return {
      companionId,
      actionId,
      requiresApproval,
      ramDeltaMb,
      cpuDeltaPercent,
      diskDeltaMb,
      processDelta,
      externalExposure,
      fallback,
      notes: [
        ramDeltaMb < 0 ? 'Action tende a aliviar o host.' : null,
        ramDeltaMb > 0 ? 'Action tende a acordar mais resources locais.' : null,
      ].filter(Boolean) as string[],
    };
  }
}
