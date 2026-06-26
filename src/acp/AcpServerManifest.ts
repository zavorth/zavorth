export const ZAVORTH_ACP_SERVER_CONTRACT_VERSION = '2026-06-25.acp-server/1' as const;

export type AcpServerCapability =
  | 'chat'
  | 'tools'
  | 'filesystem'
  | 'search'
  | 'shell'
  | 'web';

export type AcpServerToolDef = {
  name: string;
  description: string;
  requiresApproval: boolean;
  parameters?: Record<string, unknown>;
};

export type AcpServerManifestEntry = {
  id: string;
  enabled?: boolean;
  tools: AcpServerToolDef[];
  capabilities: AcpServerCapability[];
  maxConcurrentSessions?: number;
  sessionTimeoutMs?: number;
};

export type AcpServerManifest = {
  contractVersion: typeof ZAVORTH_ACP_SERVER_CONTRACT_VERSION;
  serverId: string;
  serverName: string;
  serverVersion: string;
  entries: AcpServerManifestEntry[];
};

export type AcpServerSessionStatus =
  | 'idle'
  | 'active'
  | 'completed'
  | 'failed'
  | 'blocked';

export type AcpServerSessionReceipt = {
  contractVersion: typeof ZAVORTH_ACP_SERVER_CONTRACT_VERSION;
  sessionId: string;
  serverId: string;
  startedAt: string;
  endedAt: string | null;
  status: AcpServerSessionStatus;
  toolCalls: Array<{
    name: string;
    approved: boolean;
    result: string;
    durationMs: number;
  }>;
  messagesProcessed: number;
  error: string | null;
};

export type AcpServerSnapshot = {
  contractVersion: typeof ZAVORTH_ACP_SERVER_CONTRACT_VERSION;
  generatedAt: string;
  serverId: string;
  status: 'starting' | 'listening' | 'connected' | 'stopped' | 'error';
  activeSessions: number;
  totalSessions: number;
  toolsRegistered: string[];
  capabilities: AcpServerCapability[];
  lastError: string | null;
};

export function buildDefaultManifest(serverId = 'zavorth-acp'): AcpServerManifest {
  return {
    contractVersion: ZAVORTH_ACP_SERVER_CONTRACT_VERSION,
    serverId,
    serverName: 'Zavorth ACP Server',
    serverVersion: '2.0.0',
    entries: [
      {
        id: 'default',
        enabled: true,
        capabilities: ['chat', 'tools', 'filesystem', 'search', 'shell', 'web'],
        maxConcurrentSessions: 4,
        sessionTimeoutMs: 300000,
        tools: [
          { name: 'Read', description: 'Read file contents', requiresApproval: false },
          { name: 'Glob', description: 'Find files by pattern', requiresApproval: false },
          { name: 'Grep', description: 'Search file contents', requiresApproval: false },
          { name: 'LS', description: 'List directory contents', requiresApproval: false },
          { name: 'Write', description: 'Write file contents', requiresApproval: true },
          { name: 'Edit', description: 'Edit file contents', requiresApproval: true },
          { name: 'Bash', description: 'Execute shell command', requiresApproval: true },
          { name: 'WebSearch', description: 'Search the web', requiresApproval: false },
        ],
      },
    ],
  };
}
