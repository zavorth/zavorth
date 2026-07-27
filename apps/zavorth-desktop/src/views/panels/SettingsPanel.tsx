import { useState } from 'react';
import type { RuntimeCapabilitiesSnapshot } from '../../apiClient';
import type { BootEvent, RuntimeStatus } from '../../global';
import { DetailRows, PageFrame, TextTabs, type DetailRow } from './panelPrimitives';

type RuntimeMode = 'overview' | 'permissions' | 'providers' | 'workspace' | 'mcp' | 'skills' | 'personal';

function formatNexusStatus(status: unknown): string {
  if (status === null || status === undefined) return 'unavailable';
  if (typeof status === 'string') {
    const s = status.trim().toLowerCase();
    if (s === 'available' || s === 'active' || s === 'ready') return 'available';
    if (s === 'unavailable' || s === 'offline') return 'unavailable';
  }
  if (typeof status === 'object') {
    const obj = status as Record<string, unknown>;
    if (obj.status === 'active' || obj.active === true || obj.available === true) {
      return 'available';
    }
  }
  return 'unknown';
}

function sanitizeText(text: string): string {
  if (!text) return '';
  let cleaned = text;
  // Replace absolute Windows/Unix paths
  cleaned = cleaned.replace(/[A-Za-z]:\\[^:\n\r]+/g, '[local path]');
  cleaned = cleaned.replace(/\/\w+\/\w+\/[^:\n\r\s]+/g, '[local path]');

  // Redact secrets/tokens/keys
  cleaned = cleaned.replace(/\b[a-fA-F0-9]{32,}\b/g, '[redacted token]');
  cleaned = cleaned.replace(/AIzaSy[A-Za-z0-9_-]{33}/g, '[redacted API key]');
  cleaned = cleaned.replace(/-----BEGIN[ A-Z]+PRIVATE KEY-----[^-]+-----END[ A-Z]+PRIVATE KEY-----/g, '[redacted private key]');

  // Remove control characters/newlines
  cleaned = cleaned.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ');

  if (cleaned.length > 120) {
    cleaned = cleaned.slice(0, 117) + '...';
  }
  return cleaned;
}

export function SettingsPanel(props: {
  events: BootEvent[];
  nexusStatus: unknown;
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  status: RuntimeStatus;
}) {
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>('overview');
  const capabilities = props.runtimeCapabilities;
  const providers = capabilities?.providers;
  const providerConnections = [
    ...(providers?.connected || []),
    ...(providers?.configurable || []),
    ...(providers?.blocked || []),
  ];
  const workspaceKnowledge = capabilities?.workspaceKnowledge;
  const ragSources = workspaceKnowledge?.ragSources || [];
  const capabilitySummary = capabilities?.capabilities?.summary;
  const selectedSpec = capabilities?.modelSpecs?.specs?.find(spec => spec.id === capabilities?.modelSpecs?.selectedSpecId)
    || capabilities?.modelSpecs?.specs?.[0];
  const providerCount = providers?.connected?.length || 0;
  const mcpReviewCount = (capabilities?.mcpTrust?.servers || []).filter(server => server.trustState !== 'trusted').length;
  const configuredPersonalOps = (capabilities?.personalOps?.connectors || []).filter(connector => connector.status === 'configured').length;

  const runtimeRows: DetailRow[] = [
    {
      id: 'runtime',
      title: props.status.running ? 'Runtime reachable' : 'Runtime not reachable',
      description: sanitizeText(props.status.message || props.status.baseUrl),
      meta: sanitizeText(props.status.baseUrl),
      tone: props.status.running ? 'ready' : 'warning',
    },
    {
      id: 'runtime-capabilities',
      title: 'Runtime capabilities',
      description: capabilitySummary ? `${capabilitySummary.available || 0} available, ${capabilitySummary.configurable || 0} configurable, ${capabilitySummary.blocked || 0} blocked.`
        : 'Capabilities API is unavailable.',
      meta: sanitizeText(capabilities?.contractVersion || 'offline'),
      tone: capabilities ? 'ready' : 'warning',
    },
    {
      id: 'runtime-model-spec',
      title: 'Model spec',
      description: sanitizeText(selectedSpec?.summary || providers?.routingReason || 'Model specs are loaded from runtime state.'),
      meta: sanitizeText(selectedSpec?.label || capabilities?.modelSpecs?.selectedSpecId || 'daily'),
      tone: capabilities ? 'ready' : 'muted',
    },
    {
      id: 'runtime-providers',
      title: 'Connected providers',
      description: providerCount > 0
        ? `${providerCount} provider connection(s) configured without exposing secrets.`
        : 'No configured provider connections are projected yet.',
      meta: `${providers?.selectableModelIds?.length || 0} models`,
      tone: providerCount > 0 ? 'ready' : 'muted',
    },
    {
      id: 'runtime-trust',
      title: 'MCP exposure gate',
      description: `${mcpReviewCount} MCP server(s) need trust review; ${configuredPersonalOps} personal connector(s) configured but still governed.`,
      meta: 'approval-first',
      tone: mcpReviewCount > 0 || configuredPersonalOps > 0 ? 'warning' : 'muted',
    },
    {
      id: 'release-readiness',
      title: 'Release readiness',
      description: 'Installer, signing contract, auto-update metadata, diagnostics and rollback are checked by the desktop release gate.',
      meta: 'package + update',
      tone: 'muted',
    },
    {
      id: 'nexus',
      title: 'Nexus',
      description: `Status: ${formatNexusStatus(props.nexusStatus)}`,
      meta: 'local',
      tone: formatNexusStatus(props.nexusStatus) === 'available' ? 'ready' : 'muted',
    },
    ...props.events.map(event => ({
      id: `${event.at}-${event.message}`,
      title: sanitizeText(event.message),
      description: sanitizeText(event.type),
      meta: new Date(event.at).toLocaleTimeString(),
      tone: event.type === 'error' ? 'danger' as const : 'muted' as const,
    })),
  ];

  const permissionRows: DetailRow[] = Object.entries(capabilities?.permissions?.domains || {}).flatMap(([domain, domainConfig]) => (
    Object.entries(domainConfig.actions || {}).map(([action, actionConfig]) => ({
      id: `permission-${domain}-${action}`,
      title: sanitizeText(`${domainConfig.label || domain}: ${action}`),
      description: sanitizeText(actionConfig.reason || `Default policy: ${actionConfig.default || 'review'}.`),
      meta: actionConfig.requiresApproval ? 'approval required' : sanitizeText(actionConfig.default || 'allowed'),
      tone: actionConfig.requiresApproval ? 'warning' as const : 'ready' as const,
    }))
  ));

  const providerRows: DetailRow[] = [
    ...(capabilities?.modelSpecs?.specs || []).map(spec => ({
      id: `model-spec-${spec.id || spec.label}`,
      title: sanitizeText(spec.label || spec.id || 'Model spec'),
      description: sanitizeText(spec.summary || `Max effort: ${spec.maxEffort || 'default'}; estimated cost: ${spec.estimatedCost || 'unknown'}.`),
      meta: spec.id === capabilities?.modelSpecs?.selectedSpecId ? 'selected' : sanitizeText(spec.id || 'spec'),
      tone: spec.id === capabilities?.modelSpecs?.selectedSpecId ? 'ready' as const : 'muted' as const,
    })),
    ...providerConnections.map(provider => ({
      id: `provider-${provider.id || provider.label}`,
      title: sanitizeText(provider.label || provider.id || 'Provider'),
      description: provider.targetHost
        ? `Target: ${sanitizeText(provider.targetHost)}; loopback=${provider.localLoopback ? 'yes' : 'no'}; default route=${provider.defaultRouteAllowed ? 'yes' : 'no'}.`
        : sanitizeText(provider.blockReason || 'Setup is governed and does not run hidden live probes.'),
      meta: sanitizeText(provider.status || 'configured'),
      tone: provider.status === 'configured' ? 'ready' as const : provider.status === 'blocked' ? 'danger' as const : 'warning' as const,
    })),
  ];

  const workspaceRows: DetailRow[] = [
    {
      id: 'workspace-active',
      title: sanitizeText(workspaceKnowledge?.activeWorkspaceLabel || capabilities?.workspace?.label || 'Chat'),
      description: capabilities?.workspace?.path ? `Filesystem scope is confined to ${sanitizeText(capabilities.workspace.path)}.`
        : 'Chat mode keeps filesystem and shell out of scope.',
      meta: sanitizeText(workspaceKnowledge?.isolation || capabilities?.workspace?.isolation || 'chat'),
      tone: capabilities?.workspace?.path ? 'ready' : 'muted',
    },
    ...(workspaceKnowledge?.allowedPaths || []).map((allowedPath, index) => ({
      id: `workspace-path-${index}`,
      title: sanitizeText(allowedPath),
      description: 'Approved filesystem, shell, RAG and skill scope path.',
      meta: 'allowed path',
      tone: 'ready' as const,
    })),
    ...ragSources.map(source => ({
      id: `rag-source-${source.id || source.label}`,
      title: sanitizeText(source.label || source.id || 'Knowledge source'),
      description: `${sanitizeText(source.kind || 'source')} context is ${source.trusted ? 'trusted' : 'wrapped as untrusted'} before the model sees it.`,
      meta: source.trusted ? 'trusted' : 'untrusted',
      tone: source.trusted ? 'ready' as const : 'warning' as const,
    })),
  ];

  const mcpRows: DetailRow[] = (capabilities?.mcpTrust?.servers || []).map(server => ({
    id: `mcp-${server.id || server.label}`,
    title: sanitizeText(server.label || server.id || 'MCP server'),
    description: `${server.toolNames?.length || 0} tool(s); network=${sanitizeText(server.networkAccess || 'blocked')}; exposed=${server.exposedToModel ? 'yes' : 'no'}.`,
    meta: sanitizeText(`${server.trustState || 'review'} / ${server.risk || 'risk unknown'}`),
    tone: server.trustState === 'trusted' ? 'ready' : server.trustState === 'blocked' ? 'danger' : 'warning',
  }));

  const skillRows: DetailRow[] = (capabilities?.skillHistory?.entries || []).map(entry => ({
    id: `skill-history-${entry.id || entry.skillName}`,
    title: sanitizeText(entry.skillName || entry.skillId || 'Skill'),
    description: `Mode: ${sanitizeText(entry.mode || 'recorded')}; source: ${sanitizeText(entry.source || 'runtime')}.`,
    meta: sanitizeText(entry.receiptId || entry.at || 'receipt-backed'),
    tone: entry.mode === 'blocked' ? 'danger' : entry.mode === 'auto-selected' ? 'ready' : 'muted',
  }));

  if (skillRows.length === 0) {
    skillRows.push({
      id: 'skill-router-default',
      title: 'Skill router',
      description: 'Natural routing can preview the best native skill before execution.',
      meta: 'approval-first',
      tone: 'muted',
    });
  }

  const personalRows: DetailRow[] = (capabilities?.personalOps?.connectors || []).map(connector => {
    const operations = connector.operations || [];
    const operationSummary = operations.length > 0
      ? operations.map(operation => sanitizeText(`${operation.label || operation.id}${operation.enabled ? '' : ' (setup)'}`)).join(', ')
      : `${sanitizeText(connector.kind || 'connector')} actions wait for account setup`;
    return {
      id: `personal-${connector.id || connector.label}`,
      title: sanitizeText(connector.label || connector.id || 'Personal connector'),
      description: `${operationSummary}. Every personal operation is governed and creates redacted receipts.`,
      meta: connector.enabled ? 'enabled / approval-required' : sanitizeText(connector.status || 'disabled'),
      tone: connector.enabled ? 'warning' as const : connector.status === 'configured' ? 'ready' as const : 'muted' as const,
    };
  });

  if (personalRows.length === 0) {
    personalRows.push({
      id: 'personal-google-setup',
      title: 'Google Personal Ops',
      description: 'Gmail, Google Calendar, and Google Tasks status view.',
      meta: 'not connected',
      tone: 'muted',
    });
  }

  const rowsByMode: Record<RuntimeMode, DetailRow[]> = {
    overview: runtimeRows,
    permissions: permissionRows,
    providers: providerRows,
    workspace: workspaceRows,
    mcp: mcpRows,
    skills: skillRows,
    personal: personalRows,
  };

  return (
    <PageFrame
      description="Runtime, permissions, providers, workspace context, MCP trust and personal ops."
      meta={props.status.running ? 'ready' : 'offline'}
      title="Configurations"
    >
      <div className="zavorth-settings-panel">
        <TextTabs<RuntimeMode>
          value={runtimeMode}
          onChange={setRuntimeMode}
          items={[
            { value: 'overview', label: 'Overview' },
            { value: 'permissions', label: 'Permissions', count: permissionRows.length },
            { value: 'providers', label: 'Providers', count: providerRows.length },
            { value: 'workspace', label: 'Workspace', count: workspaceRows.length },
            { value: 'mcp', label: 'MCP', count: mcpRows.length },
            { value: 'skills', label: 'Skills', count: skillRows.length },
            { value: 'personal', label: 'Personal Ops', count: personalRows.length },
          ]}
        />
        <DetailRows rows={rowsByMode[runtimeMode]} empty="No runtime status is available." />
      </div>
    </PageFrame>
  );
}
