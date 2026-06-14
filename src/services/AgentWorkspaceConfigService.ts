import { Database } from '../storage/Database.js';

export interface AgentWorkspaceConfig {
  workspaceId: string;
  defaultProviderId?: string;
  defaultModelId?: string;
  allowedCapabilities: Array<'chat' | 'tool_calling' | 'vision' | 'audio' | 'json' | 'reasoning' | 'embedding'>;
  defaultAutonomyProfile: 'safe' | 'developer';
  allowDeveloperMode: boolean;
  allowHostPowerMode: boolean;
  allowPty: boolean;
  allowTaskMandates: boolean;
  allowTemporaryDirectoryTrust: boolean;
  allowProviderFallback: boolean;
  createdAt: string;
  updatedAt: string;
}

export class AgentWorkspaceConfigService {
  private static instance: AgentWorkspaceConfigService;

  private constructor() {}

  public static getInstance(): AgentWorkspaceConfigService {
    if (!AgentWorkspaceConfigService.instance) {
      AgentWorkspaceConfigService.instance = new AgentWorkspaceConfigService();
    }
    return AgentWorkspaceConfigService.instance;
  }

  public static getDefaultConfig(workspaceId: string = 'unknown'): AgentWorkspaceConfig {
    return {
      workspaceId,
      allowedCapabilities: ['chat'],
      defaultAutonomyProfile: 'safe',
      allowDeveloperMode: false,
      allowHostPowerMode: false,
      allowPty: false,
      allowTaskMandates: true,
      allowTemporaryDirectoryTrust: false,
      allowProviderFallback: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  public async getConfig(workspaceId: string): Promise<AgentWorkspaceConfig> {
    const db = await Database.getInstance();
    const row = db.get('SELECT * FROM agent_workspace_config WHERE workspace_id = ?', [workspaceId]);

    if (!row) {
      return AgentWorkspaceConfigService.getDefaultConfig(workspaceId);
    }

    return {
      workspaceId: row.workspace_id,
      defaultProviderId: row.default_provider_id || undefined,
      defaultModelId: row.default_model_id || undefined,
      allowedCapabilities: JSON.parse(row.allowed_capabilities),
      defaultAutonomyProfile: row.default_autonomy_profile as 'safe' | 'developer',
      allowDeveloperMode: row.allow_developer_mode === 1,
      allowHostPowerMode: row.allow_host_power_mode === 1,
      allowPty: row.allow_pty === 1,
      allowTaskMandates: row.allow_task_mandates === 1,
      allowTemporaryDirectoryTrust: row.allow_temporary_directory_trust === 1,
      allowProviderFallback: row.allow_provider_fallback === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public async updateConfig(
    workspaceId: string, 
    update: Partial<Omit<AgentWorkspaceConfig, 'workspaceId' | 'createdAt' | 'updatedAt'>>
  ): Promise<AgentWorkspaceConfig> {
    const current = await this.getConfig(workspaceId);
    const db = await Database.getInstance();

    const merged: AgentWorkspaceConfig = {
      ...current,
      ...update,
      workspaceId,
      updatedAt: new Date().toISOString()
    };

    db.run(`
      INSERT INTO agent_workspace_config (
        workspace_id, default_provider_id, default_model_id, allowed_capabilities, 
        default_autonomy_profile, allow_developer_mode, allow_host_power_mode, 
        allow_pty, allow_task_mandates, allow_temporary_directory_trust, 
        allow_provider_fallback, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id) DO UPDATE SET
        default_provider_id = excluded.default_provider_id,
        default_model_id = excluded.default_model_id,
        allowed_capabilities = excluded.allowed_capabilities,
        default_autonomy_profile = excluded.default_autonomy_profile,
        allow_developer_mode = excluded.allow_developer_mode,
        allow_host_power_mode = excluded.allow_host_power_mode,
        allow_pty = excluded.allow_pty,
        allow_task_mandates = excluded.allow_task_mandates,
        allow_temporary_directory_trust = excluded.allow_temporary_directory_trust,
        allow_provider_fallback = excluded.allow_provider_fallback,
        updated_at = excluded.updated_at
    `, [
      merged.workspaceId,
      merged.defaultProviderId || null,
      merged.defaultModelId || null,
      JSON.stringify(merged.allowedCapabilities),
      merged.defaultAutonomyProfile,
      merged.allowDeveloperMode ? 1 : 0,
      merged.allowHostPowerMode ? 1 : 0,
      merged.allowPty ? 1 : 0,
      merged.allowTaskMandates ? 1 : 0,
      merged.allowTemporaryDirectoryTrust ? 1 : 0,
      merged.allowProviderFallback ? 1 : 0,
      current.createdAt,
      merged.updatedAt
    ]);

    return merged;
  }
}
