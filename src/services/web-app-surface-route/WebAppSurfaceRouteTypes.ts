export type WebAppSurfaceRouteDeps = {
  [key: string]: any;
  writeJson: (res: any, body: unknown, statusCode?: number) => void;
  readJsonBody: (req: any) => Promise<Record<string, any>>;
  resolveSessionId: (url: URL) => string;
  buildMemoryPlaneSnapshot: (sessionId: string) => Promise<any>;
  runtime: { webUserId?: string | null } | null;
  realtime: { createSession: () => string; getChatId: (sessionId: string) => string | null } | null;
  runtimeGateway: {
    buildHydratedSnapshot: (input: any) => Promise<any>;
    buildDomainSummarySnapshot?: () => any;
    buildDomainSnapshot?: () => any;
  } | null;
  gateway: {
    buildHydratedSnapshot: (input: any) => Promise<any>;
    buildDomainSummarySnapshot?: () => any;
    buildDomainSnapshot?: () => any;
  } | null;
  gatewayRuntime?: {
    buildCanonicalSnapshot: (input: any) => Promise<any>;
  } | null;
  gatewayChannelRouter: {
    getChannel: (id: string) => any;
    sendToSession: (...args: any[]) => Promise<any>;
    spawnSession: (...args: any[]) => any;
  } | null;
};
