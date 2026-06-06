import type {
  UniversalBlockedToolExposure,
  UniversalToolExposure,
  UniversalToolExposureMode,
  UniversalToolExposureProfile,
  UniversalToolRiskLevel,
} from './UniversalAgentRuntimeTypes.js';
import { resolveToolGroupCatalogEntry } from './tools/ToolGroupCatalog.js';

export type ToolExposurePolicyInput = {
  requestedTools?: string[];
  allowedTools?: string[];
  requireApprovalFor?: string[];
  blockedTools?: string[];
  blockedToolReason?: string;
  toolHintProfile?: ToolExposurePolicyHintProfile | null;
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
  'zavorth_action',
  'swarm.run',
]);

const DEFAULT_ATTENTION_TOOLS = new Set([
  'network_fetch',
  'web.search',
  'pdf.generate',
  'report.send',
  'swarm.scale',
  'swarm.massive',
  'swarm.scale.live',
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
    .replace(/^./, (letter) => letter.toUpperCase()) || 'Ferramenta';
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
    }
    const tools = toolIds.flatMap((toolId): UniversalToolExposure[] => {
      const normalizedToolId = toolId.toLowerCase();
      if (effectiveBlockedToolSet.has(normalizedToolId)) {
        if (!blockedExposureSet.has(normalizedToolId)) {
          blockedExposureSet.add(normalizedToolId);
          blockedTools.push({
            id: toolId,
            label: humanizeToolLabel(toolId),
            reason: blockedToolReason,
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

    const mode = resolveMode(tools);
    const exposureSummary = tools.length === 0
      ? 'Nenhuma ferramenta foi exposta para esta execucao.'
      : `${tools.length} ${tools.length === 1 ? 'ferramenta exposta' : 'ferramentas expostas'} com policy ${mode}.`;
    const quarantineSummary = blockedTools.length === 0
      ? ''
      : ` ${blockedTools.length} ${blockedTools.length === 1 ? 'ferramenta bloqueada' : 'ferramentas bloqueadas'} por quarentena.`;

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
      return `${toolId} pode alterar o ambiente e deve passar por aprovacao.`;
    }
    if (risk === 'attention') {
      return `${toolId} pode sair do contexto local ou enviar dados.`;
    }
    if (risk === 'safe') {
      return `${toolId} e considerada leitura/consulta segura.`;
    }
    return `${toolId} ainda nao tem classificacao de risco fina.`;
  }
}
