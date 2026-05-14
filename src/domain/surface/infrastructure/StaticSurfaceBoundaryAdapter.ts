import type { SurfaceApiPort, SurfaceDomainPort, SurfaceDomainReadModel } from '../domain/SurfaceDomainTypes.js';

type StaticSurfaceBoundaryAdapterRuntime = {
  now?: () => Date;
  surfaceApi?: SurfaceApiPort | null;
  supportedCommands?: string[] | null;
  boundaryPortsReady?: boolean | null;
};

export class StaticSurfaceBoundaryAdapter implements SurfaceDomainPort {
  private readonly now: () => Date;
  private readonly surfaceApi: SurfaceApiPort | null;
  private readonly supportedCommands: string[];
  private readonly boundaryPortsReady: boolean;

  constructor(runtime: StaticSurfaceBoundaryAdapterRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.surfaceApi = runtime.surfaceApi || null;
    this.supportedCommands = Array.isArray(runtime.supportedCommands)
      ? runtime.supportedCommands.filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
      : [];
    this.boundaryPortsReady = runtime.boundaryPortsReady === true || Boolean(this.surfaceApi);
  }

  public readCapabilities(): SurfaceDomainReadModel {
    const hasSignals = this.boundaryPortsReady || this.supportedCommands.length > 0;
    return {
      generatedAt: this.now().toISOString(),
      supportedCommands: this.supportedCommands.length,
      boundaryPortsReady: this.boundaryPortsReady,
      summary: hasSignals
        ? `Surface domain pronto com ${this.supportedCommands.length} comando(s) conhecido(s) e boundary ports internos publicados.`
        : 'Surface domain aguardando a ligacao canonica das surfaces ao boundary interno.',
      details: [
        this.boundaryPortsReady
          ? 'CLI, web e Telegram ja podem orbitar o mesmo boundary interno.'
          : 'Os boundary ports ainda precisam ser conectados nas surfaces restantes.',
        `Comandos conhecidos: ${this.supportedCommands.length}.`,
      ],
      source: hasSignals ? 'surface-boundary' : 'seed',
    };
  }
}
