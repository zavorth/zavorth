type RuntimeRefreshOptions = {
  applyRuntimeData: () => void;
  authHeaders: () => Record<string, string>;
  buildZavorthControlQueryString: () => string;
  connectRealtime: () => void;
  fetchCurrentArtifacts: () => Promise<unknown>;
  fetchDashboardEvents: () => Promise<unknown>;
  hasStoredToken: () => boolean;
  hydrateCurrentSession: () => Promise<unknown>;
  readJson: (path: string, options?: any) => Promise<any>;
  readSessionId: () => string;
  readToken: () => string;
  readRunId: () => string;
  state: any;
  updatePulse: () => void;
  writeRunId: (runId: string) => void;
};

export function createRuntimeRefresh(options: RuntimeRefreshOptions) {
  return async function refresh(refreshOptions: any = {}) {
    try {
      const auth = await options.readJson('/api/auth/status');
      const canAttemptProtectedSnapshot = Boolean(auth?.authenticated || options.readToken() || options.hasStoredToken());
      const queryString = options.buildZavorthControlQueryString();
      const zavorthControl = canAttemptProtectedSnapshot
        ? await options.readJson(`/api/web/zavorthControl${queryString}`, { headers: options.authHeaders() })
          .catch((error: any) => {
            if (error?.status === 404) {
              return options.readJson(`/api/web/dashboard${queryString}`, { headers: options.authHeaders() });
            }
            throw error;
          })
        : {
          live: false,
          authRequired: true,
          snapshot: null,
          status: 'protected',
          message: 'Unlock the local runtime to read live state.',
        };
      const canReadProtectedRuntime = Boolean(zavorthControl?.live && !zavorthControl?.authRequired);
      const [providerModelCatalog, providerActivation, salesPack, salesPackChannelIo, memoryFacts, externalAgents] = canReadProtectedRuntime
        ? await Promise.all([
          options.readJson('/api/providers/model-catalog', { headers: options.authHeaders() }).catch(() => null),
          options.readJson('/api/providers/activation', { headers: options.authHeaders() }).catch(() => null),
          options.readJson('/api/v2/sales-pack/snapshot', { headers: options.authHeaders() }).catch(() => null),
          options.readJson('/api/v2/sales-pack/channel-io/snapshot', { headers: options.authHeaders() }).catch(() => null),
          options.readJson(`/api/web/zavorthControl/memory?sessionId=${encodeURIComponent(options.readSessionId() || '')}`, { headers: options.authHeaders() })
            .catch((error: any) => error?.status === 404
              ? options.readJson(`/api/web/dashboard/memory?sessionId=${encodeURIComponent(options.readSessionId() || '')}`, { headers: options.authHeaders() }).catch(() => null)
              : null),
          options.readJson('/api/web/external-agents', { headers: options.authHeaders() }).catch(() => null),
        ])
        : [null, null, null, null, null, null];

      options.state.auth = auth;
      options.state.zavorthControl = zavorthControl;
      options.state.providerModelCatalog = providerModelCatalog?.providerModelCatalog || providerModelCatalog || null;
      options.state.providerActivation = providerActivation?.providerActivation || providerActivation || null;
      options.state.salesPack = salesPack;
      options.state.salesPackChannelIo = salesPackChannelIo;
      options.state.memoryFacts = memoryFacts;
      options.state.externalAgents = externalAgents?.snapshot || externalAgents || null;
      options.writeRunId(zavorthControl?.snapshot?.activeRun?.id || zavorthControl?.activeRun?.id || options.readRunId());

      if (canReadProtectedRuntime) {
        const sessionId = options.readSessionId();
        const sessionQuery = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
        const [catalog, companions, gatewayRuntime] = await Promise.all([
          options.readJson(`/api/web/catalog${sessionQuery}`, { headers: options.authHeaders() }).catch(() => null),
          options.readJson('/api/web/runtime/companions', { headers: options.authHeaders() }).catch(() => null),
          options.readJson(`/api/web/gateway/runtime${sessionQuery}`, { headers: options.authHeaders() }).catch(() => null),
        ]);
        options.state.catalog = catalog;
        options.state.companions = companions;
        options.state.gatewayRuntime = gatewayRuntime;
      } else {
        options.state.catalog = null;
        options.state.companions = null;
        options.state.gatewayRuntime = null;
      }

      options.state.lastError = null;
      options.state.updatedAt = new Date().toISOString();
      options.applyRuntimeData();
      if (!refreshOptions.skipSessionHydrate && canReadProtectedRuntime && options.readSessionId()) {
        options.hydrateCurrentSession().catch(() => undefined);
        options.fetchCurrentArtifacts().catch(() => undefined);
      }
      if (canReadProtectedRuntime && options.readSessionId()) {
        options.fetchDashboardEvents().catch(() => undefined);
      }
      if (!refreshOptions.skipRealtime) {
        options.connectRealtime();
      }
    } catch (error: any) {
      options.state.lastError = error?.message || String(error);
      options.state.updatedAt = new Date().toISOString();
      options.updatePulse();
    }
  };
}
