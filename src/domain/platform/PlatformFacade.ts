import { DomainFacadeBase, type DomainSnapshot } from '../DomainFacadeBase.js';
import type { PlatformRegistryStatusPort } from './domain/PlatformDomainTypes.js';

type PlatformFacadeRuntime = {
  now?: () => Date;
  platformRegistryService?: PlatformRegistryStatusPort;
};

export type PlatformDomainSnapshot = DomainSnapshot & {
  metrics: {
    total: number;
    plugins: number;
    skills: number;
    mcps: number;
    collections: number;
    recipes: number;
  };
};

export class PlatformFacade extends DomainFacadeBase<PlatformDomainSnapshot> {
  private readonly platformRegistry: PlatformRegistryStatusPort | null;

  constructor(runtime: PlatformFacadeRuntime = {}) {
    super('platform', 'Platform', runtime.now);
    this.platformRegistry = runtime.platformRegistryService || null;
  }

  public buildSnapshot(): PlatformDomainSnapshot {
    if (!this.platformRegistry) {
      return this.composeSnapshot({
        summary: 'Platform facade registrada, aguardando injecao do platform registry.',
        details: [
          'Sem registry injetado, o dominio nao sobe loaders/catalogos por conta propria.',
        ],
        metrics: {
          total: 0,
          plugins: 0,
          skills: 0,
          mcps: 0,
          collections: 0,
          recipes: 0,
        },
      }) as PlatformDomainSnapshot;
    }

    const snapshot = this.platformRegistry.buildStatusSummarySnapshot();

    return this.composeSnapshot({
      summary: snapshot.narrative.operatorSummary,
      details: [
        snapshot.narrative.headline,
        `Catalog sync: ${snapshot.catalogSync.summary}.`,
      ],
      metrics: {
        total: snapshot.summary.total,
        plugins: snapshot.summary.plugins,
        skills: snapshot.summary.skills,
        mcps: snapshot.summary.mcps,
        collections: snapshot.summary.collections,
        recipes: snapshot.summary.recipes,
      },
    }) as PlatformDomainSnapshot;
  }
}
