type RuntimeModelProfileOptions = {
  state: any;
  getRuns: () => any[];
  getActiveRun: () => any;
  text: (value: unknown, fallback?: string) => string;
};

function isUnknownModelLabel(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  const legacyUnsetLabel = 'model ' + 'not' + ' informed';
  return !normalized || ['current model', legacyUnsetLabel, 'model not set'].includes(normalized);
}

export function normalizeModelProfile(profile: any) {
  if (!profile || typeof profile !== 'object') return null;
  const modelLabel = String(profile.modelLabel || profile.model || '').trim();
  const providerLabel = String(profile.providerLabel || profile.provider || '').trim();
  if (isUnknownModelLabel(modelLabel) && !providerLabel) return null;
  return {
    providerLabel: providerLabel || 'Provider not set',
    modelLabel: isUnknownModelLabel(modelLabel) ? 'Current model not set' : modelLabel,
    routingPolicy: String(profile.routingPolicy || profile.route || 'unknown').trim() || 'unknown',
    fallbackModelLabel: String(profile.fallbackModelLabel || profile.fallbackModel || '').trim() || null,
    supportsTools: profile.supportsTools,
    supportsVision: profile.supportsVision,
    supportsStreaming: profile.supportsStreaming,
  };
}

export function createRuntimeModelProfile({
  state,
  getRuns,
  getActiveRun,
  text,
}: RuntimeModelProfileOptions) {
  function resolveCurrentModelProfile() {
    const activeRun = getActiveRun();
    const runs = getRuns();
    const candidates = [
      activeRun?.modelProfile,
      state.zavorthControl?.modelProfile,
      state.zavorthControl?.snapshot?.modelProfile,
      ...runs.map((run) => run?.modelProfile),
    ];
    for (const candidate of candidates) {
      const profile = normalizeModelProfile(candidate);
      if (profile && !isUnknownModelLabel(profile.modelLabel)) return profile;
    }
    return normalizeModelProfile(state.zavorthControl?.modelProfile)
      || normalizeModelProfile(state.zavorthControl?.snapshot?.modelProfile)
      || {
        providerLabel: 'Provider not set',
        modelLabel: 'Current model not set',
        routingPolicy: 'unknown',
        fallbackModelLabel: null,
      };
  }

  function getCurrentModelLabel() {
    return resolveCurrentModelProfile().modelLabel;
  }

  function getCurrentProviderLabel() {
    return resolveCurrentModelProfile().providerLabel;
  }

  function getCurrentModelRouteLabel() {
    const profile = resolveCurrentModelProfile();
    const route = String(profile.routingPolicy || '').trim().toLowerCase();
    if (route === 'gateway') return 'gateway';
    if (route === 'fallback') return 'fallback';
    if (route === 'direct') return 'direct';
    return text(profile.providerLabel, 'runtime');
  }

  function publishCurrentModelProfile() {
    const modelLabel = getCurrentModelLabel();
    const routeLabel = getCurrentModelRouteLabel();
    document.querySelectorAll('.echo-meta__model').forEach((node) => {
      node.textContent = modelLabel;
    });
    document.querySelectorAll('.echo-meta__cost').forEach((node) => {
      node.textContent = routeLabel;
    });

    const usageFirstModelCell = document.querySelector('#sector-usage table.data-table tbody tr:first-child td:first-child');
    if (usageFirstModelCell) usageFirstModelCell.textContent = modelLabel;

    document.querySelectorAll('#sector-agents .entity-card__meta .badge--muted').forEach((node) => {
      node.textContent = modelLabel;
    });
  }

  return {
    getCurrentModelLabel,
    getCurrentModelRouteLabel,
    getCurrentProviderLabel,
    publishCurrentModelProfile,
    resolveCurrentModelProfile,
  };
}
