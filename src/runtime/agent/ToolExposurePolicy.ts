import type {
  UniversalBlockedToolExposure,
  UniversalToolExposure,
  UniversalToolExposureMode,
  UniversalToolExposureProfile,
  UniversalToolRiskLevel,
} from './UniversalAgentRuntimeTypes.js';
import { resolveToolGroupCatalogEntry } from './tools/ToolGroupCatalog.js';

import { SecurityAuditLogger } from '../../services/SecurityAuditLogger.js';
import { LogRepository } from '../../storage/LogRepository.js';

export type ToolExposurePolicyInput = {
  requestedTools?: string[];
  allowedTools?: string[];
  requireApprovalFor?: string[];
  blockedTools?: string[];
  blockedToolReason?: string;
  toolHintProfile?: ToolExposurePolicyHintProfile | null;
  metadata?: Record<string, unknown>;
};

export type ToolExposurePolicyHintProfile = {
  intentCategory?: string | null;
  groups?: string[];
  recommendedToolNames?: string[];
  quarantinedToolNames?: string[];
  toolExposureGatedByCognitiveFirewall?: boolean;
  isHardGate?: boolean;
  reason?: string;
};

const DEFAULT_SAFE_TOOLS = new Set([
  'read',
  'glob',
  'grep',
  'ls',
  'read_file',
  'workspace.read',
  'get_datetime',
  'datetime',
  'time.now',
  'memory.read',
  'sessions.history',
  'sessions.list',
  'session_search',
  'session_search_fts5',
  'zavorth_action',
  'zavorth_delegate',
  'zavorth_macro',
  'zavorth_checkpoint',
  'zavorth_bm25_search',
  'zavorth_lsp_diagnostics',
  'zavorth_power_lock',
  'zavorth_blueprint',
  'zavorth_context_meter',
  'zavorth_mcp_doctor',
  'zavorth_stealth_browse',
  'zavorth_scheduler',
  'zavorth_plugin_sdk',
  'zavorth_worktree',
  'zavorth_memory_graph',
  'zavorth_self_repair',
  'swarm.run',
  'swarm.scale',
  'swarm.massive',
  'swarm.scale.live',
]);

const DEFAULT_ATTENTION_TOOLS = new Set([
  'network_fetch',
  'web.search',
  'pdf.generate',
  'report.send',
]);

const DEFAULT_DANGER_TOOLS = new Set([
  'bash',
  'edit',
  'write',
  'multiedit',
  'notebookedit',
  'write_file',
  'filesystem.write',
  'bash_unsafe',
  'shell.exec',
  'commit',
  'deploy',
  'npm_install',
  'modify_production_db',
]);

function normalizeToolId(value: string): string {
  return value.trim();
}

function normalizeToolIds(values?: string[]): string[] {
  return Array.from(new Set((values || []).map(normalizeToolId).filter(Boolean)));
}

function humanizeToolLabel(toolId: string): string {
  return toolId
    .replace(/[._:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase()) || 'Tool';
}

function inferRisk(toolId: string): UniversalToolRiskLevel {
  const catalogEntry = resolveToolGroupCatalogEntry(toolId);
  if (catalogEntry) {
    return catalogEntry.risk;
  }

  const normalized = toolId.toLowerCase();
  if (DEFAULT_DANGER_TOOLS.has(normalized) || normalized.includes('write') || normalized.includes('delete') || normalized.includes('shell')) {
    return 'danger';
  }
  if (DEFAULT_ATTENTION_TOOLS.has(normalized) || normalized.includes('network') || normalized.includes('send')) {
    return 'attention';
  }
  if (DEFAULT_SAFE_TOOLS.has(normalized) || normalized.includes('read') || normalized.includes('list') || normalized.includes('history')) {
    return 'safe';
  }
  return 'unknown';
}

function resolveChannelUserIdAllowed(metadata?: Record<string, unknown>): boolean | null {
  if (metadata?.channelUserIdAllowed === false) return false;
  if (metadata?.channelUserIdAllowed === true) return true;
  const channelFields = metadata?.channelFields;
  if (channelFields && typeof channelFields === 'object' && !Array.isArray(channelFields)) {
    const value = (channelFields as Record<string, unknown>).channelUserIdAllowed;
    if (value === false) return false;
    if (value === true) return true;
  }
  return null;
}

function resolveGroupToolPolicy(metadata?: Record<string, unknown>): {
  untrustedUserMode: 'none' | 'safe-only' | 'allowlist-only' | 'safe-plus-allowlist';
  allowedToolsForUntrustedUsers: string[];
} {
  const direct = metadata?.groupToolPolicy;
  const channelFields = metadata?.channelFields;
  const nested = channelFields && typeof channelFields === 'object' && !Array.isArray(channelFields)
    ? (channelFields as Record<string, unknown>).groupToolPolicy
    : null;
  const candidate = direct && typeof direct === 'object' && !Array.isArray(direct)
    ? direct as Record<string, unknown>
    : nested && typeof nested === 'object' && !Array.isArray(nested)
      ? nested as Record<string, unknown>
      : {};
  const mode = String(candidate.untrustedUserMode || 'none').trim();
  return {
    untrustedUserMode: ['none', 'safe-only', 'allowlist-only', 'safe-plus-allowlist'].includes(mode)
      ? mode as 'none' | 'safe-only' | 'allowlist-only' | 'safe-plus-allowlist'
      : 'none',
    allowedToolsForUntrustedUsers: normalizeToolIds(
      Array.isArray(candidate.allowedToolsForUntrustedUsers)
        ? candidate.allowedToolsForUntrustedUsers.map(String)
        : [],
    ),
  };
}

function isForbiddenForUntrustedGroup(tool: UniversalToolExposure): boolean {
  const normalized = tool.id.toLowerCase();
  return tool.risk === 'danger'
    || tool.risk === 'unknown'
    || normalized.includes('admin')
    || normalized.includes('critical')
    || normalized.includes('provider.secret')
    || normalized.includes('provider_secret')
    || normalized.includes('rawkey')
    || normalized.includes('hpm')
    || normalized.includes('host_command')
    || normalized.includes('host.execute')
    || normalized.includes('workspace.host.')
    || normalized.includes('pty')
    || normalized.includes('shell');
}

function resolveMode(tools: UniversalToolExposure[]): UniversalToolExposureMode {
  if (tools.length === 0) {
    return 'unknown';
  }
  if (tools.some((tool) => tool.risk === 'danger')) {
    return 'restricted';
  }
  if (tools.some((tool) => tool.requiresApproval || tool.risk === 'attention' || tool.risk === 'unknown')) {
    return 'confirm';
  }
  return 'safe';
}

export class ToolExposurePolicy {
  public buildProfile(input: ToolExposurePolicyInput): UniversalToolExposureProfile {
    const auditLogger = (input.metadata?.auditLogger as SecurityAuditLogger) || new SecurityAuditLogger((input.metadata?.logRepo as LogRepository) || new LogRepository());

    const requireApprovalFor = new Set((input.requireApprovalFor || []).map((tool) => tool.toLowerCase()));
    const blockedToolIds = normalizeToolIds(input.blockedTools);
    const blockedToolReason = normalizeToolId(input.blockedToolReason || 'blocked-by-imported-capability-trust');
    const hintToolIds = normalizeToolIds(input.toolHintProfile?.recommendedToolNames);
    const cognitiveFirewallBlockedToolIds = normalizeToolIds(input.toolHintProfile?.quarantinedToolNames);
    const toolIds = Array.from(new Set([
      ...normalizeToolIds(input.requestedTools),
      ...normalizeToolIds(input.allowedTools),
      ...hintToolIds,
    ]));
    const effectiveBlockedToolIds = Array.from(new Set([
      ...blockedToolIds,
      ...cognitiveFirewallBlockedToolIds,
    ]));
    const effectiveBlockedToolSet = new Set(effectiveBlockedToolIds.map((tool) => tool.toLowerCase()));

    const blockedTools: UniversalBlockedToolExposure[] = [];
    const blockedExposureSet = new Set<string>();
    for (const toolId of cognitiveFirewallBlockedToolIds) {
      const normalizedToolId = toolId.toLowerCase();
      if (blockedExposureSet.has(normalizedToolId)) {
        continue;
      }
      blockedExposureSet.add(normalizedToolId);
      blockedTools.push({
        id: toolId,
        label: humanizeToolLabel(toolId),
        reason: 'blocked-by-cognitive-firewall-plugin-quarantine',
      });
      auditLogger.logToolExposureDecision({
        event: 'tool_exposure_decision',
        decision: 'blocked',
        toolName: toolId,
        risk: inferRisk(toolId),
        reason: 'blocked-by-cognitive-firewall-plugin-quarantine',
        channelUserIdAllowed: resolveChannelUserIdAllowed(input.metadata) !== false,
      });
    }
    let tools = toolIds.flatMap((toolId): UniversalToolExposure[] => {
      const normalizedToolId = toolId.toLowerCase();
      if (effectiveBlockedToolSet.has(normalizedToolId)) {
        if (!blockedExposureSet.has(normalizedToolId)) {
          blockedExposureSet.add(normalizedToolId);
          blockedTools.push({
            id: toolId,
            label: humanizeToolLabel(toolId),
            reason: blockedToolReason,
          });
          const reasonEnum = (blockedToolReason === 'blocked-by-cognitive-firewall-plugin-quarantine' || blockedToolReason === 'blocked-by-imported-capability-trust')
            ? blockedToolReason
            : 'blocked-by-imported-capability-trust';
          auditLogger.logToolExposureDecision({
            event: 'tool_exposure_decision',
            decision: 'blocked',
            toolName: toolId,
            risk: inferRisk(toolId),
            reason: reasonEnum,
            channelUserIdAllowed: resolveChannelUserIdAllowed(input.metadata) !== false,
          });
        }
        return [];
      }

      const risk = inferRisk(toolId);
      const catalogEntry = resolveToolGroupCatalogEntry(toolId);
      return [{
        id: toolId,
        label: humanizeToolLabel(toolId),
        capabilityId: toolId,
        ...(catalogEntry ? {
          group: catalogEntry.group,
          policyTags: catalogEntry.policyTags,
        } : {}),
        risk,
        requiresApproval: Boolean(catalogEntry?.requiresApproval) || risk === 'danger' || requireApprovalFor.has(toolId.toLowerCase()),
        description: catalogEntry?.description || this.describeTool(toolId, risk),
      }];
    });

    // Apply workspace policy validation
    const workspaceMeta = input.metadata?.workspace as any;
    const perms = workspaceMeta?.workspacePermissions;

    const filteredTools: UniversalToolExposure[] = [];
    for (const tool of tools) {
      const normalizedId = tool.id.toLowerCase();
      const isWorkspaceTool =
        normalizedId.startsWith('workspace:') ||
        normalizedId.startsWith('workspace_');

      if (isWorkspaceTool) {
        let allowed = false;
        let blockReason = 'workspace-permission-denied';

        if (!workspaceMeta) {
          allowed = false;
          blockReason = 'workspace-metadata-missing';
        } else if (!perms) {
          allowed = false;
          blockReason = 'workspace-permissions-missing';
        } else {
          const isGitTool =
            normalizedId.startsWith('workspace:workspace.git.') ||
            normalizedId.startsWith('workspace_git_');

          const isFilesystemTool =
            normalizedId.startsWith('workspace:workspace.filesystem.') ||
            normalizedId.startsWith('workspace_filesystem_');

          const isNotesTool =
            normalizedId.startsWith('workspace:workspace.notes.') ||
            normalizedId.startsWith('workspace_notes_');

          if (isGitTool) {
            allowed = perms.gitReadOnly === true;
          } else if (isFilesystemTool) {
            const isFilesystemWrite =
              normalizedId.startsWith('workspace:workspace.filesystem.write') ||
              normalizedId.startsWith('workspace:workspace.filesystem.mkdir') ||
              normalizedId.startsWith('workspace:workspace.filesystem.delete') ||
              normalizedId.startsWith('workspace:workspace.filesystem.edit') ||
              normalizedId.startsWith('workspace:workspace.filesystem.applypatch') ||
              normalizedId.startsWith('workspace_filesystem_write') ||
              normalizedId.startsWith('workspace_filesystem_mkdir') ||
              normalizedId.startsWith('workspace_filesystem_delete') ||
              normalizedId.startsWith('workspace_filesystem_edit') ||
              normalizedId.startsWith('workspace_filesystem_applypatch');

            if (isFilesystemWrite) {
              allowed = perms.filesystemWrite === true;
            } else {
              allowed = perms.filesystemRead === true;
            }
          } else if (isNotesTool) {
            allowed = perms.notes === true;
          } else {
            allowed = false;
          }
        }

        if (allowed && workspaceMeta.config) {
          const config = workspaceMeta.config;
          const isPtyTool = normalizedId.startsWith('workspace:workspace.pty.') || normalizedId.startsWith('workspace_pty_');
          const isHostPowerTool = normalizedId.startsWith('workspace:workspace.host.') || normalizedId.startsWith('workspace_host_');
          const isDeveloperTool = normalizedId.startsWith('workspace:workspace.developer.') || normalizedId.startsWith('workspace_developer_') || tool.risk === 'danger';
          const isTaskMandateTool = normalizedId.startsWith('workspace:workspace.mandate.') || normalizedId.startsWith('workspace_mandate_');
          const isTempDirTrustTool = normalizedId.startsWith('workspace:workspace.trust.') || normalizedId.startsWith('workspace_trust_');

          if (isPtyTool && (!config.allowPty || !config.allowHostPowerMode)) {
            allowed = false;
            blockReason = 'workspace-config-denied-pty';
          } else if (isHostPowerTool && !config.allowHostPowerMode) {
            allowed = false;
            blockReason = 'workspace-config-denied-host-power-mode';
          } else if (isDeveloperTool && !config.allowDeveloperMode) {
            allowed = false;
            blockReason = 'workspace-config-denied-developer-mode';
          } else if (isTaskMandateTool && !config.allowTaskMandates) {
            allowed = false;
            blockReason = 'workspace-config-denied-task-mandates';
          } else if (isTempDirTrustTool && !config.allowTemporaryDirectoryTrust) {
            allowed = false;
            blockReason = 'workspace-config-denied-temporary-directory-trust';
          }
        }

        if (allowed) {
          filteredTools.push(tool);
        } else {
          blockedTools.push({
            id: tool.id,
            label: tool.label,
            reason: 'global-policy-block',
          });
          auditLogger.logWorkspaceEvent({
            event: 'workspace_tool_blocked',
            workspaceId: workspaceMeta?.workspaceId || 'unknown',
            toolName: tool.id,
            decision: 'blocked',
            reason: blockReason,
            ...(workspaceMeta?.workspaceRoot ? { rootPath: workspaceMeta.workspaceRoot } : {}),
            ...(workspaceMeta?.rootPathHash ? { rootPathHash: workspaceMeta.rootPathHash } : {}),
            ...(workspaceMeta?.rootPathSuffix ? { rootPathSuffix: workspaceMeta.rootPathSuffix } : {}),
          });
        }
      } else {
        filteredTools.push(tool);
      }
    }
    tools = filteredTools;

    // Apply narrowing for untrusted group users
    if (resolveChannelUserIdAllowed(input.metadata) === false) {
      const groupPolicy = resolveGroupToolPolicy(input.metadata);
      const untrustedUserMode = groupPolicy.untrustedUserMode;
      const allowedToolsForUntrustedUsers = new Set(
        groupPolicy.allowedToolsForUntrustedUsers.map((toolId) => toolId.toLowerCase()),
      );

      const filteredTools: UniversalToolExposure[] = [];
      for (const tool of tools) {
        let allowed = false;
        const normalizedToolId = tool.id.toLowerCase();
        if (isForbiddenForUntrustedGroup(tool)) {
          allowed = false;
        } else if (untrustedUserMode === 'none') {
          allowed = false;
        } else if (untrustedUserMode === 'safe-only') {
          allowed = tool.risk === 'safe';
        } else if (untrustedUserMode === 'allowlist-only') {
          allowed = allowedToolsForUntrustedUsers.has(normalizedToolId);
        } else if (untrustedUserMode === 'safe-plus-allowlist') {
          allowed = tool.risk === 'safe' || allowedToolsForUntrustedUsers.has(normalizedToolId);
        }

        if (allowed) {
          filteredTools.push(tool);
        } else {
          blockedTools.push({
            id: tool.id,
            label: tool.label,
            reason: 'unauthorized-user-in-group',
          });
          auditLogger.logToolExposureDecision({
            event: 'tool_exposure_decision',
            decision: 'blocked',
            toolName: tool.id,
            risk: tool.risk,
            reason: 'unauthorized-user-in-group',
            channelUserIdAllowed: false,
            groupToolPolicyMode: untrustedUserMode,
          });
        }
      }
      tools = filteredTools;
    }

    const mode = resolveMode(tools);
    const exposureSummary = tools.length === 0
      ? 'No tools were exposed for this execution.'
      : `${tools.length} ${tools.length === 1 ? 'tool exposed' : 'tools exposed'} with ${mode} policy.`;
    const quarantineSummary = blockedTools.length === 0
      ? ''
      : ` ${blockedTools.length} ${blockedTools.length === 1 ? 'tool blocked' : 'tools blocked'} by quarantine.`;

    return {
      mode,
      summary: `${exposureSummary}${quarantineSummary}`,
      tools,
      ...(blockedTools.length > 0 ? {
        blockedTools,
        ...(blockedToolIds.length > 0 ? { toolExposureGatedByImportedCapabilityTrust: true } : {}),
        ...(cognitiveFirewallBlockedToolIds.length > 0 ? { toolExposureGatedByCognitiveFirewall: true } : {}),
      } : {}),
    };
  }

  private describeTool(toolId: string, risk: UniversalToolRiskLevel): string {
    if (risk === 'danger') {
      return `${toolId} can change the environment and must go through approval.`;
    }
    if (risk === 'attention') {
      return `${toolId} can leave local context or send data.`;
    }
    if (risk === 'safe') {
      return `${toolId} is considered safe read/query access.`;
    }
    return `${toolId} does not have a fine-grained risk classification yet.`;
  }
}
