import { AgentWorkspaceConfig } from './AgentWorkspaceConfigService.js';
import { WorkspaceRuntimeReadinessIssue } from './WorkspaceRuntimeReadinessService.js';
import { ProviderConfigService } from './ProviderConfigService.js';
import { ProviderModelRegistry, type ProviderCapability } from './ProviderModelRegistry.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { LogRepository } from '../storage/LogRepository.js';

export interface WorkspacePolicyPreview {
  providerId?: string;
  modelId?: string;
  allowedCapabilities: string[];
  autonomyProfile: string;
  allowDeveloperMode: boolean;
  allowHostPowerMode: boolean;
  allowPty: boolean;
  allowTaskMandates: boolean;
  allowTemporaryDirectoryTrust: boolean;
  allowProviderFallback: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  warnings: WorkspaceRuntimeReadinessIssue[];
}

export class WorkspacePolicyPreviewService {
  private static instance: WorkspacePolicyPreviewService;

  private constructor() {}

  public static getInstance(): WorkspacePolicyPreviewService {
    if (!WorkspacePolicyPreviewService.instance) {
      WorkspacePolicyPreviewService.instance = new WorkspacePolicyPreviewService();
    }
    return WorkspacePolicyPreviewService.instance;
  }

  public async previewPolicy(workspaceId: string, partialConfig: Partial<AgentWorkspaceConfig>): Promise<WorkspacePolicyPreview> {
    const providerService = ProviderConfigService.getInstance();

    const warnings: WorkspaceRuntimeReadinessIssue[] = [];
    let riskScore = 0;

    const providerId = partialConfig.defaultProviderId;
    const modelId = partialConfig.defaultModelId;

    if (providerId) {
      const providerInfo = await providerService.getProvider(providerId);
      if (!providerInfo) {
        warnings.push({ code: 'provider_not_found', severity: 'error', message: 'Provider not found.' });
      } else {
        if (!providerInfo.enabled) {
          warnings.push({ code: 'provider_disabled', severity: 'warning', message: 'Provider is disabled.' });
        } else if (providerInfo.requiresApiKey && !providerInfo.secretRef) {
          warnings.push({ code: 'provider_missing_key', severity: 'error', message: 'Provider is missing API key.' });
        }

        if (modelId) {
          const capabilities = ProviderModelRegistry.getCapabilities(providerInfo.type, modelId);

          if (partialConfig.allowedCapabilities && partialConfig.allowedCapabilities.length > 0) {
            const unsupported = partialConfig.allowedCapabilities.filter(c => !ProviderModelRegistry.hasCapability(capabilities, c as ProviderCapability));
            if (unsupported.length > 0) {
              warnings.push({
                code: 'capability_not_supported',
                severity: 'warning',
                message: `Model does not support requested capabilities: ${unsupported.join(', ')}`
              });
            }
          }
        }
      }
    } else {
      warnings.push({ code: 'missing_default_provider', severity: 'warning', message: 'No default provider selected.' });
    }

    if (partialConfig.allowDeveloperMode) {
      warnings.push({ code: 'developer_mode_active', severity: 'warning', message: 'Developer Mode increases risk by exposing advanced tools.' });
      riskScore += 2;
    }

    if (partialConfig.allowHostPowerMode) {
      warnings.push({ code: 'hpm_active', severity: 'warning', message: 'Host Power Mode allows out-of-workspace commands.' });
      riskScore += 3;
    }

    if (partialConfig.allowPty) {
      if (!partialConfig.allowHostPowerMode) {
        warnings.push({ code: 'pty_requires_host_power_mode', severity: 'error', message: 'PTY requires Host Power Mode to be allowed.' });
      } else {
        warnings.push({ code: 'pty_active', severity: 'warning', message: 'PTY allows interactive terminal sessions.' });
        riskScore += 2;
      }
    }

    if (partialConfig.allowTemporaryDirectoryTrust) {
      warnings.push({ code: 'temp_trust_active', severity: 'info', message: 'Temporary directory trust is allowed.' });
      riskScore += 1;
    }

    if (partialConfig.allowProviderFallback) {
      warnings.push({ code: 'fallback_active', severity: 'info', message: 'Fallback may send prompt to another provider if the default fails.' });
    }

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (riskScore >= 5) riskLevel = 'CRITICAL';
    else if (riskScore >= 3) riskLevel = 'HIGH';
    else if (riskScore >= 1) riskLevel = 'MEDIUM';

    return {
      providerId,
      modelId,
      allowedCapabilities: partialConfig.allowedCapabilities || [],
      autonomyProfile: partialConfig.defaultAutonomyProfile || 'safe',
      allowDeveloperMode: partialConfig.allowDeveloperMode || false,
      allowHostPowerMode: partialConfig.allowHostPowerMode || false,
      allowPty: partialConfig.allowPty || false,
      allowTaskMandates: partialConfig.allowTaskMandates ?? true,
      allowTemporaryDirectoryTrust: partialConfig.allowTemporaryDirectoryTrust || false,
      allowProviderFallback: partialConfig.allowProviderFallback || false,
      riskLevel,
      warnings
    };
  }
}
