import { DomainFacadeBase, type DomainSnapshot } from '../DomainFacadeBase.js';
import type { SurfaceApiPort } from './domain/SurfaceDomainTypes.js';
import { SurfaceUseCases } from './application/SurfaceUseCases.js';
import { StaticSurfaceBoundaryAdapter } from './infrastructure/StaticSurfaceBoundaryAdapter.js';
import { SurfaceDomainPresenter } from './presentation/SurfaceDomainPresenter.js';

type SurfaceFacadeRuntime = {
  now?: () => Date;
  surfaceApi?: SurfaceApiPort | null;
  supportedCommands?: string[] | null;
  boundaryPortsReady?: boolean | null;
};

export type SurfaceDomainSnapshot = DomainSnapshot & {
  metrics: {
    supportedCommands: number;
    boundaryPortsReady: boolean;
  };
};

export class SurfaceFacade extends DomainFacadeBase<SurfaceDomainSnapshot> {
  private readonly useCases: SurfaceUseCases;
  private readonly presenter = new SurfaceDomainPresenter();

  constructor(runtime: SurfaceFacadeRuntime = {}) {
    super('surface', 'Surface', runtime.now);
    this.useCases = new SurfaceUseCases({
      now: runtime.now,
      surfaceDomain: new StaticSurfaceBoundaryAdapter({
        now: runtime.now,
        surfaceApi: runtime.surfaceApi || null,
        supportedCommands: runtime.supportedCommands,
        boundaryPortsReady: runtime.boundaryPortsReady,
      }),
    });
  }

  public buildSnapshot(): SurfaceDomainSnapshot {
    return this.composeSnapshot(this.presenter.presentReadiness(this.useCases.buildReadiness())) as SurfaceDomainSnapshot;
  }
}
