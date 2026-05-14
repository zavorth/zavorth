import { ZavorthPlatformRegistryService } from '../../services/ZavorthPlatformRegistryService.js';
import { ZavorthRegistryClient } from '../registry/ZavorthRegistryClient.js';

export interface EcosystemCollection {
  id: string;
  name: string;
  packages: string[];
}

export type CollectionInstallResult = {
  collectionId: string;
  resolvedPackageIds: string[];
  installedCount: number;
  missingCount: number;
};

type CollectionInstallerRuntime = {
  registryClient?: ZavorthRegistryClient;
  platformRegistryService?: Pick<ZavorthPlatformRegistryService, 'buildSnapshot'>;
};

export class CollectionInstaller {
  private readonly registry: ZavorthRegistryClient;
  private readonly platformRegistry: Pick<ZavorthPlatformRegistryService, 'buildSnapshot'>;

  constructor(runtime: ZavorthRegistryClient | CollectionInstallerRuntime) {
    if (runtime instanceof ZavorthRegistryClient) {
      this.registry = runtime;
      this.platformRegistry = new ZavorthPlatformRegistryService();
      return;
    }

    this.registry = runtime.registryClient || new ZavorthRegistryClient();
    this.platformRegistry = runtime.platformRegistryService || new ZavorthPlatformRegistryService();
  }

  public async installCollection(collectionId: string): Promise<CollectionInstallResult> {
    const normalizedId = this.normalizeCollectionId(collectionId);
    const snapshot = this.platformRegistry.buildSnapshot({ selectedId: normalizedId });
    const selectedCollection = snapshot.selectedCollection;
    if (!selectedCollection || this.normalizeValue(selectedCollection.id) !== this.normalizeValue(normalizedId)) {
      throw new Error(`Colecao nao encontrada no platform plane: ${collectionId}.`);
    }

    const resolvedPackageIds = selectedCollection.entryIds.slice();
    let installedCount = 0;
    for (const packageId of resolvedPackageIds) {
      if (await this.registry.install(packageId)) {
        installedCount += 1;
      }
    }

    return {
      collectionId: selectedCollection.id,
      resolvedPackageIds,
      installedCount,
      missingCount: Math.max(0, selectedCollection.missingCount || 0),
    };
  }

  private normalizeCollectionId(value: string): string {
    const normalized = this.normalizeValue(value);
    return normalized.startsWith('collection:') ? normalized : `collection:${normalized}`;
  }

  private normalizeValue(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase();
  }
}

export interface CollectionRecipe {
  id: string;
  applySteps: {
    action: 'install_pkg' | 'configure_env' | 'run_script';
    target: string;
  }[];
}

export type RecipeRunResult = {
  recipeId: string;
  appliedSteps: number;
  manualSteps: string[];
};

type RecipeRunnerRuntime = {
  installer?: CollectionInstaller;
  registryClient?: ZavorthRegistryClient;
};

export class RecipeRunner {
  private readonly installer: CollectionInstaller;
  private readonly registry: ZavorthRegistryClient;

  constructor(runtime: CollectionInstaller | RecipeRunnerRuntime) {
    if (runtime instanceof CollectionInstaller) {
      this.installer = runtime;
      this.registry = new ZavorthRegistryClient();
      return;
    }

    this.installer = runtime.installer || new CollectionInstaller({
      registryClient: runtime.registryClient,
    });
    this.registry = runtime.registryClient || new ZavorthRegistryClient();
  }

  public async runRecipe(recipe: CollectionRecipe): Promise<RecipeRunResult> {
    let appliedSteps = 0;
    const manualSteps: string[] = [];

    for (const step of recipe.applySteps) {
      if (step.action === 'install_pkg') {
        if (this.normalizeValue(step.target).startsWith('collection:')) {
          await this.installer.installCollection(step.target);
        } else {
          await this.registry.install(step.target);
        }
        appliedSteps += 1;
        continue;
      }

      manualSteps.push(`${step.action}:${step.target}`);
    }

    return {
      recipeId: recipe.id,
      appliedSteps,
      manualSteps,
    };
  }

  private normalizeValue(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase();
  }
}
