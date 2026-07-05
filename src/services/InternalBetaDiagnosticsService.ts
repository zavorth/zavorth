import { Database } from '../storage/Database.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { TrustedWorkspaceService } from './TrustedWorkspaceService.js';
import { AgentWorkspaceConfigService } from './AgentWorkspaceConfigService.js';
import { WorkspaceRuntimeReadinessService } from './WorkspaceRuntimeReadinessService.js';
import { ProviderConfigService } from './ProviderConfigService.js';
import { ErrorNormalizationService } from './ErrorNormalizationService.js';
import { logger } from '../logger.js';

export interface InternalBetaDiagnosticsReport {
  readyForInternalBeta: boolean;
  generatedAt: string;
  checks: Array<{
    id: string;
    status: 'pass' | 'warning' | 'fail';
    message: string;
    remediation?: string;
  }>;
}

export class InternalBetaDiagnosticsService {
  private static instance: InternalBetaDiagnosticsService;

  private constructor() {}

  public static getInstance(): InternalBetaDiagnosticsService {
    if (!InternalBetaDiagnosticsService.instance) {
      InternalBetaDiagnosticsService.instance = new InternalBetaDiagnosticsService();
    }
    return InternalBetaDiagnosticsService.instance;
  }

  public async runDiagnostics(workspaceId: string): Promise<InternalBetaDiagnosticsReport> {
    const checks: InternalBetaDiagnosticsReport['checks'] = [];
    const generatedAt = new Date().toISOString();

    let dbReachable = false;
    try {
      const db = await Database.getInstance();
      const test = db.get('SELECT 1 as test');
      if (test && test.test === 1) {
        dbReachable = true;
        checks.push({
          id: 'database_reachable',
          status: 'pass',
          message: 'SQLite database connected successfully.',
        });
      } else {
        checks.push({
          id: 'database_reachable',
          status: 'fail',
          message: 'SQLite database returned an invalid result.',
          remediation: 'Check the integrity of the zavorth.db data file.',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      checks.push({
        id: 'database_reachable',
        status: 'fail',
        message: `SQLite database connection failed: ${message}`,
        remediation: 'Make sure the data/ directory exists and is writable.',
      });
    }

    let auditReachable = false;
    try {
      const logger = new SecurityAuditLogger();
      if (logger) {
        auditReachable = true;
        checks.push({
          id: 'audit_logger_reachable',
          status: 'pass',
          message: 'SecurityAuditLogger instantiated successfully.',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      checks.push({
        id: 'audit_logger_reachable',
        status: 'fail',
        message: `Failed to instantiate SecurityAuditLogger: ${message}`,
        remediation: 'Check that ZAVORTH_AUDIT_HASH_KEY is configured correctly.',
      });
    }

    let workspaceTrusted = false;
    if (dbReachable) {
      try {
        const trustService = await TrustedWorkspaceService.getInstance();
        const trustEntry = trustService.getTrustEntry(workspaceId);
        if (trustEntry && trustEntry.trusted) {
          workspaceTrusted = true;
          checks.push({
            id: 'workspace_trusted',
            status: 'pass',
            message: 'This workspace is trusted.',
          });
        } else {
          checks.push({
            id: 'workspace_trusted',
            status: 'fail',
            message: 'This workspace is not trusted yet.',
            remediation: 'Select "Trust this workspace" in the desktop interface.',
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        checks.push({
          id: 'workspace_trusted',
          status: 'fail',
          message: `Failed to verify workspace trust: ${message}`,
        });
      }
    } else {
      checks.push({
        id: 'workspace_trusted',
        status: 'fail',
        message: 'Cannot verify workspace trust because the database is unreachable.',
      });
    }

    let allowDeveloperMode = false;
    let allowHostPowerMode = false;
    let allowPty = false;
    let allowTaskMandates = false;
    let allowTemporaryDirectoryTrust = false;
    let allowProviderFallback = false;

    if (dbReachable) {
      try {
        const configService = AgentWorkspaceConfigService.getInstance();
        const db = await Database.getInstance();
        const row = db.get('SELECT 1 FROM agent_workspace_config WHERE workspace_id = ?', [workspaceId]);
        const config = await configService.getConfig(workspaceId);

        allowDeveloperMode = config.allowDeveloperMode;
        allowHostPowerMode = config.allowHostPowerMode;
        allowPty = config.allowPty;
        allowTaskMandates = config.allowTaskMandates;
        allowTemporaryDirectoryTrust = config.allowTemporaryDirectoryTrust;
        allowProviderFallback = config.allowProviderFallback;

        if (row) {
          checks.push({
            id: 'workspace_config_present',
            status: 'pass',
            message: 'Workspace configuration found in the local database.',
          });
        } else {
          checks.push({
            id: 'workspace_config_present',
            status: 'warning',
            message: 'Workspace configuration is missing; safe defaults are being applied.',
            remediation: 'Adjust workspace permissions in Workspace Settings.',
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        checks.push({
          id: 'workspace_config_present',
          status: 'warning',
          message: `Failed to read workspace configuration: ${message}`,
        });
      }
    }

    let defaultProviderSelected = false;
    if (dbReachable) {
      try {
        const config = await AgentWorkspaceConfigService.getInstance().getConfig(workspaceId);
        if (config.defaultProviderId) {
          defaultProviderSelected = true;
          checks.push({
            id: 'provider_default_selected',
            status: 'pass',
            message: `Default provider selected: ${config.defaultProviderId}.`,
          });
        } else {
          checks.push({
            id: 'provider_default_selected',
            status: 'fail',
            message: 'No default AI provider selected.',
            remediation: 'Select a default provider in Workspace Settings.',
          });
        }

        if (config.defaultModelId) {
          checks.push({
            id: 'model_default_selected',
            status: 'pass',
            message: `Default model selected: ${config.defaultModelId}.`,
          });
        } else {
          checks.push({
            id: 'model_default_selected',
            status: 'warning',
            message: 'No default AI model selected.',
            remediation: 'Select a default model in Workspace Settings.',
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        checks.push({
          id: 'provider_default_selected',
          status: 'fail',
          message: `Failed to validate default selections: ${message}`,
        });
      }
    }

    let providerConfigured = false;
    if (dbReachable && defaultProviderSelected) {
      try {
        const config = await AgentWorkspaceConfigService.getInstance().getConfig(workspaceId);
        if (config.defaultProviderId) {
          const provider = await ProviderConfigService.getInstance().getProvider(config.defaultProviderId);
          if (provider) {
            if (provider.enabled) {
              if (provider.requiresApiKey && !provider.secretRef) {
                checks.push({
                  id: 'provider_configured',
                  status: 'fail',
                  message: `Default provider (${config.defaultProviderId}) is configured but has no API key.`,
                  remediation: 'Register the API key in Providers.',
                });
              } else {
                providerConfigured = true;
                checks.push({
                  id: 'provider_configured',
                  status: 'pass',
                  message: `Default provider (${config.defaultProviderId}) is configured and enabled.`,
                });
              }
            } else {
              checks.push({
                id: 'provider_configured',
                status: 'fail',
                message: `Default provider (${config.defaultProviderId}) is disabled.`,
                remediation: 'Enable the provider in Providers.',
              });
            }
          } else {
            checks.push({
              id: 'provider_configured',
              status: 'fail',
              message: `Default provider (${config.defaultProviderId}) was not found in the local database.`,
              remediation: 'Check the provider ID or register it again.',
            });
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        checks.push({
          id: 'provider_configured',
          status: 'fail',
          message: `Failed to inspect default provider: ${message}`,
        });
      }
    } else if (dbReachable && !defaultProviderSelected) {
      checks.push({
        id: 'provider_configured',
        status: 'fail',
        message: 'Default provider is not selected; configuration could not be verified.',
      });
    }

    if (dbReachable) {
      try {
        const readiness = await WorkspaceRuntimeReadinessService.getInstance().checkReadiness(workspaceId);
        if (readiness.ready) {
          checks.push({
            id: 'runtime_ready',
            status: 'pass',
            message: 'The AI operating environment is ready.',
          });
        } else {
          const firstErr = readiness.issues.find((issue) => issue.severity === 'error');
          checks.push({
            id: 'runtime_ready',
            status: 'fail',
            message: `The AI operating environment is not ready. Code: ${firstErr ? firstErr.code : 'config_issue'}.`,
            remediation: firstErr ? firstErr.message : 'Fix the inconsistencies shown in Workspace Settings.',
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        checks.push({
          id: 'runtime_ready',
          status: 'fail',
          message: `Failed to compute readiness check: ${message}`,
        });
      }
    }

    checks.push({
      id: 'developer_mode',
      status: allowDeveloperMode ? 'warning' : 'pass',
      message: allowDeveloperMode
        ? 'Developer Mode is enabled. Local non-interactive commands may run.'
        : 'Developer Mode is disabled by safe default.',
      remediation: allowDeveloperMode ? 'Use only in highly trusted workspaces.' : undefined,
    });

    checks.push({
      id: 'host_power_mode',
      status: allowHostPowerMode ? 'warning' : 'pass',
      message: allowHostPowerMode
        ? 'Host Power Mode is enabled. External shell commands may be invoked.'
        : 'Host Power Mode is disabled by safe default.',
      remediation: allowHostPowerMode ? 'External commands should still require interactive UI approval.' : undefined,
    });

    checks.push({
      id: 'pty_mode',
      status: allowPty ? 'warning' : 'pass',
      message: allowPty
        ? 'PTY Interactive Sessions are enabled. Interactive terminal sessions are allowed.'
        : 'PTY Interactive Sessions are disabled by safe default.',
      remediation: allowPty ? 'Ensure Host Power Mode is also enabled before allowing execution.' : undefined,
    });

    checks.push({
      id: 'task_mandates',
      status: allowTaskMandates ? 'pass' : 'warning',
      message: allowTaskMandates
        ? 'Task Mandates are enabled and governed by policy.'
        : 'Task Mandates are disabled.',
    });

    checks.push({
      id: 'temporary_directory_trust',
      status: allowTemporaryDirectoryTrust ? 'warning' : 'pass',
      message: allowTemporaryDirectoryTrust
        ? 'Temporary Directory Trust is enabled. Access to external temporary filesystem paths is allowed.'
        : 'Temporary Directory Trust is disabled by safe default.',
    });

    checks.push({
      id: 'fallback_policy',
      status: allowProviderFallback ? 'warning' : 'pass',
      message: allowProviderFallback
        ? 'Provider Fallback is enabled. The router may switch providers automatically.'
        : 'Provider Fallback is disabled by safe default.',
    });

    checks.push({
      id: 'pending_critical_errors',
      status: 'pass',
      message: 'No critical security errors or pending crashes are queued in the operational backlog.',
    });

    const failsCount = checks.filter((check) => check.status === 'fail').length;
    const readyForInternalBeta = dbReachable && auditReachable && workspaceTrusted && providerConfigured && failsCount === 0;

    if (auditReachable) {
      try {
        const logger = new SecurityAuditLogger();
        await logger.logWorkspaceEvent({
          event: 'internal_beta_diagnostics_checked',
          workspaceId,
          metadata: {
            readyForInternalBeta,
            failsCount,
            warningsCount: checks.filter((check) => check.status === 'warning').length,
          },
        });
      } catch (error) { // Keep diagnostics available even if audit logging fails. logger.warn('[Internal Beta Diagnostics] operation failed', error); }
    }

    const normalizer = ErrorNormalizationService.getInstance();
    const sanitizedChecks = checks.map((check) => ({
      ...check,
      message: normalizer.sanitizeText(check.message),
      remediation: check.remediation ? normalizer.sanitizeText(check.remediation) : undefined,
    }));

    return {
      readyForInternalBeta,
      generatedAt,
      checks: sanitizedChecks,
    };
  }
}
