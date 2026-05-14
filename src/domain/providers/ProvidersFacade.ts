import { ProviderControlPlaneService } from '../../services/ProviderControlPlaneService.js';
import { DomainFacadeBase, type DomainSnapshot } from '../DomainFacadeBase.js';

type ProvidersFacadeRuntime = {
  now?: () => Date;
  providerControlPlaneService?: Pick<
    ProviderControlPlaneService,
    'listProviders' | 'listProfiles' | 'getCurrentConversationalProvider' | 'getCurrentConversationalModel'
  >;
};

export type ProvidersDomainSnapshot = DomainSnapshot & {
  metrics: {
    total: number;
    ready: number;
    profiles: number;
    currentProvider: string | null;
    currentModel: string | null;
  };
};

export class ProvidersFacade extends DomainFacadeBase<ProvidersDomainSnapshot> {
  private readonly providerControlPlane: Pick<
    ProviderControlPlaneService,
    'listProviders' | 'listProfiles' | 'getCurrentConversationalProvider' | 'getCurrentConversationalModel'
  > | null;

  constructor(runtime: ProvidersFacadeRuntime = {}) {
    super('providers', 'Providers', runtime.now);
    this.providerControlPlane = runtime.providerControlPlaneService || null;
  }

  public buildSnapshot(): ProvidersDomainSnapshot {
    if (!this.providerControlPlane) {
      return this.composeSnapshot({
        summary: 'Providers facade registrada, aguardando injecao do provider control plane.',
        details: [
          'Sem provider control plane injetado, o dominio nao resolve perfis/modelos por padrao.',
        ],
        metrics: {
          total: 0,
          ready: 0,
          profiles: 0,
          currentProvider: null,
          currentModel: null,
        },
      }) as ProvidersDomainSnapshot;
    }

    const providers = this.providerControlPlane.listProviders({ includeAdvanced: true });
    const profiles = this.providerControlPlane.listProfiles();
    const currentProvider = this.providerControlPlane.getCurrentConversationalProvider() || null;
    const currentModel = this.providerControlPlane.getCurrentConversationalModel() || null;

    return this.composeSnapshot({
      summary: `${providers.filter((entry) => entry.ready).length} provider(s) pronto(s) entre ${providers.length} opcao(oes) catalogada(s).`,
      details: [
        `Current provider: ${currentProvider || 'n/d'}.`,
        `Current model: ${currentModel || 'n/d'}.`,
        `Profiles: ${profiles.map((profile) => profile.label).join(', ') || 'nenhum'}.`,
      ],
      metrics: {
        total: providers.length,
        ready: providers.filter((entry) => entry.ready).length,
        profiles: profiles.length,
        currentProvider,
        currentModel,
      },
    }) as ProvidersDomainSnapshot;
  }
}
