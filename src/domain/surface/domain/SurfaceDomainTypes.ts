export type SurfaceApiPort = {
  handleCommand?: (input: unknown) => Promise<unknown>;
  maybeHandle?: (context: unknown, parsedCommand?: unknown | null) => Promise<boolean>;
};

export type SurfaceDomainPort = {
  readCapabilities(): SurfaceDomainReadModel;
};

export type SurfaceDomainReadModel = {
  generatedAt: string;
  supportedCommands: number;
  boundaryPortsReady: boolean;
  summary: string;
  details: string[];
  source: 'surface-boundary' | 'seed';
};
