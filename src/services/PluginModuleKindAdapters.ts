import type {
  ZavorthPluginManifest,
  ZavorthPluginModuleKind,
} from '../contracts/PluginManifestContract.js';
import type {
  ZavorthPluginCapabilityHandler,
  ZavorthPluginChannelAdapterBinding,
  ZavorthPluginMemoryBackendBinding,
  ZavorthPluginProviderBinding,
  ZavorthPluginToolBinding,
} from '../contracts/core/PluginRuntimeContract.js';

export type NormalizeResult<T> =
  | { ok: true; value: T }
  | { ok: false; finding: string };

const CHANNEL_KINDS: ZavorthPluginModuleKind[] = ['channel', 'bridge'];
const MEMORY_KINDS: ZavorthPluginModuleKind[] = ['memory'];
const PROVIDER_KINDS: ZavorthPluginModuleKind[] = ['provider'];
// Wave 0: media/voice/workspace/qa/sandbox also bind tools via specialized registrars.
const TOOL_KINDS: ZavorthPluginModuleKind[] = [
  'tool',
  'module',
  'search',
  'diagnostics',
  'media',
  'voice',
  'workspace',
  'qa',
  'sandbox',
  'bridge',
];

export function assertCapabilityDeclared(
  manifest: Pick<ZavorthPluginManifest, 'capabilities'> | null | undefined,
  capabilityId: string,
): string | null {
  const id = String(capabilityId || '').trim();
  if (!id) {
    return 'capabilityId is empty';
  }
  const declared = (manifest?.capabilities || []).some(
    (capability) => String(capability.id || '').trim() === id,
  );
  if (!declared) {
    return `capabilityId is not declared on manifest: ${id}`;
  }
  return null;
}

export function assertModuleKind(
  manifest: Pick<ZavorthPluginManifest, 'moduleKind'> | null | undefined,
  allowed: ZavorthPluginModuleKind[],
): string | null {
  const kind = manifest?.moduleKind;
  if (!kind) {
    return 'manifest.moduleKind is missing';
  }
  if (!allowed.includes(kind)) {
    return `moduleKind ${kind} is not allowed (expected: ${allowed.join(', ')})`;
  }
  return null;
}

export function normalizeChannelBinding(
  manifest: ZavorthPluginManifest | null | undefined,
  adapter: Partial<ZavorthPluginChannelAdapterBinding> | null | undefined,
): NormalizeResult<ZavorthPluginChannelAdapterBinding> {
  const moduleFinding = assertModuleKind(manifest, CHANNEL_KINDS);
  if (moduleFinding) {
    return { ok: false, finding: moduleFinding };
  }

  const id = String(adapter?.id || '').trim();
  const capabilityId = String(adapter?.capabilityId || '').trim();
  if (!id) {
    return { ok: false, finding: 'bindChannel requires id' };
  }
  if (!capabilityId) {
    return { ok: false, finding: 'bindChannel requires capabilityId' };
  }
  const capabilityFinding = assertCapabilityDeclared(manifest, capabilityId);
  if (capabilityFinding) {
    return { ok: false, finding: capabilityFinding };
  }
  if (typeof adapter?.send !== 'function' && typeof adapter?.receive !== 'function') {
    return { ok: false, finding: `bindChannel requires send or receive for ${id}` };
  }

  return {
    ok: true,
    value: {
      id,
      capabilityId,
      label: adapter?.label ? String(adapter.label) : undefined,
      send: typeof adapter?.send === 'function' ? adapter.send : undefined,
      receive: typeof adapter?.receive === 'function' ? adapter.receive : undefined,
      metadata: adapter?.metadata && typeof adapter.metadata === 'object'
        ? { ...adapter.metadata }
        : undefined,
    },
  };
}

export function normalizeMemoryBinding(
  manifest: ZavorthPluginManifest | null | undefined,
  backend: Partial<ZavorthPluginMemoryBackendBinding> | null | undefined,
): NormalizeResult<ZavorthPluginMemoryBackendBinding> {
  const moduleFinding = assertModuleKind(manifest, MEMORY_KINDS);
  if (moduleFinding) {
    return { ok: false, finding: moduleFinding };
  }

  const id = String(backend?.id || '').trim();
  const capabilityId = String(backend?.capabilityId || '').trim();
  if (!id) {
    return { ok: false, finding: 'bindMemoryBackend requires id' };
  }
  if (!capabilityId) {
    return { ok: false, finding: 'bindMemoryBackend requires capabilityId' };
  }
  const capabilityFinding = assertCapabilityDeclared(manifest, capabilityId);
  if (capabilityFinding) {
    return { ok: false, finding: capabilityFinding };
  }
  if (
    typeof backend?.read !== 'function'
    && typeof backend?.write !== 'function'
    && typeof backend?.search !== 'function'
  ) {
    return { ok: false, finding: `bindMemoryBackend requires read, write, or search for ${id}` };
  }

  return {
    ok: true,
    value: {
      id,
      capabilityId,
      label: backend?.label ? String(backend.label) : undefined,
      read: typeof backend?.read === 'function' ? backend.read : undefined,
      write: typeof backend?.write === 'function' ? backend.write : undefined,
      search: typeof backend?.search === 'function' ? backend.search : undefined,
      metadata: backend?.metadata && typeof backend.metadata === 'object'
        ? { ...backend.metadata }
        : undefined,
    },
  };
}

export function normalizeProviderBinding(
  manifest: ZavorthPluginManifest | null | undefined,
  provider: Partial<ZavorthPluginProviderBinding> | null | undefined,
): NormalizeResult<ZavorthPluginProviderBinding> {
  const moduleFinding = assertModuleKind(manifest, PROVIDER_KINDS);
  if (moduleFinding) {
    return { ok: false, finding: moduleFinding };
  }

  const id = String(provider?.id || '').trim();
  const capabilityId = String(provider?.capabilityId || '').trim();
  const name = String(provider?.name || '').trim();
  if (!id) {
    return { ok: false, finding: 'bindProvider requires id' };
  }
  if (!capabilityId) {
    return { ok: false, finding: 'bindProvider requires capabilityId' };
  }
  if (!name) {
    return { ok: false, finding: 'bindProvider requires name' };
  }
  const capabilityFinding = assertCapabilityDeclared(manifest, capabilityId);
  if (capabilityFinding) {
    return { ok: false, finding: capabilityFinding };
  }
  if (typeof provider?.complete !== 'function' && typeof provider?.embed !== 'function') {
    return { ok: false, finding: `bindProvider requires complete or embed for ${id}` };
  }

  return {
    ok: true,
    value: {
      id,
      capabilityId,
      name,
      label: provider?.label ? String(provider.label) : undefined,
      complete: typeof provider?.complete === 'function' ? provider.complete : undefined,
      embed: typeof provider?.embed === 'function' ? provider.embed : undefined,
      metadata: provider?.metadata && typeof provider.metadata === 'object'
        ? { ...provider.metadata }
        : undefined,
    },
  };
}

export function normalizeToolBinding(
  manifest: ZavorthPluginManifest | null | undefined,
  tool: Partial<ZavorthPluginToolBinding> | null | undefined,
): NormalizeResult<ZavorthPluginToolBinding> {
  const moduleFinding = assertModuleKind(manifest, TOOL_KINDS);
  if (moduleFinding) {
    return { ok: false, finding: moduleFinding };
  }

  const capabilityId = String(tool?.capabilityId || '').trim();
  if (!capabilityId) {
    return { ok: false, finding: 'bindTool requires capabilityId' };
  }
  const capabilityFinding = assertCapabilityDeclared(manifest, capabilityId);
  if (capabilityFinding) {
    return { ok: false, finding: capabilityFinding };
  }
  if (typeof tool?.handler !== 'function') {
    return { ok: false, finding: `bindTool requires handler for ${capabilityId}` };
  }

  return {
    ok: true,
    value: {
      capabilityId,
      name: tool?.name ? String(tool.name) : undefined,
      description: tool?.description ? String(tool.description) : undefined,
      handler: tool.handler as ZavorthPluginCapabilityHandler,
      parameters: tool?.parameters && typeof tool.parameters === 'object'
        ? { ...tool.parameters }
        : undefined,
    },
  };
}

export function createChannelCapabilityHandler(
  adapter: ZavorthPluginChannelAdapterBinding,
): ZavorthPluginCapabilityHandler {
  return async ({ input }) => {
    const action = String(input?.action || input?.method || '').trim().toLowerCase();
    if (action === 'receive' && adapter.receive) {
      return { output: await adapter.receive(input || {}) };
    }
    if (action === 'send' && adapter.send) {
      return { output: await adapter.send(input || {}) };
    }
    if (adapter.send) {
      return { output: await adapter.send(input || {}) };
    }
    if (adapter.receive) {
      return { output: await adapter.receive(input || {}) };
    }
    return { output: null };
  };
}

export function createMemoryCapabilityHandler(
  backend: ZavorthPluginMemoryBackendBinding,
): ZavorthPluginCapabilityHandler {
  return async ({ input }) => {
    const action = String(input?.action || input?.method || '').trim().toLowerCase();
    if (action === 'write' && backend.write) {
      return { output: await backend.write(input || {}) };
    }
    if (action === 'search' && backend.search) {
      return { output: await backend.search(input || {}) };
    }
    if (action === 'read' && backend.read) {
      return { output: await backend.read(input || {}) };
    }
    if (backend.read) {
      return { output: await backend.read(input || {}) };
    }
    if (backend.write) {
      return { output: await backend.write(input || {}) };
    }
    if (backend.search) {
      return { output: await backend.search(input || {}) };
    }
    return { output: null };
  };
}

export function createProviderCapabilityHandler(
  provider: ZavorthPluginProviderBinding,
): ZavorthPluginCapabilityHandler {
  return async ({ input }) => {
    const action = String(input?.action || input?.method || '').trim().toLowerCase();
    if (action === 'embed' && provider.embed) {
      return { output: await provider.embed(input || {}) };
    }
    if (action === 'complete' && provider.complete) {
      return { output: await provider.complete(input || {}) };
    }
    if (provider.complete) {
      return { output: await provider.complete(input || {}) };
    }
    if (provider.embed) {
      return { output: await provider.embed(input || {}) };
    }
    return { output: null };
  };
}
