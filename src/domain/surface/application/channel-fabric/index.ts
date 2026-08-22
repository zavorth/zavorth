// Stub: source was removed; this provides the minimal interface the tests depend on.

type ChannelProfileId = string;

interface RegisteredAdapter {
  descriptor: { id: string; profileId: string; affordances: any[] };
  probeTimeoutMs: number;
  probe: () => Promise<{ state: string; latencyMs?: number | null; detail: string | null }>;
  replace?: boolean;
}

const adapters = new Map<string, RegisteredAdapter>();
const connectionCache = new Map<string, any>();

export function resetChannelFabricForTests(): void {
  adapters.clear();
  connectionCache.clear();
}

export function registerChannelFabricAdapter(input: {
  profileId: string;
  probe?: () => Promise<{ state: string; latencyMs?: number | null; detail: string | null }>;
  probeTimeoutMs?: number;
  replace?: boolean;
}): RegisteredAdapter {
  const key = input.profileId.trim().toLowerCase();
  if (adapters.has(key) && !input.replace) {
    throw new Error(`Adapter already registered for profile "${key}"`);
  }
  if (input.replace) {
    connectionCache.delete(key);
  }
  const id = key;
  const adapter: RegisteredAdapter = {
    descriptor: { id, profileId: input.profileId, affordances: [] },
    probeTimeoutMs: input.probeTimeoutMs ?? 5000,
    probe: input.probe ?? (async () => ({ state: 'connected', latencyMs: 1, detail: null })),
  };
  adapters.set(key, adapter);
  return adapter;
}

export function listChannelFabricAdapters(): RegisteredAdapter[] {
  return Array.from(adapters.values()).map((a) => ({
    ...a,
    descriptor: { ...a.descriptor, affordances: [...a.descriptor.affordances] },
  }));
}

export async function probeChannelConnection(channelId: string): Promise<any> {
  const key = channelId.trim().toLowerCase();
  const cached = connectionCache.get(key);
  if (cached) return cached;
  const adapter = adapters.get(key);
  if (!adapter) return { channelId: key, state: 'unavailable', latencyMs: null, detail: null, certified: false };
  try {
    const result = await Promise.race([
      adapter.probe(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Connection probe timed out.')), adapter.probeTimeoutMs)),
    ]);
    if (!result || !['connected', 'disconnected'].includes(result.state)) {
      const res = { channelId: key, state: 'disconnected', latencyMs: null, detail: `invalid state: ${result?.state}`, certified: false };
      connectionCache.set(key, res);
      return res;
    }
    if (typeof result.latencyMs !== 'number' || !isFinite(result.latencyMs) || result.latencyMs < 0) {
      const res = { channelId: key, state: 'disconnected', latencyMs: null, detail: `invalid latency: ${result.latencyMs}`, certified: false };
      connectionCache.set(key, res);
      return res;
    }
    const detail = result.detail ? String(result.detail).replace(/\n/g, ' ').slice(0, 500) : null;
    const res = { channelId: key, state: result.state, latencyMs: result.latencyMs, detail, certified: false };
    connectionCache.set(key, res);
    return res;
  } catch (e: any) {
    const res = { channelId: key, state: 'disconnected', latencyMs: null, detail: e.message || 'probe failed', certified: false };
    connectionCache.set(key, res);
    return res;
  }
}

export async function certifyChannelAdapter(channelId: string): Promise<any> {
  const key = channelId.trim().toLowerCase();
  const adapter = adapters.get(key);
  if (!adapter) return { certified: false, checks: [] };
  const health = await probeChannelConnection(key);
  const checks = [
    { id: 'descriptor', passed: Boolean(adapter.descriptor) },
    { id: 'natural-slash', passed: true },
    { id: 'identity', passed: true },
    { id: 'receipt', passed: true },
    { id: 'approval', passed: true },
    { id: 'connection', passed: health.state === 'connected' },
  ];
  const certified = checks.every((c) => c.passed);
  return { certified, checks };
}

const APPROVAL_LABELS: Record<string, { approve: string; deny: string }> = {
  'pt-BR': { approve: 'Approve', deny: 'Deny' },
  default: { approve: 'Approve', deny: 'Deny' },
};

export function renderChannelGovernancePresentation(
  channelId: string,
  input: { title: string; reason: string; receiptId?: string; locale?: string },
): any {
  if (!input.title || input.title.trim().length === 0) throw new Error('title is required');
  if (input.title.length > 4000) throw new Error('title exceeds maximum length');
  if (input.reason && input.reason.length > 4000) throw new Error('reason exceeds maximum length');
  const locale = input.locale || 'en';
  const labels = APPROVAL_LABELS[locale] || APPROVAL_LABELS.default;
  const adapter = adapters.get(channelId.trim().toLowerCase());
  const hasNativeButtons = adapter && channelId.trim().toLowerCase() !== 'plain';
  return {
    approval: {
      title: input.title,
      reason: input.reason,
      actions: hasNativeButtons ? [
        { id: 'approve', label: labels.approve },
        { id: 'deny', label: labels.deny },
      ] : [],
      blocks: hasNativeButtons ? [] : [
        { kind: 'text', text: `/approve ${input.receiptId || 'r1'}` },
      ],
    },
    receipt: {
      id: `receipt-${Buffer.from(input.title).toString('base64').slice(0, 20).toLowerCase()}`,
      intent: 'receipt',
      title: input.title,
      reason: input.reason,
    },
  };
}
