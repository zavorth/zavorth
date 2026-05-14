import type {
  AgentRiskLevel,
  AgentSecuritySurface,
  AgentToolCapability,
  AgentToolSecurityDefinition,
} from './AgentSecurityPolicyEngine.js';
import { normalizeAgentToolSecurityDefinition } from './AgentSecurityPolicyEngine.js';
import { NATIVE_AGENT_TOOL_SECURITY_DEFINITIONS } from './AgentToolSecurityCatalog.js';

export type AgentSecurityInventorySurface =
  | AgentSecuritySurface
  | 'admin-api'
  | 'browser-automation'
  | 'mitm'
  | 'node-host-capability'
  | 'skill-import'
  | 'webhook-dispatch';

export type AgentSecurityInventoryEntry = {
  id: string;
  surface: AgentSecurityInventorySurface;
  capabilities: AgentToolCapability[];
  defaultRisk: AgentRiskLevel;
  requiresConfirmation: boolean;
  canExfiltrateData: boolean;
  canExecuteCode: boolean;
  canMutateHost: boolean;
  description: string;
  source: 'explicit' | 'inferred' | 'fallback';
};

export type AgentSecurityInventoryFinding = {
  id: string;
  severity: 'error' | 'warning';
  message: string;
};

export const NODE_HOST_CAPABILITY_SECURITY_INVENTORY: AgentSecurityInventoryEntry[] = [
  {
    id: 'system.run',
    surface: 'node-host-capability',
    capabilities: ['shell', 'filesystem', 'destructive'],
    defaultRisk: 'dangerous',
    requiresConfirmation: true,
    canExfiltrateData: false,
    canExecuteCode: true,
    canMutateHost: true,
    description: 'Runs governed host commands on a paired node host.',
    source: 'explicit',
  },
  {
    id: 'node.maintenance',
    surface: 'node-host-capability',
    capabilities: ['local-observation', 'configuration'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    canExfiltrateData: false,
    canExecuteCode: false,
    canMutateHost: true,
    description: 'Runs node-host doctor or repair workflows.',
    source: 'explicit',
  },
  {
    id: 'browser.proxy',
    surface: 'node-host-capability',
    capabilities: ['browser', 'network'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    canExfiltrateData: true,
    canExecuteCode: false,
    canMutateHost: false,
    description: 'Opens or reports a browser/proxy endpoint on a paired node host.',
    source: 'explicit',
  },
  {
    id: 'device.info',
    surface: 'node-host-capability',
    capabilities: ['local-observation'],
    defaultRisk: 'safe',
    requiresConfirmation: false,
    canExfiltrateData: false,
    canExecuteCode: false,
    canMutateHost: false,
    description: 'Reads low-risk node host identity and environment metadata.',
    source: 'explicit',
  },
  {
    id: 'files.read',
    surface: 'node-host-capability',
    capabilities: ['filesystem', 'local-observation'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    canExfiltrateData: false,
    canExecuteCode: false,
    canMutateHost: false,
    description: 'Reads files from a paired node host within allowed roots.',
    source: 'explicit',
  },
  {
    id: 'files.write',
    surface: 'node-host-capability',
    capabilities: ['filesystem', 'destructive'],
    defaultRisk: 'dangerous',
    requiresConfirmation: true,
    canExfiltrateData: false,
    canExecuteCode: false,
    canMutateHost: true,
    description: 'Writes files to a paired node host within allowed roots.',
    source: 'explicit',
  },
  {
    id: 'files.watch',
    surface: 'node-host-capability',
    capabilities: ['filesystem', 'local-observation'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    canExfiltrateData: false,
    canExecuteCode: false,
    canMutateHost: false,
    description: 'Watches files or directories on a paired node host within allowed roots.',
    source: 'explicit',
  },
  {
    id: 'screen.capture',
    surface: 'node-host-capability',
    capabilities: ['desktop', 'local-observation'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    canExfiltrateData: false,
    canExecuteCode: false,
    canMutateHost: false,
    description: 'Captures the node host screen into a scoped artifact.',
    source: 'explicit',
  },
  {
    id: 'camera.capture',
    surface: 'node-host-capability',
    capabilities: ['desktop', 'local-observation'],
    defaultRisk: 'dangerous',
    requiresConfirmation: true,
    canExfiltrateData: false,
    canExecuteCode: false,
    canMutateHost: false,
    description: 'Captures camera media from a paired device when explicitly allowed.',
    source: 'explicit',
  },
  {
    id: 'location.read',
    surface: 'node-host-capability',
    capabilities: ['local-observation'],
    defaultRisk: 'dangerous',
    requiresConfirmation: true,
    canExfiltrateData: false,
    canExecuteCode: false,
    canMutateHost: false,
    description: 'Reads precise or operator-supplied location data from a paired node host.',
    source: 'explicit',
  },
  {
    id: 'device.confirm',
    surface: 'node-host-capability',
    capabilities: ['local-observation'],
    defaultRisk: 'safe',
    requiresConfirmation: false,
    canExfiltrateData: false,
    canExecuteCode: false,
    canMutateHost: false,
    description: 'Collects explicit device-side confirmation for sensitive operations.',
    source: 'explicit',
  },
  {
    id: 'haptics.vibrate',
    surface: 'node-host-capability',
    capabilities: ['desktop'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    canExfiltrateData: false,
    canExecuteCode: false,
    canMutateHost: false,
    description: 'Triggers a short local haptic signal on supported paired devices.',
    source: 'explicit',
  },
  {
    id: 'clipboard.read',
    surface: 'node-host-capability',
    capabilities: ['desktop', 'local-observation'],
    defaultRisk: 'dangerous',
    requiresConfirmation: true,
    canExfiltrateData: false,
    canExecuteCode: false,
    canMutateHost: false,
    description: 'Reads clipboard content from a paired node host.',
    source: 'explicit',
  },
  {
    id: 'clipboard.write',
    surface: 'node-host-capability',
    capabilities: ['desktop', 'destructive'],
    defaultRisk: 'dangerous',
    requiresConfirmation: true,
    canExfiltrateData: false,
    canExecuteCode: false,
    canMutateHost: true,
    description: 'Writes explicit text to a paired node host clipboard.',
    source: 'explicit',
  },
  {
    id: 'notifications.send',
    surface: 'node-host-capability',
    capabilities: ['desktop', 'external-send'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    canExfiltrateData: true,
    canExecuteCode: false,
    canMutateHost: false,
    description: 'Sends a local notification through a paired node host.',
    source: 'explicit',
  },
];

export const CROSS_SURFACE_SECURITY_INVENTORY: AgentSecurityInventoryEntry[] = [
  {
    id: 'mcp.dynamic_tools',
    surface: 'mcp-tool',
    capabilities: ['mcp', 'network', 'external-send', 'untrusted-input'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    canExfiltrateData: true,
    canExecuteCode: false,
    canMutateHost: false,
    description: 'Dynamically discovered MCP tools registered with inferred review-gated policy.',
    source: 'explicit',
  },
  {
    id: 'skills.imported_library',
    surface: 'skill-import',
    capabilities: ['skill', 'filesystem', 'untrusted-input'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    canExfiltrateData: false,
    canExecuteCode: false,
    canMutateHost: true,
    description: 'Imported local/global skills and skill-library content treated as untrusted until installed.',
    source: 'explicit',
  },
  {
    id: 'webhooks.dispatch',
    surface: 'webhook-dispatch',
    capabilities: ['webhook', 'network', 'external-send'],
    defaultRisk: 'dangerous',
    requiresConfirmation: true,
    canExfiltrateData: true,
    canExecuteCode: false,
    canMutateHost: false,
    description: 'Configured webhook delivery and testing surfaces.',
    source: 'explicit',
  },
  {
    id: 'admin.api',
    surface: 'admin-api',
    capabilities: ['configuration', 'credential', 'filesystem', 'network'],
    defaultRisk: 'dangerous',
    requiresConfirmation: true,
    canExfiltrateData: true,
    canExecuteCode: false,
    canMutateHost: true,
    description: 'Management API routes that mutate settings, providers, credentials or runtime state.',
    source: 'explicit',
  },
  {
    id: 'desktop.browser_automation',
    surface: 'browser-automation',
    capabilities: ['browser', 'desktop', 'external-send', 'untrusted-input'],
    defaultRisk: 'dangerous',
    requiresConfirmation: true,
    canExfiltrateData: true,
    canExecuteCode: false,
    canMutateHost: true,
    description: 'Browser and desktop automation adapters that can act on the operator host.',
    source: 'explicit',
  },
  {
    id: 'mitm.zavorthBridge',
    surface: 'mitm',
    capabilities: ['configuration', 'credential', 'destructive', 'network'],
    defaultRisk: 'dangerous',
    requiresConfirmation: true,
    canExfiltrateData: true,
    canExecuteCode: false,
    canMutateHost: true,
    description: 'Local MITM mode that installs trust material, edits DNS and forwards provider traffic.',
    source: 'explicit',
  },
];

export function buildAgentSecurityInventory(
  nativeDefinitions: AgentToolSecurityDefinition[] = NATIVE_AGENT_TOOL_SECURITY_DEFINITIONS,
): AgentSecurityInventoryEntry[] {
  const nativeEntries = nativeDefinitions.map((definition) =>
    convertToolDefinitionToInventoryEntry(normalizeAgentToolSecurityDefinition(definition)),
  );

  return [
    ...nativeEntries,
    ...NODE_HOST_CAPABILITY_SECURITY_INVENTORY.map(cloneInventoryEntry),
    ...CROSS_SURFACE_SECURITY_INVENTORY.map(cloneInventoryEntry),
  ].sort((left, right) => `${left.surface}:${left.id}`.localeCompare(`${right.surface}:${right.id}`, 'en-US'));
}

export function validateAgentSecurityInventory(
  entries: AgentSecurityInventoryEntry[],
): AgentSecurityInventoryFinding[] {
  const findings: AgentSecurityInventoryFinding[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const key = `${entry.surface}:${entry.id}`.toLowerCase();
    if (seen.has(key)) {
      findings.push({
        id: entry.id,
        severity: 'error',
        message: `Duplicate security inventory entry for ${key}.`,
      });
    }
    seen.add(key);

    if (!entry.id.trim()) {
      findings.push({ id: '<missing>', severity: 'error', message: 'Inventory entry is missing id.' });
    }
    if (entry.capabilities.length === 0 || entry.capabilities.includes('unknown')) {
      findings.push({
        id: entry.id,
        severity: 'error',
        message: 'Inventory entry must declare concrete non-unknown capabilities.',
      });
    }
    if (!entry.description.trim()) {
      findings.push({
        id: entry.id,
        severity: 'error',
        message: 'Inventory entry must describe the protected surface.',
      });
    }
    if (entry.defaultRisk !== 'safe' && !entry.requiresConfirmation) {
      findings.push({
        id: entry.id,
        severity: 'error',
        message: `Risk ${entry.defaultRisk} requires confirmation.`,
      });
    }
    if (entry.source === 'fallback') {
      findings.push({
        id: entry.id,
        severity: 'error',
        message: 'Fallback security inventory entries are denied and cannot be exposed.',
      });
    }
  }

  return findings;
}

function convertToolDefinitionToInventoryEntry(
  definition: AgentToolSecurityDefinition,
): AgentSecurityInventoryEntry {
  return {
    id: definition.toolName,
    surface: definition.surface,
    capabilities: [...definition.capabilities],
    defaultRisk: definition.defaultRisk,
    requiresConfirmation: definition.requiresConfirmation,
    canExfiltrateData: Boolean(definition.canExfiltrateData),
    canExecuteCode: Boolean(definition.canExecuteCode),
    canMutateHost: Boolean(definition.canMutateHost),
    description: definition.description,
    source: definition.source || 'explicit',
  };
}

function cloneInventoryEntry(entry: AgentSecurityInventoryEntry): AgentSecurityInventoryEntry {
  return {
    ...entry,
    capabilities: [...entry.capabilities],
  };
}
