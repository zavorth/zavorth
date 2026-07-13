import type {
  ZavorthPluginChannelAdapterBinding,
  ZavorthPluginCapabilityHandler,
  ZavorthPluginRuntimeHookEvent,
  ZavorthPluginSpecializedBinding,
  ZavorthPluginSpecializedKind,
} from '../contracts/core/PluginRuntimeContract.js';
import { ZAVORTH_PLUGIN_SPECIALIZED_KINDS } from '../contracts/core/PluginRuntimeContract.js';

export type SpecializedRegistrarHost = {
  bindCapability(capabilityId: string, handler: ZavorthPluginCapabilityHandler): void;
  bindChannel(adapter: ZavorthPluginChannelAdapterBinding): void;
  registerHook(
    event: ZavorthPluginRuntimeHookEvent,
    callback: (payload: {
      event: ZavorthPluginRuntimeHookEvent;
      context: Record<string, unknown>;
    }) => void | Promise<void>,
  ): void;
  findings: string[];
  specializedBindings: ZavorthPluginSpecializedBinding[];
};

const KIND_SET = new Set<string>(ZAVORTH_PLUGIN_SPECIALIZED_KINDS);

/**
 * Wave 0 — specialized register_* methods on the Plugin OS context.
 * Each maps to bindCapability / bindChannel / registerHook while recording
 * specialized kind metadata for wire plans and capability tables.
 */
export function createSpecializedRegistrars(host: SpecializedRegistrarHost) {
  const bindSpecialized = (
    expectedKind: ZavorthPluginSpecializedKind,
    binding: Partial<ZavorthPluginSpecializedBinding> | null | undefined,
  ) => {
    const kind = String(binding?.kind || expectedKind).trim() as ZavorthPluginSpecializedKind;
    const id = String(binding?.id || '').trim();
    const capabilityId = String(binding?.capabilityId || '').trim();
    if (!KIND_SET.has(kind)) {
      host.findings.push(`register* rejected unknown specialized kind: ${kind}`);
      return;
    }
    if (kind !== expectedKind) {
      host.findings.push(
        `register* kind mismatch: expected ${expectedKind}, got ${kind}`,
      );
      return;
    }
    if (!id) {
      host.findings.push(`register* (${expectedKind}) requires id`);
      return;
    }
    if (!capabilityId) {
      host.findings.push(`register* (${expectedKind}) requires capabilityId`);
      return;
    }
    if (typeof binding?.handler !== 'function') {
      host.findings.push(`register* (${expectedKind}) requires handler for ${id}`);
      return;
    }

    const normalized: ZavorthPluginSpecializedBinding = {
      kind: expectedKind,
      id,
      capabilityId,
      label: binding?.label ? String(binding.label) : undefined,
      handler: binding.handler,
      metadata: {
        ...(binding?.metadata && typeof binding.metadata === 'object' ? binding.metadata : {}),
        specializedKind: expectedKind,
      },
    };

    host.specializedBindings.push(normalized);
    host.bindCapability(capabilityId, async ({ input }) => {
      try {
        const output = await normalized.handler!(input || {});
        return { output };
      } catch (error) {
        return {
          output: {
            ok: false,
            specializedKind: expectedKind,
            id,
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
    });
  };

  return {
    registerPlatform(adapter: ZavorthPluginChannelAdapterBinding) {
      host.bindChannel(adapter);
      host.specializedBindings.push({
        kind: 'platform',
        id: String(adapter?.id || '').trim() || 'platform',
        capabilityId: String(adapter?.capabilityId || '').trim(),
        label: adapter?.label,
        metadata: { ...(adapter?.metadata || {}), specializedKind: 'platform' },
      });
    },
    registerWebSearchProvider(binding: ZavorthPluginSpecializedBinding) {
      bindSpecialized('web_search', { ...binding, kind: 'web_search' });
    },
    registerBrowserProvider(binding: ZavorthPluginSpecializedBinding) {
      bindSpecialized('browser', { ...binding, kind: 'browser' });
    },
    registerImageGenProvider(binding: ZavorthPluginSpecializedBinding) {
      bindSpecialized('image_gen', { ...binding, kind: 'image_gen' });
    },
    registerVideoGenProvider(binding: ZavorthPluginSpecializedBinding) {
      bindSpecialized('video_gen', { ...binding, kind: 'video_gen' });
    },
    registerTtsProvider(binding: ZavorthPluginSpecializedBinding) {
      bindSpecialized('tts', { ...binding, kind: 'tts' });
    },
    registerTranscriptionProvider(binding: ZavorthPluginSpecializedBinding) {
      bindSpecialized('transcription', { ...binding, kind: 'transcription' });
    },
    registerSecretSource(binding: ZavorthPluginSpecializedBinding) {
      bindSpecialized('secret_source', { ...binding, kind: 'secret_source' });
    },
    registerDashboardAuthProvider(binding: ZavorthPluginSpecializedBinding) {
      bindSpecialized('dashboard_auth', { ...binding, kind: 'dashboard_auth' });
    },
    registerContextEngine(binding: ZavorthPluginSpecializedBinding) {
      bindSpecialized('context_engine', { ...binding, kind: 'context_engine' });
    },
    registerMiddleware(
      event: ZavorthPluginRuntimeHookEvent,
      callback: (payload: {
        event: ZavorthPluginRuntimeHookEvent;
        context: Record<string, unknown>;
      }) => void | Promise<void>,
    ) {
      host.registerHook(event, callback);
      host.specializedBindings.push({
        kind: 'middleware',
        id: `middleware:${String(event || '')}`,
        capabilityId: '',
        metadata: { event: String(event || ''), specializedKind: 'middleware' },
      });
    },
    registerSkill(binding: ZavorthPluginSpecializedBinding) {
      bindSpecialized('skill', { ...binding, kind: 'skill' });
    },
    registerCliCommand(binding: ZavorthPluginSpecializedBinding) {
      bindSpecialized('cli_command', { ...binding, kind: 'cli_command' });
    },
    registerAuxiliaryTask(binding: ZavorthPluginSpecializedBinding) {
      bindSpecialized('auxiliary_task', { ...binding, kind: 'auxiliary_task' });
    },
    registerSlackActionHandler(binding: ZavorthPluginSpecializedBinding) {
      bindSpecialized('slack_action', { ...binding, kind: 'slack_action' });
    },
  };
}
