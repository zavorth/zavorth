import type { ChatMessage, ExperienceSnapshot, RuntimeCapabilitiesSnapshot, RuntimeStateActionInput } from './apiClient';
import type { RuntimeStatus } from './global';
import { modelOptions, type ModelOption } from './modelCatalog';
import type { DesktopWorkspaceScope } from './workspaceScopes';

export const fallbackStatus: RuntimeStatus = {
  ok: false,
  running: false,
  baseUrl: 'http://127.0.0.1:3000',
  tokenReady: false,
  tokenSource: 'missing',
  runtimePid: null,
  message: 'Desktop bridge unavailable.',
};

export const responseProfileByExperience: Record<string, string> = {
  personal: 'short',
  creator: 'mentor',
  developer: 'dev',
  business: 'executive',
  power: 'dev',
};

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(normalizeMessage).filter(message => message.content);
}

export function appendLocalMessage(
  setMessages: (updater: (current: ChatMessage[]) => ChatMessage[]) => void,
  role: ChatMessage['role'],
  content: string,
) {
  setMessages(current => [
    ...current,
    {
      id: `local-${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
      at: new Date().toISOString(),
    },
  ]);
}

export function desktopEffortFromRuntime(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'standard') {
    return 'medium';
  }
  if (normalized === 'ultra-code') {
    return 'ultra';
  }
  return ['low', 'medium', 'high', 'ultra'].includes(normalized) ? normalized : 'medium';
}

export function runtimeStateFromSnapshot(snapshot: ExperienceSnapshot | null): Record<string, unknown> {
  const raw = asRecord(snapshot?.raw);
  return asRecord(raw.runtimeState);
}

export function runtimeStateState(snapshot: ExperienceSnapshot | null): Record<string, unknown> {
  return asRecord(runtimeStateFromSnapshot(snapshot).state);
}

export function defaultConnectedModelIds(): string[] {
  return modelOptions.filter(model => model.connected !== false).map(model => model.id);
}

export function modelOptionsFromRuntimeCapabilities(capabilities: RuntimeCapabilitiesSnapshot | null): ModelOption[] {
  const ids = capabilities?.providers?.selectableModelIds || null;
  if (!ids) {
    return modelOptions.filter(model => model.connected !== false);
  }
  const uniqueIds = Array.from(new Set(ids.map(id => String(id || '').trim()).filter(Boolean)));
  return uniqueIds.map(id => {
    const known = modelOptions.find(model => model.id === id);
    if (known) {
      return { ...known, connected: true };
    }
    const [provider, rawModel] = id.includes(':') ? id.split(/:(.*)/s).filter(Boolean) : ['Runtime', id];
    const providerLabel = providerLabelFromId(provider);
    return {
      id,
      family: providerLabel,
      label: modelLabelFromId(rawModel || id),
      tone: 'runtime',
      connected: true,
    };
  });
}

export function applyRuntimeCapabilitiesToDesktop(input: {
  capabilities: RuntimeCapabilitiesSnapshot | null;
  setSelectedModel(value: string): void;
  setEffort(value: string): void;
  setWorkspaceScopes(updater: (current: DesktopWorkspaceScope[]) => DesktopWorkspaceScope[]): void;
  setWorkspaceScopeId(value: string): void;
}) {
  const capabilities = input.capabilities;
  if (!capabilities) {
    return;
  }
  const selectedModelId = String(capabilities.providers?.selectedModelId || '').trim();
  if (selectedModelId) {
    input.setSelectedModel(selectedModelId);
  }
  if (capabilities.modelSpecs?.selectedEffort) {
    input.setEffort(desktopEffortFromRuntime(capabilities.modelSpecs.selectedEffort));
  }
  const workspace = capabilities.workspace;
  const workspaceId = String(workspace?.id || '').trim();
  if (workspaceId) {
    const scope: DesktopWorkspaceScope = {
      id: workspaceId,
      label: String(workspace?.label || workspaceId),
      shortLabel: String(workspace?.label || workspaceId),
      kind: workspace?.path ? 'folder' : 'chat',
      path: workspace?.path ? String(workspace.path) : null,
    };
    input.setWorkspaceScopes(current => current.some(item => item.id === scope.id) ? current : [...current, scope]);
    input.setWorkspaceScopeId(workspaceId);
  }
}

export function runtimeInstrumentActionInput(input: {
  domain: string;
  operation: string;
  metadata?: Record<string, unknown>;
}): Pick<RuntimeStateActionInput, 'type' | 'payload'> {
  const metadata = input.metadata || {};
  const runtimeActionType = String(metadata.runtimeActionType || '').trim();
  if (runtimeActionType === 'set-permission') {
    return {
      type: 'set-permission',
      payload: {
        permission: metadata.permission,
        metadata: {
          requestedFrom: 'desktop-settings',
          ...metadata,
        },
      },
    };
  }
  if (runtimeActionType === 'set-mcp-trust') {
    return {
      type: 'set-mcp-trust',
      payload: {
        mcpTrust: metadata.mcpTrust,
        metadata: {
          requestedFrom: 'desktop-settings',
          ...metadata,
        },
      },
    };
  }
  if (runtimeActionType === 'set-provider-connection') {
    return {
      type: 'set-provider-connection',
      payload: {
        providerConnection: metadata.providerConnection,
        metadata: {
          requestedFrom: 'desktop-settings',
          ...metadata,
        },
      },
    };
  }
  if (runtimeActionType === 'select-model-spec') {
    return {
      type: 'select-model-spec',
      payload: {
        modelSpec: metadata.modelSpec,
        metadata: {
          requestedFrom: 'desktop-settings',
          ...metadata,
        },
      },
    };
  }
  if (runtimeActionType === 'route-model') {
    return {
      type: 'route-model',
      payload: {
        dynamicRouting: metadata.dynamicRouting,
        model: metadata.model,
        metadata: {
          requestedFrom: 'desktop-settings',
          ...metadata,
        },
      },
    };
  }
  if (runtimeActionType === 'set-workspace-knowledge') {
    return {
      type: 'set-workspace-knowledge',
      payload: {
        workspaceKnowledge: metadata.workspaceKnowledge,
        metadata: {
          requestedFrom: 'desktop-settings',
          ...metadata,
        },
      },
    };
  }
  if (runtimeActionType === 'register-personal-connector') {
    return {
      type: 'register-personal-connector',
      payload: {
        personalConnector: metadata.personalConnector,
        metadata: {
          requestedFrom: 'desktop-settings',
          ...metadata,
        },
      },
    };
  }
  if (runtimeActionType === 'recover-scheduled-jobs') {
    return {
      type: 'recover-scheduled-jobs',
      payload: {
        scheduledJobs: metadata.scheduledJobs || {},
        metadata: {
          requestedFrom: 'desktop-settings',
          ...metadata,
        },
      },
    };
  }
  if (runtimeActionType === 'resume-stream') {
    return {
      type: 'resume-stream',
      payload: {
        streamSession: metadata.streamSession,
        metadata: {
          requestedFrom: 'desktop-settings',
          ...metadata,
        },
      },
    };
  }
  if (runtimeActionType === 'skill-lifecycle') {
    return {
      type: 'skill-lifecycle',
      payload: {
        skill: metadata.skill,
        metadata: {
          requestedFrom: 'desktop-settings',
          ...metadata,
        },
      },
    };
  }
  return {
    type: 'operate-domain',
    payload: {
      domain: {
        domain: input.domain,
        operation: input.operation,
      },
      metadata: {
        requestedFrom: 'desktop-statusbar',
        ...metadata,
      },
    },
  };
}

function normalizeMessage(raw: unknown, index: number): ChatMessage {
  const record = asRecord(raw);
  const role = String(record.role || record.kind || 'assistant');
  const normalizedRole: ChatMessage['role'] = role === 'user' || role === 'system' || role === 'tool'
    ? role
    : 'assistant';
  const content = String(record.content || record.text || record.message || record.markdown || '').trim();
  return {
    id: String(record.id || record.messageId || `message-${index}-${Date.now()}`),
    role: normalizedRole,
    content: content || '(empty message)',
    at: String(record.at || record.createdAt || record.generatedAt || new Date().toISOString()),
    title: typeof record.title === 'string' ? record.title : undefined,
  };
}

function providerLabelFromId(value: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) return 'Runtime';
  return normalized
    .split(/[-_ ]+/)
    .map(part => part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : '')
    .join(' ');
}

function modelLabelFromId(value: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) return 'Runtime model';
  return normalized
    .replace(/[-_]+/g, ' ')
    .replace(/\bgpt\b/i, 'GPT')
    .replace(/\b([a-z])/g, match => match.toUpperCase());
}
