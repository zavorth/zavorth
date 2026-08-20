import { useState } from 'react';
import type {
  GatewayResilienceSnapshot,
  RuntimeCapabilitiesSnapshot,
} from '../../apiClient';
import { connectGooglePersonalOps } from '../../apiClient';

import type { BootEvent, RuntimeStatus } from '../../global';
import { asRecord, effortLabels, panelLabels, profileLabels } from '../../primitives/desktopPrimitives';
import { ProviderSettingsPanel } from '../../panels/ProviderSettingsPanel.js';
import { InternalBetaDiagnosticsPanel } from '../../panels/InternalBetaDiagnosticsPanel.js';
import { ProviderDashboard } from '../../components/ProviderDashboard.js';
import { isCompletionSoundEnabled, setCompletionSoundEnabled } from '../../lib/haptics';
import { isTelemetryOptIn, setTelemetryOptIn } from '../../desktop-state/localTelemetry';
import { readinessFromProvider } from '../../desktop-state/readiness';
import type { DesktopUpdateStatus } from '../../desktop-state/desktopUpdate';
import { UpdateControlPanel } from '../../components/UpdateControlPanel';
import { DetailRows, PageFrame, TextTabs } from '../panelChrome';
import { asErrorLike } from '../../lib/errors';

export function SettingsView(props: {
  accent: 'green' | 'orange' | 'purple' | 'navy';
  density?: 'comfortable' | 'compact';
  busy: boolean;
  effort: string;
  events: BootEvent[];
  nexusStatus: unknown;
  profile: string;
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  gatewayResilience: GatewayResilienceSnapshot | null;
  status: RuntimeStatus;
  approvalsCount: number;
  theme: 'light' | 'dark' | 'system';
  updateStatusMessage?: string | null;
  updateStatus?: DesktopUpdateStatus | null;
  voiceAgentStatus?: {
    running: boolean;
    message: string;
    hotkey: string;
    wakeWord: string | null;
    mode: string;
  } | null;
  workboardSyncLabel?: string | null;
  workboardSyncDetail?: string | null;
  workboardSyncBusy?: boolean;
  onSyncWorkboard?: (boardId?: string) => void | Promise<boolean | void>;
  onAccent(value: 'green' | 'orange' | 'purple' | 'navy'): void;
  onDensity?(value: 'comfortable' | 'compact'): void;
  onEffort(value: string): void;
  onProfile(value: string): void;
  onRepair(): void | Promise<void>;
  onGatewayResilienceAction(input: Record<string, unknown>): void | Promise<void>;
  onStart(): void | Promise<void>;
  onRuntimeStateAction(input: { domain: string; operation: string; metadata?: Record<string, unknown> }): void | Promise<void>;
  onTheme(value: 'light' | 'dark' | 'system'): void;
  onCheckUpdates?: () => void | Promise<void>;
  onDownloadUpdate?: () => void | Promise<void>;
  onInstallUpdate?: () => void | Promise<void>;
  onDeferUpdate?: () => void | Promise<void>;
  onRollbackUpdate?: () => void | Promise<void>;
  onOpenGithub?: () => void | Promise<void>;
  onOpenSetup?: () => void | Promise<void>;
  onOpenLogs?: () => void | Promise<void>;
  onStartVoiceAgent?: () => void | Promise<void>;
  onRefreshVoiceAgent?: () => void | Promise<void>;
}) {
  const [runtimeMode, setRuntimeMode] = useState<'overview' | 'gateway' | 'permissions' | 'providers' | 'workspace' | 'mcp' | 'skills' | 'jobs' | 'personal' | 'diagnostics'>('overview');
  const [personalConnectStatus, setPersonalConnectStatus] = useState<string | null>(null);
  const [soundsEnabled, setSoundsEnabled] = useState(() => isCompletionSoundEnabled());
  const [telemetryEnabled, setTelemetryEnabled] = useState(() => isTelemetryOptIn());
  const connectGoogle = async () => {
    setPersonalConnectStatus('Opening Google authorization...');
    try {
      const result = await connectGooglePersonalOps();
      if (!result.ok) {
        setPersonalConnectStatus(result.error || 'Google authorization did not complete.');
        return;
      }
      setPersonalConnectStatus(result.accountEmail ? `Connected ${result.accountEmail}.`
        : 'Google account connected.');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      setPersonalConnectStatus(error instanceof Error ? err.message : 'Google authorization failed.');
    }
  };
  const experienceRows = [
    {
      id: 'experience-profile',
      title: 'Experience profile',
      description: 'Controls tone, detail, and the kind of help Zavorth suggests first.',
      meta: props.profile,
      tone: 'muted' as const,
      actions: (
        <select className="zvd-inline-select" value={props.profile} onChange={event => props.onProfile(event.target.value)} aria-label="Experience profile">
          {profileLabels.map(profile => (
            <option key={profile} value={profile}>{profile}</option>
          ))}
        </select>
      ),
    },
    {
      id: 'reasoning-effort',
      title: 'Reasoning effort',
      description: 'Balances speed and depth for everyday chat and guided work.',
      meta: props.effort,
      tone: 'muted' as const,
      actions: (
        <select className="zvd-inline-select" value={props.effort} onChange={event => props.onEffort(event.target.value)} aria-label="Reasoning effort">
          {effortLabels.map(effort => (
            <option key={effort} value={effort}>{effort}</option>
          ))}
        </select>
      ),
    },
    {
      id: 'appearance',
      title: 'Appearance',
      description: 'Keeps the desktop comfortable across dark rooms, bright rooms, and system theme changes.',
      meta: props.theme,
      tone: 'muted' as const,
      actions: (
        <select
          className="zvd-inline-select"
          value={props.theme}
          onChange={event => props.onTheme(event.target.value as 'light' | 'dark' | 'system')}
          aria-label="Theme"
        >
          <option value="system">system</option>
          <option value="light">light</option>
          <option value="dark">dark</option>
        </select>
      ),
    },
    {
      id: 'accent',
      title: 'Accent color',
      description: 'Official brand green by default. Orange, purple, and navy stay available as secondary accents.',
      meta: props.accent,
      tone: 'muted' as const,
      actions: (
        <select
          className="zvd-inline-select"
          value={props.accent}
          onChange={event => props.onAccent(event.target.value as 'green' | 'orange' | 'purple' | 'navy')}
          aria-label="Accent color"
        >
          <option value="green">green (brand)</option>
          <option value="orange">orange</option>
          <option value="purple">purple</option>
          <option value="navy">dark blue</option>
        </select>
      ),
    },
    {
      id: 'density',
      title: 'Density',
      description: 'Comfortable for daily use, compact for power users and smaller screens.',
      meta: props.density || 'comfortable',
      tone: 'muted' as const,
      actions: (
        <select
          className="zvd-inline-select"
          value={props.density || 'comfortable'}
          onChange={event => props.onDensity?.(event.target.value as 'comfortable' | 'compact')}
          aria-label="UI density"
          disabled={!props.onDensity}
        >
          <option value="comfortable">comfortable</option>
          <option value="compact">compact</option>
        </select>
      ),
    },
    {
      id: 'completion-sounds',
      title: 'Completion sounds',
      description: 'Play a short sound when a response finishes.',
      meta: soundsEnabled ? 'on' : 'off',
      tone: 'muted' as const,
      actions: (
        <select
          className="zvd-inline-select"
          value={soundsEnabled ? 'on' : 'off'}
          onChange={event => {
            const enabled = event.target.value === 'on';
            setSoundsEnabled(enabled);
            setCompletionSoundEnabled(enabled);
          }}
          aria-label="Completion sounds"
        >
          <option value="on">on</option>
          <option value="off">off</option>
        </select>
      ),
    },
    {
      id: 'telemetry',
      title: 'local UX telemetry',
      description: 'Opt-in, local-only events (panel opens, runtime online/offline). Never stores prompts or secrets.',
      meta: telemetryEnabled ? 'on' : 'off',
      tone: 'muted' as const,
      actions: (
        <select
          className="zvd-inline-select"
          value={telemetryEnabled ? 'on' : 'off'}
          onChange={event => {
            const enabled = event.target.value === 'on';
            setTelemetryEnabled(enabled);
            setTelemetryOptIn(enabled);
          }}
          aria-label="local UX telemetry"
        >
          <option value="on">on</option>
          <option value="off">off</option>
        </select>
      ),
    },
    {
      id: 'voice-companion',
      title: 'Voice companion',
      description: [
        props.voiceAgentStatus?.message
          || 'Desktop dictation uses Web Speech. Optional companion enables tray/wake-word process when available.',
        props.voiceAgentStatus?.hotkey ? `Hotkey: ${props.voiceAgentStatus.hotkey}` : 'Hotkey: Ctrl+Shift+Space',
        props.voiceAgentStatus?.wakeWord ? `Wake word (companion): ${props.voiceAgentStatus.wakeWord}` : null,
      ].filter(Boolean).join(' · '),
      meta: props.voiceAgentStatus?.running ? 'companion running' : (props.voiceAgentStatus?.mode || 'desktop-dictation'),
      tone: props.voiceAgentStatus?.running ? 'ready' as const : 'muted' as const,
      actions: (
        <div className="zvd-row-actions">
          {props.onStartVoiceAgent && (
            <button type="button" disabled={props.busy} onClick={() => void props.onStartVoiceAgent?.()}>
              Start companion
            </button>
          )}
          {props.onRefreshVoiceAgent && (
            <button type="button" onClick={() => void props.onRefreshVoiceAgent?.()}>
              Refresh status
            </button>
          )}
        </div>
      ),
    },
    {
      id: 'workboard-sync',
      title: 'Workboard sync',
      description: props.workboardSyncDetail || 'local-first board with optional runtime projection/push.',
      meta: props.workboardSyncLabel || 'local',
      tone: props.workboardSyncLabel?.toLowerCase().includes('hybrid') || props.workboardSyncLabel?.toLowerCase().includes('push') ? 'ready' as const
        : props.workboardSyncLabel?.toLowerCase().includes('failed') ? 'warning' as const
          : 'muted' as const,
      actions: props.onSyncWorkboard ? (
        <button
          type="button"
          disabled={props.busy || props.workboardSyncBusy}
          onClick={() => void props.onSyncWorkboard?.()}
        >
          {props.workboardSyncBusy ? 'Syncing…' : 'Sync now'}
        </button>
      ) : undefined,
    },
  ];

  const capabilities = props.runtimeCapabilities;
  const capabilitySummary = capabilities?.capabilities?.summary;
  const selectedSpec = capabilities?.modelSpecs?.specs?.find(spec => spec.id === capabilities.modelSpecs?.selectedSpecId);
  const connectedProviders = capabilities?.providers?.connected || [];
  const configurableProviders = capabilities?.providers?.configurable || [];
  const blockedProviders = capabilities?.providers?.blocked || [];
  const providerConnections = capabilities?.providers?.all || [...connectedProviders, ...configurableProviders, ...blockedProviders];
  const providerCount = connectedProviders.length;
  const workspaceKnowledge = capabilities?.workspaceKnowledge;
  const mcpReviewCount = (capabilities?.mcpTrust?.servers || []).filter(server => server.trustState !== 'trusted').length;
  const configuredPersonalOps = (capabilities?.personalOps?.connectors || []).filter(connector => connector.status === 'configured').length;
  const permissionRows = Object.entries(capabilities?.permissions?.domains || {}).flatMap(([domain, policy]) =>
    Object.entries(policy.actions || {}).map(([action, rule]) => ({
      id: `permission-${domain}-${action}`,
      title: `${policy.label || domain}: ${action}`,
      description: rule.reason || 'Governed permission from runtime matrix.',
      meta: `${rule.default || 'review'}${rule.requiresApproval ? ' + approval' : ''}`,
      tone: rule.default === 'block' ? 'danger' as const : rule.requiresApproval ? 'warning' as const : 'ready' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'gateway',
              operation: 'set-permission',
              metadata: {
                runtimeActionType: 'set-permission',
                permission: {
                  domain,
                  action,
                  decision: rule.default || 'approval',
                  requiresApproval: rule.requiresApproval !== false,
                  scope: rule.scope || 'runtime',
                  reason: rule.reason || 'Operator reviewed permission from desktop.',
                },
              },
            })}
            type="button"
          >
            Receipt
          </button>
        </div>
      ),
    })),
  );
  const modelSpecRows = (capabilities?.modelSpecs?.specs || []).map(spec => ({
    id: `model-spec-${spec.id || spec.label}`,
    title: spec.label || spec.id || 'Model spec',
    description: `${spec.summary || 'Runtime model preset.'} Preferred: ${(spec.preferredModelIds || []).join(', ') || 'runtime choice'}.`,
    meta: spec.id === capabilities?.modelSpecs?.selectedSpecId ? 'selected' : spec.maxEffort || spec.estimatedCost || 'available',
    tone: spec.id === capabilities?.modelSpecs?.selectedSpecId ? 'ready' as const : 'muted' as const,
    actions: (
      <div className="zvd-row-actions">
        <button
          disabled={props.busy || spec.id === capabilities?.modelSpecs?.selectedSpecId}
          onClick={() => void props.onRuntimeStateAction({
            domain: 'model',
            operation: 'select-spec',
            metadata: {
              runtimeActionType: 'select-model-spec',
              modelSpec: { id: spec.id },
            },
          })}
          type="button"
        >
          Select
        </button>
      </div>
    ),
  }));
  const providerRows = [
    ...modelSpecRows,
    ...providerConnections.map(provider => {
      const badge = readinessFromProvider({
        status: provider.status,
        connected: provider.status === 'configured' || provider.status === 'connected',
        ready: provider.status === 'configured' && !provider.blockReason,
        reason: provider.blockReason || (provider.status === 'configured'
          ? 'Configured — still not the same as a live model call receipt.'
          : undefined),
      });
      return {
      id: `provider-${provider.id || provider.label}`,
      title: provider.label || provider.id || 'Provider',
      description: provider.targetHost
        ? `Target: ${provider.targetHost}; loopback=${provider.localLoopback ? 'yes' : 'no'}; default route=${provider.defaultRouteAllowed ? 'yes' : 'no'}. ${badge.detail || ''}`
        : provider.blockReason || badge.detail || 'Setup is governed and does not run hidden live probes.',
      meta: badge.label,
      tone: badge.tone,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'gateway',
              operation: provider.status === 'configured' ? 'provider-receipt' : 'setup-provider',
              metadata: {
                runtimeActionType: 'set-provider-connection',
                providerConnection: {
                  providerId: provider.id,
                  label: provider.label,
                  status: provider.status || 'needs-setup',
                  targetHost: provider.targetHost || null,
                  blockReason: provider.blockReason || null,
                },
              },
            })}
            type="button"
          >
            {provider.status === 'configured' ? 'Receipt' : 'Setup'}
          </button>
        </div>
      ),
    };
    }),
  ];
  const workspaceRows = [
    {
      id: 'workspace-active',
      title: workspaceKnowledge?.activeWorkspaceLabel || capabilities?.workspace?.label || 'Chat',
      description: capabilities?.workspace?.path ? `Filesystem scope is confined to ${capabilities.workspace.path}.`
        : 'Chat mode keeps filesystem and shell out of scope.',
      meta: workspaceKnowledge?.isolation || capabilities?.workspace?.isolation || 'chat',
      tone: capabilities?.workspace?.path ? 'ready' as const : 'muted' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'context',
              operation: 'scope-knowledge',
              metadata: {
                runtimeActionType: 'set-workspace-knowledge',
                workspaceKnowledge: {
                  workspaceId: workspaceKnowledge?.workspaceId || capabilities?.workspace?.id || 'chat',
                  activeWorkspaceLabel: workspaceKnowledge?.activeWorkspaceLabel || capabilities?.workspace?.label || 'Chat',
                  isolation: workspaceKnowledge?.isolation || capabilities?.workspace?.isolation || 'chat',
                  trustedWorkspaceIds: workspaceKnowledge?.trustedWorkspaceIds || [],
                  allowedPaths: workspaceKnowledge?.allowedPaths || (capabilities?.workspace?.path ? [capabilities.workspace.path] : []),
                  ragSources: workspaceKnowledge?.ragSources || [],
                },
              },
            })}
            type="button"
          >
            Receipt
          </button>
        </div>
      ),
    },
    ...(workspaceKnowledge?.allowedPaths || []).map((allowedPath, index) => ({
      id: `workspace-path-${index}`,
      title: allowedPath,
      description: 'Approved filesystem, shell, RAG and skill scope path.',
      meta: 'allowed path',
      tone: 'ready' as const,
    })),
    ...(workspaceKnowledge?.ragSources || []).map(source => ({
      id: `rag-source-${source.id || source.label}`,
      title: source.label || source.id || 'Knowledge source',
      description: `${source.kind || 'source'} context is ${source.trusted ? 'trusted' : 'wrapped as untrusted'} before the model sees it.`,
      meta: source.trusted ? 'trusted' : 'untrusted',
      tone: source.trusted ? 'ready' as const : 'warning' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'context',
              operation: 'scope-knowledge',
              metadata: {
                runtimeActionType: 'set-workspace-knowledge',
                workspaceKnowledge: {
                  workspaceId: workspaceKnowledge?.workspaceId || capabilities?.workspace?.id || 'chat',
                  activeWorkspaceLabel: workspaceKnowledge?.activeWorkspaceLabel || capabilities?.workspace?.label || 'Chat',
                  isolation: workspaceKnowledge?.isolation || capabilities?.workspace?.isolation || 'chat',
                  trustedWorkspaceIds: workspaceKnowledge?.trustedWorkspaceIds || [],
                  allowedPaths: workspaceKnowledge?.allowedPaths || [],
                  ragSources: (workspaceKnowledge?.ragSources || []).map(candidate => (
                    candidate.id === source.id ? { ...candidate, trusted: true } : candidate
                  )),
                },
              },
            })}
            type="button"
          >
            Trust source
          </button>
        </div>
      ),
    })),
  ];
  const mcpRows = (capabilities?.mcpTrust?.servers || []).map(server => ({
    id: `mcp-${server.id || server.label}`,
    title: server.label || server.id || 'MCP server',
    description: `${server.toolNames?.length || 0} tool(s); network=${server.networkAccess || 'blocked'}; exposed=${server.exposedToModel ? 'yes' : 'no'}.`,
    meta: `${server.trustState || 'review'} / ${server.risk || 'risk unknown'}`,
    tone: server.trustState === 'trusted' ? 'ready' as const : server.trustState === 'blocked' ? 'danger' as const : 'warning' as const,
    actions: (
      <div className="zvd-row-actions">
        <button
          disabled={props.busy || server.trustState === 'trusted'}
          onClick={() => void props.onRuntimeStateAction({
            domain: 'skills',
            operation: 'trust-mcp',
            metadata: {
              runtimeActionType: 'set-mcp-trust',
              mcpTrust: {
                id: server.id,
                label: server.label,
                origin: server.origin || 'desktop',
                trustState: 'trusted',
                toolNames: server.toolNames || [],
              },
            },
          })}
          type="button"
        >
          Trust
        </button>
        <button
          disabled={props.busy || server.trustState === 'blocked'}
          onClick={() => void props.onRuntimeStateAction({
            domain: 'skills',
            operation: 'block-mcp',
            metadata: {
              runtimeActionType: 'set-mcp-trust',
              mcpTrust: {
                id: server.id,
                label: server.label,
                origin: server.origin || 'desktop',
                trustState: 'blocked',
                toolNames: server.toolNames || [],
              },
            },
          })}
          type="button"
        >
          Block
        </button>
      </div>
    ),
  }));
  const skillHistoryRows = (capabilities?.skillHistory?.entries || []).map(entry => ({
    id: `skill-history-${entry.id || entry.skillName}`,
    title: entry.skillName || entry.skillId || 'Skill',
    description: `Mode: ${entry.mode || 'recorded'}; source: ${entry.source || 'runtime'}.`,
    meta: entry.receiptId || entry.at || 'receipt-backed',
    tone: entry.mode === 'blocked' ? 'danger' as const : entry.mode === 'auto-selected' ? 'ready' as const : 'muted' as const,
    actions: (
      <div className="zvd-row-actions">
        <button
          disabled={props.busy}
          onClick={() => void props.onRuntimeStateAction({
            domain: 'skills',
            operation: 'execute-skill',
            metadata: {
              runtimeActionType: 'skill-lifecycle',
              skill: {
                id: entry.skillId || entry.id,
                name: entry.skillName || entry.skillId || 'Skill',
                source: entry.source || 'native',
                status: 'executing',
                lastReceiptId: entry.receiptId || null,
              },
            },
          })}
          type="button"
        >
          Execute
        </button>
      </div>
    ),
  }));
  const skillRows = skillHistoryRows.length > 0 ? skillHistoryRows : [
    {
      id: 'skill-router-default',
      title: 'Skill router',
      description: 'Natural routing can preview the best native skill before execution.',
      meta: 'approval-first',
      tone: 'muted' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'skills',
              operation: 'preview-skill',
              metadata: {
                runtimeActionType: 'skill-lifecycle',
                skill: {
                  id: 'native:skill-router',
                  name: 'Skill router',
                  source: 'native',
                  status: 'preview',
                },
              },
            })}
            type="button"
          >
            Preview route
          </button>
        </div>
      ),
    },
  ];
  const projectedPersonalRows = (capabilities?.personalOps?.connectors || []).map(connector => {
    const operations = connector.operations || [];
    const operationSummary = operations.length > 0
      ? operations.map(operation => `${operation.label || operation.id}${operation.enabled ? '' : ' (setup)'}`).join(', ')
      : `${connector.kind || 'connector'} actions wait for account setup`;
    return {
      id: `personal-${connector.id || connector.label}`,
      title: connector.label || connector.id || 'Personal connector',
      description: `${operationSummary}. Every personal operation requires approval and redacted receipts.`,
      meta: connector.enabled ? 'enabled / approval-required' : connector.status || 'disabled',
      tone: connector.enabled ? 'warning' as const : connector.status === 'configured' ? 'ready' as const : 'muted' as const,
      actions: (
        <div className="zvd-row-actions">
          {connector.status !== 'configured' ? (
            <button
              disabled={props.busy}
              onClick={() => void connectGoogle()}
              type="button"
            >
              Connect Google
            </button>
          ) : null}
          <button
            disabled={props.busy || connector.status === 'disabled'}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'context',
              operation: 'disable-personal-connector',
              metadata: {
                runtimeActionType: 'register-personal-connector',
                personalConnector: {
                  id: connector.id,
                  kind: connector.kind || 'email',
                  label: connector.label || connector.id,
                  status: 'disabled',
                  configured: false,
                  enabled: false,
                },
              },
            })}
            type="button"
          >
            Disable
          </button>
        </div>
      ),
    };
  });
  const personalRows = projectedPersonalRows.length > 0 ? projectedPersonalRows : [
    {
      id: 'personal-google-setup',
      title: 'Google Personal Ops',
      description: personalConnectStatus || 'Connect Gmail, Google Calendar, and Google Tasks through the governed desktop OAuth flow. Every operation still requires approval and redacted receipts.',
      meta: 'not connected',
      tone: 'muted' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy}
            onClick={() => void connectGoogle()}
            type="button"
          >
            Connect Google
          </button>
        </div>
      ),
    },
  ];
  const jobRows = [
    {
      id: 'runtime-jobs',
      title: 'Scheduled jobs',
      description: capabilities?.jobs?.summary || 'Scheduler recovery state is not projected yet.',
      meta: capabilities?.jobs?.status || 'unknown',
      tone: capabilities?.jobs?.status === 'attention' ? 'warning' as const : capabilities?.jobs ? 'ready' as const : 'muted' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'cron',
              operation: 'recover',
              metadata: {
                runtimeActionType: 'recover-scheduled-jobs',
                scheduledJobs: {
                  recoverable: capabilities?.jobs?.status === 'attention' ? 1 : 0,
                },
              },
            })}
            type="button"
          >
            Recover
          </button>
        </div>
      ),
    },
    {
      id: 'runtime-stream',
      title: 'Stream session',
      description: capabilities?.streamSession?.resumeToken ? `Resume token: ${capabilities.streamSession.resumeToken}`
        : 'No resumable stream token is active.',
      meta: capabilities?.streamSession?.status || 'idle',
      tone: capabilities?.streamSession?.resumable ? 'ready' as const : 'muted' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy || !capabilities?.streamSession?.resumeToken}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'session',
              operation: 'resume-stream',
              metadata: {
                runtimeActionType: 'resume-stream',
                streamSession: {
                  sessionId: capabilities?.streamSession?.resumeToken ? 'desktop-main' : null,
                  status: capabilities?.streamSession?.resumeToken ? 'streaming' : 'idle',
                  resumeToken: capabilities?.streamSession?.resumeToken || null,
                },
              },
            })}
            type="button"
          >
            Resume
          </button>
        </div>
      ),
    },
  ];
  const runtimeCapabilityRows = [
    {
      id: 'runtime-capabilities',
      title: 'Runtime capabilities',
      description: capabilitySummary ? `${capabilitySummary.available || 0} available, ${capabilitySummary.configurable || 0} configurable, ${capabilitySummary.blocked || 0} blocked.`
        : 'Capabilities API is unavailable.',
      meta: capabilities?.contractVersion || 'offline',
      tone: capabilities ? 'ready' as const : 'warning' as const,
    },
    {
      id: 'runtime-model-spec',
      title: 'Model spec',
      description: selectedSpec?.summary || capabilities?.providers?.routingReason || 'Model specs are loaded from runtime state.',
      meta: selectedSpec?.label || capabilities?.modelSpecs?.selectedSpecId || 'daily',
      tone: capabilities ? 'ready' as const : 'muted' as const,
    },
    {
      id: 'runtime-providers',
      title: 'Connected providers',
      description: providerCount > 0
        ? `${providerCount} provider connection(s) configured without exposing secrets.`
        : 'No configured provider connections are projected yet.',
      meta: `${capabilities?.providers?.selectableModelIds?.length || 0} models`,
      tone: providerCount > 0 ? 'ready' as const : 'muted' as const,
    },
    {
      id: 'runtime-trust',
      title: 'MCP and personal ops trust',
      description: `${mcpReviewCount} MCP server(s) need trust review; ${configuredPersonalOps} personal connector(s) configured but still governed.`,
      meta: 'approval-first',
      tone: mcpReviewCount > 0 || configuredPersonalOps > 0 ? 'warning' as const : 'muted' as const,
    },
  ];
  const gatewayPolicy = props.gatewayResilience?.policy || {};
  const gatewayBudget = props.gatewayResilience?.budget || {};
  const gatewayHealth = props.gatewayResilience?.health || {};
  const gatewayFallbackOrder = Array.isArray(gatewayPolicy.fallbackOrder) ? gatewayPolicy.fallbackOrder : [];
  const gatewayReceipts = Array.isArray(props.gatewayResilience?.receipts) ? props.gatewayResilience.receipts : [];
  const gatewayRows = [
    {
      id: 'gateway-primary-route',
      title: 'Primary route',
      description: `${String(gatewayPolicy.primaryProviderId || 'auto')}${gatewayPolicy.primaryModelId ? ` / ${gatewayPolicy.primaryModelId}` : ''}`,
      meta: String(gatewayHealth.status || 'unknown'),
      tone: props.gatewayResilience?.ok === false ? 'warning' as const : 'ready' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy}
            onClick={() => void props.onGatewayResilienceAction({ action: 'testRoute', workspaceId: 'zavorth-desktop' })}
            type="button"
          >
            Test Route
          </button>
        </div>
      ),
    },
    {
      id: 'gateway-fallback-order',
      title: 'Fallback order',
      description: gatewayFallbackOrder.length > 0
        ? gatewayFallbackOrder.map((target) => {
            const row = target && typeof target === 'object' ? target as Record<string, unknown> : {};
            const providerId = String(row.providerId || 'provider');
            const modelId = row.modelId ? String(row.modelId) : '';
            return modelId ? `${providerId}:${modelId}` : providerId;
          }).join(' -> ')
        : 'Fallback order is not configured yet.',
      meta: `${gatewayFallbackOrder.length} fallback(s)`,
      tone: gatewayFallbackOrder.length > 0 ? 'ready' as const : 'muted' as const,
    },
    {
      id: 'gateway-budget',
      title: 'Daily budget',
      description: String(gatewayBudget.reason || 'No budget block is active.'),
      meta: String(gatewayBudget.decision || 'allowed'),
      tone: gatewayBudget.decision === 'blocked' ? 'danger' as const : 'ready' as const,
    },
    ...gatewayReceipts.slice(0, 4).map((receipt, index) => {
      const row = receipt && typeof receipt === 'object' ? receipt as Record<string, unknown> : {};
      return {
        id: String(row.receiptId || `gateway-receipt-${index}`),
        title: row.fallbackUsed ? 'Fallback used' : 'Route tested',
        description: String(row.receiptId || 'Routing receipt stored.'),
        meta: String(row.budgetDecision || 'allowed'),
        tone: row.fallbackUsed ? 'warning' as const : 'muted' as const,
      };
    }),
  ];

  const runtimeRows = [
    {
      id: 'runtime',
      title: props.status.running ? 'Runtime reachable' : 'Runtime not reachable',
      description: props.status.message || props.status.baseUrl,
      meta: props.status.baseUrl,
      tone: props.status.running ? 'ready' as const : 'warning' as const,
      actions: (
        <div className="zvd-row-actions">
          <button disabled={props.busy} onClick={() => void props.onStart()} type="button">Start</button>
          <button disabled={props.busy} onClick={() => void props.onRepair()} type="button">Repair</button>
          <button disabled={!window.zavorthDesktop} onClick={() => void window.zavorthDesktop?.openLogs()} type="button">Logs</button>
        </div>
      ),
    },
    {
      id: 'nexus',
      title: 'Nexus',
      description: props.nexusStatus ? JSON.stringify(props.nexusStatus).slice(0, 220) : 'Status unavailable.',
      meta: 'local',
      tone: props.nexusStatus ? 'ready' as const : 'muted' as const,
    },
    ...runtimeCapabilityRows,
    ...props.events.map(event => ({
      id: `${event.at}-${event.message}`,
      title: event.message,
      description: event.type,
      meta: new Date(event.at).toLocaleTimeString(),
      tone: event.type === 'error' ? 'danger' as const : 'muted' as const,
    })),
  ];
  const runtimeRowsForMode = runtimeMode === 'permissions'
    ? [...providerRows, ...permissionRows]
    : runtimeMode === 'gateway'
      ? gatewayRows
      : runtimeMode === 'providers'
        ? providerRows
        : runtimeMode === 'workspace'
          ? workspaceRows
          : runtimeMode === 'mcp'
            ? mcpRows
            : runtimeMode === 'skills'
              ? skillRows
              : runtimeMode === 'jobs'
                ? jobRows
                : runtimeMode === 'personal'
                  ? personalRows
                  : runtimeRows;

  return (
    <PageFrame
      description="Experience preferences, local runtime, access repair, logs, and recent desktop events."
      meta={props.status.running ? 'ready' : 'offline'}
      title={panelLabels.settings}
    >
      <div className="zvd-settings-sections">
        <section className="zvd-settings-section" aria-label="Install and updates">
          <UpdateControlPanel
            status={props.updateStatus || null}
            busy={props.busy}
            onCheck={() => void props.onCheckUpdates?.()}
            onDownload={props.onDownloadUpdate}
            onInstall={props.onInstallUpdate}
            onDefer={props.onDeferUpdate}
            onRollback={props.onRollbackUpdate}
            onOpenGithub={props.onOpenGithub}
            onOpenSetup={props.onOpenSetup}
          />
        </section>
        <section className="zvd-settings-section" aria-label="Experience">
          <h2>Experience</h2>
          <DetailRows rows={experienceRows} empty="No experience settings are available." />
        </section>
        <section className="zvd-settings-section" aria-label="Runtime">
          <h2>Runtime</h2>
          <TextTabs<typeof runtimeMode>
            value={runtimeMode}
            onChange={setRuntimeMode}
            items={[
              { value: 'overview', label: 'Overview' },
              { value: 'gateway', label: 'Gateway', count: gatewayRows.length },
              { value: 'permissions', label: 'Permissions', count: providerRows.length + permissionRows.length },
              { value: 'providers', label: 'Providers', count: providerRows.length },
              { value: 'workspace', label: 'Workspace', count: workspaceRows.length },
              { value: 'mcp', label: 'MCP', count: mcpRows.length },
              { value: 'skills', label: 'Skills', count: skillRows.length },
              { value: 'jobs', label: 'Jobs', count: jobRows.length },
              { value: 'personal', label: 'Personal Ops', count: personalRows.length },
              { value: 'diagnostics', label: 'Beta Checklist' },
            ]}
          />
          {runtimeMode === 'providers' ? (
            <ProviderSettingsPanel />
          ) : runtimeMode === 'diagnostics' ? (
            <InternalBetaDiagnosticsPanel workspaceId={capabilities?.workspace?.id || 'chat'} />
          ) : runtimeMode === 'overview' ? (
            <ProviderDashboard
              workspaceId={capabilities?.workspace?.id || 'chat'}
              workspacePath={capabilities?.workspace?.path || null}
              runtimeCapabilities={capabilities}
              status={props.status}
              approvalsCount={props.approvalsCount}
              onStart={props.onStart}
              onRepair={props.onRepair}
            />
          ) : (
            <DetailRows rows={runtimeRowsForMode} empty="No runtime status is available." />
          )}
        </section>
      </div>
    </PageFrame>
  );
}
