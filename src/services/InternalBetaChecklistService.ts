import { Database } from '../storage/Database.js';
import { TrustedWorkspaceService } from './TrustedWorkspaceService.js';
import { AgentWorkspaceConfigService } from './AgentWorkspaceConfigService.js';
import { ProviderConfigService } from './ProviderConfigService.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { logger } from '../logger.js';

export interface BetaChecklistItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'completed';
  manual: boolean;
}

export class InternalBetaChecklistService {
  private static instance: InternalBetaChecklistService;

  private constructor() {}

  public static getInstance(): InternalBetaChecklistService {
    if (!InternalBetaChecklistService.instance) {
      InternalBetaChecklistService.instance = new InternalBetaChecklistService();
    }
    return InternalBetaChecklistService.instance;
  }

  public async getChecklist(workspaceId: string): Promise<BetaChecklistItem[]> {
    const checklist: BetaChecklistItem[] = [];

    let workspaceTrusted = false;
    try {
      const trustService = await TrustedWorkspaceService.getInstance();
      const entry = trustService.getTrustEntry(workspaceId);
      workspaceTrusted = Boolean(entry && entry.trusted);
    } catch (error: unknown) {// Keep checklist rendering even when trust lookup fails.
      logger.warn('[Internal Beta Checklist] operation failed', error);
    }
    checklist.push({
      id: 'step_trust_workspace',
      title: 'Trust Workspace',
      description: 'Mark the current workspace as trusted to authorize actions.',
      status: workspaceTrusted ? 'completed' : 'pending',
      manual: false,
    });

    let providerConfigured = false;
    try {
      const providerService = ProviderConfigService.getInstance();
      const providers = await providerService.getProviders();
      providerConfigured = providers.some((provider: any) => provider.enabled && (!provider.requiresApiKey || provider.secretRef)); // eslint-disable-line @typescript-eslint/no-explicit-any
    } catch (error: unknown) {// Keep checklist rendering even when provider lookup fails.
      logger.warn('[Internal Beta Checklist] operation failed', error);
    }
    checklist.push({
      id: 'step_setup_provider',
      title: 'Configure AI Provider',
      description: 'Register at least one provider with any required API key.',
      status: providerConfigured ? 'completed' : 'pending',
      manual: false,
    });

    let defaultSelected = false;
    try {
      const config = await AgentWorkspaceConfigService.getInstance().getConfig(workspaceId);
      defaultSelected = Boolean(config.defaultProviderId && config.defaultModelId);
    } catch (error: unknown) {// Keep checklist rendering even when config lookup fails.
      logger.warn('[Internal Beta Checklist] operation failed', error);
    }
    checklist.push({
      id: 'step_select_defaults',
      title: 'Select Default Provider and Model',
      description: 'Choose the primary AI provider and model for workspace tasks.',
      status: defaultSelected ? 'completed' : 'pending',
      manual: false,
    });

    let configCustomized = false;
    try {
      const db = await Database.getInstance();
      const row = db.get('SELECT 1 FROM agent_workspace_config WHERE workspace_id = ?', [workspaceId]);
      configCustomized = Boolean(row);
    } catch (error: unknown) {// Keep checklist rendering even when the database lookup fails.
      logger.warn('[Internal Beta Checklist] operation failed', error);
    }
    checklist.push({
      id: 'step_customize_config',
      title: 'Customize Agent Settings',
      description: 'Save execution preferences such as PTY, Host Power Mode, and autonomy in Workspace Settings.',
      status: configCustomized ? 'completed' : 'pending',
      manual: false,
    });

    checklist.push({
      id: 'step_test_connection',
      title: 'Test Provider Connection',
      description: 'Use the provider panel Test Connection button to validate connectivity and headers without revealing secrets.',
      status: 'pending',
      manual: true,
    });

    checklist.push({
      id: 'step_execute_diagnostic_task',
      title: 'Run a Safe Read-Only Diagnostic Task',
      description: 'Start the autonomous agent on a local file-reading task and verify that the execution plan does not leak credentials.',
      status: 'pending',
      manual: true,
    });

    checklist.push({
      id: 'step_validate_locked_defaults',
      title: 'Validate Host Power Mode and PTY Locked Defaults',
      description: 'Verify that external shell commands and interactive sessions are blocked when HPM and PTY are disabled by workspace policy.',
      status: 'pending',
      manual: true,
    });

    checklist.push({
      id: 'step_validate_logs_redaction',
      title: 'Validate Secret Redaction in Logs',
      description: 'Inspect local logs and terminal output to confirm that keys, tokens, and confidential references are not exposed.',
      status: 'pending',
      manual: true,
    });

    checklist.push({
      id: 'step_test_revocation',
      title: 'Test Trust Revocation and Reset',
      description: 'Revoke workspace trust and validate that all associated command-grant sessions are invalidated.',
      status: 'pending',
      manual: true,
    });

    try {
      const logger = new SecurityAuditLogger();
      await logger.logWorkspaceEvent({
        event: 'internal_beta_checklist_viewed',
        workspaceId,
        metadata: {
          stepsCompleted: checklist.filter((item) => item.status === 'completed').length,
          totalSteps: checklist.length,
        },
      });
    } catch (error: unknown) {// Checklist rendering should not depend on audit logging availability.
      logger.warn('[Internal Beta Checklist] operation failed', error);
    }

    return checklist;
  }
}
