import type {
  CapabilityActivationMode,
  CapabilityLifecycleService,
  CapabilityManifest,
} from './CapabilityLifecycleService.js';
import type {
  ZavorthCompanionDependencyId,
  ZavorthImpactExposure,
  CapabilityImpactEstimate,
} from '../contracts/TaskResourcePlannerContract.js';

type CapabilityLifecyclePort = Pick<CapabilityLifecycleService, 'getManifest'>;

type CapabilityImpactEstimatorRuntime = {
  capabilityLifecycle?: CapabilityLifecyclePort | null;
};

export class CapabilityImpactEstimatorService {
  private readonly capabilityLifecycle: CapabilityLifecyclePort | null;

  constructor(runtime: CapabilityImpactEstimatorRuntime = {}) {
    this.capabilityLifecycle = runtime.capabilityLifecycle || null;
  }

  public estimateCapability(capabilityId: string): CapabilityImpactEstimate | null {
    const manifest = this.capabilityLifecycle?.getManifest(capabilityId) || null;
    if (!manifest) {
      return null;
    }
    return this.estimateManifest(manifest);
  }

  public estimateManifest(manifest: CapabilityManifest): CapabilityImpactEstimate {
    const companionDependencies = this.resolveCompanionDependencies(manifest.id);
    return {
      capabilityId: manifest.id,
      label: manifest.label,
      approvalRequired: manifest.approvalRequired,
      activationMode: manifest.activationMode,
      ramMb: Number(manifest.estimatedFootprint.ramIdleMb || 0),
      cpuPercent: this.estimateCpuPercent(manifest.id, manifest.activationMode, manifest.estimatedFootprint.processCount),
      diskMb: Number(manifest.estimatedFootprint.diskMb || 0),
      processCount: Number(manifest.estimatedFootprint.processCount || 0),
      externalExposure: this.resolveExposure(manifest.id, manifest.activationMode),
      companionDependencies,
      fallback: String(manifest.fallbackBehavior || '').trim() || 'Executa only o core leve.',
      notes: [
        manifest.estimatedFootprint.notes,
        manifest.provisioningRecipe?.notes,
        companionDependencies.length > 0
          ? `Depende de ${companionDependencies.join(', ')} no host.`
          : null,
      ].filter(Boolean) as string[],
    };
  }

  private estimateCpuPercent(
    capabilityId: string,
    activationMode: CapabilityActivationMode,
    processCount: number,
  ): number {
    const processWeight = Math.max(1, Number(processCount || 0) || 0);
    if (capabilityId === 'sandbox') {
      return 18;
    }
    if (capabilityId === 'qa' || capabilityId === 'watch-mode') {
      return 24;
    }
    if (capabilityId === 'remote') {
      return 16;
    }
    if (capabilityId === 'media') {
      return 10;
    }
    if (capabilityId === 'public-tunnel') {
      return 6;
    }
    if (capabilityId === 'recurring-automation') {
      return 5;
    }
    if (activationMode === 'sidecar') {
      return Math.max(8, processWeight * 6);
    }
    if (activationMode === 'lazy') {
      return Math.max(3, processWeight * 3);
    }
    return Math.max(1, processWeight * 2);
  }

  private resolveExposure(capabilityId: string, activationMode: CapabilityActivationMode): ZavorthImpactExposure {
    if (capabilityId === 'public-tunnel') {
      return 'public';
    }
    if (capabilityId === 'remote') {
      return 'network';
    }
    if (activationMode === 'sidecar') {
      return 'local';
    }
    return 'none';
  }

  private resolveCompanionDependencies(capabilityId: string): ZavorthCompanionDependencyId[] {
    if (capabilityId === 'sandbox') {
      return ['wsl', 'docker-desktop'];
    }
    return [];
  }
}
