import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  InstalledIntegrationState,
  IntegrationDoctorFinding,
  IntegrationDoctorPlaybookStep,
  IntegrationDoctorSnapshot,
  IntegrationManifest,
  IntegrationProbeSnapshot,
} from '../contracts/IntegrationHubContract.js';
import { IntegrationInstallerService } from './IntegrationInstallerService.js';

import { IntegrationProbeService } from './IntegrationProbeService.js';
import { IntegrationRegistryService } from './IntegrationRegistryService.js';
import { SidecarStatusService } from './SidecarStatusService.js';
import {
  EXTERNAL_EXECUTOR_ID,} from '../execution/ExternalExecutor.js';

type HealthRuntime = {
  now?: () => Date;
  doctorReportFile?: string;
  installerService?: IntegrationInstallerService;
  registryService?: IntegrationRegistryService;
  probeService?: IntegrationProbeService;
  sidecarStatusService?: Pick<SidecarStatusService, 'readSummary'>;
};

export class IntegrationHealthService {
  private readonly now: () => Date;
  private readonly doctorReportFile: string;
  private readonly installerService: IntegrationInstallerService;
  private readonly registryService: IntegrationRegistryService;
  private readonly probeService: IntegrationProbeService;
  private readonly sidecarStatusService: Pick<SidecarStatusService, 'readSummary'>;

  constructor(runtime: HealthRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.doctorReportFile = runtime.doctorReportFile || config.integrationHubDoctorReportFile;
    this.installerService = runtime.installerService || new IntegrationInstallerService();
    this.registryService = runtime.registryService || new IntegrationRegistryService();
    this.probeService = runtime.probeService || new IntegrationProbeService({
      registryService: this.registryService,
    });
    this.sidecarStatusService = runtime.sidecarStatusService || new SidecarStatusService();
  }

  public buildDoctorSnapshot(integrationId: string): IntegrationDoctorSnapshot {
    const manifest = this.registryService.getManifestById(integrationId);
    if (!manifest) {
      throw new Error(`Unknown integration: ${integrationId}`);
    }

    const installed = this.installerService.getInstalled(manifest.id);
    const probe = this.probeService.getLatestProbe(manifest.id);
    const findings = this.buildFindings(manifest, installed, probe);
    const status = findings.some((entry) => entry.level === 'error') ? 'error'
      : findings.some((entry) => entry.level === 'warn') ? 'warn'
        : 'ok';
    const runtimeReady = this.isRuntimeReady(manifest);
    const configured = Boolean(installed) || runtimeReady;
    const playbook = this.buildPlaybook(manifest, installed, probe, status);

    return {
      generatedAt: this.now().toISOString(),
      integrationId: manifest.id,
      label: manifest.label,
      nickname: installed?.nickname || null,
      status,
      binding: {
        ...manifest.binding,
        status: runtimeReady ? 'ready'
          : manifest.binding.status === 'ready'
            ? 'partial'
            : manifest.binding.status,
      },
      configured,
      selectedMode: installed?.selectedMode || null,
      enabledCapabilities: installed?.enabledCapabilities || manifest.capabilities.slice(),
      probe,
      findings,
      playbook,
      nextAction: this.buildNextAction(manifest, installed, findings, probe),
    };
  }

  public listDoctorSnapshots(): IntegrationDoctorSnapshot[] {
    return this.registryService
      .listManifests()
      .map((manifest) => this.buildDoctorSnapshot(manifest.id));
  }

  public writeDoctorReport(integrationId?: string | null): IntegrationDoctorSnapshot | IntegrationDoctorSnapshot[] {
    const payload = integrationId ? this.buildDoctorSnapshot(integrationId) : this.listDoctorSnapshots();
    fs.mkdirSync(path.dirname(this.doctorReportFile), { recursive: true });
    fs.writeFileSync(this.doctorReportFile, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
  }

  private buildFindings(
    manifest: IntegrationManifest,
    installed: InstalledIntegrationState | null,
    probe: IntegrationProbeSnapshot | null,
  ): IntegrationDoctorFinding[] {
    const findings: IntegrationDoctorFinding[] = [];
    const runtimeReady = this.isRuntimeReady(manifest);
    const missingRequirements = this.installerService.getMissingRequirements(manifest, installed);
    const unansweredQuestions = this.installerService.getUnansweredQuestions(manifest, installed);
    const repairableRuntimeBindings = this.getRepairableRuntimeBindings(manifest, installed);

    if (manifest.supportLevel === 'experimental') {
      findings.push({
        level: 'warn',
        title: 'Experimental integration',
        detail: 'The recipe exists but does not yet have production maturity in Zavorth.',
      });
    }

    if (manifest.supportLevel === 'template') {
      findings.push({
        level: 'warn',
        title: 'Template, not a ready integration',
        detail: 'This item is meant to guide a new connector and still depends on specific implementation.',
      });
    }

    if (!installed && !runtimeReady) {
      findings.push({
        level: 'warn',
        title: 'Not prepared yet',
        detail: 'No onboarding draft was saved and the runtime also did not detect a ready configuration.',
      });
    }

    if (!runtimeReady && unansweredQuestions.length > 0) {
      findings.push({
        level: 'warn',
        title: 'Incomplete onboarding',
        detail: `${unansweredQuestions.length} basic answer(s) still missing to close the integration plan.`,
      });
    }

    if (!runtimeReady && missingRequirements.length > 0) {
      findings.push({
        level: 'warn',
        title: 'Pending requirements',
        detail: `Still missing ${missingRequirements.map((entry) => entry.label).join(', ')}.`,
      });
    }

    if (installed && repairableRuntimeBindings.length > 0 && !runtimeReady && this.dependsOnRuntimeCredential(manifest)) {
      findings.push({
        level: 'warn',
        title: 'Configuration saved but not applied in runtime',
        detail:
          'The hub already received the necessary configuration, but the current Zavorth binding still depends on applying these values in the local runtime to become truly healthy.',
      });
    }

    if (runtimeReady) {
      findings.push({
        level: 'info',
        title: 'Runtime detected',
        detail: 'Zavorth already sees signs that this integration is ready for real use.',
      });
    } else if (manifest.binding.status === 'ready') {
      findings.push({
        level: 'warn',
        title: 'Binding exists but is not ready',
        detail: 'The runtime knows how to talk to this integration, but credentials, sidecar, or binary are missing.',
      });
    } else {
      findings.push({
        level: 'info',
        title: 'Recipe available',
        detail: manifest.binding.summary,
      });
    }

    if (probe) {
      if (probe.status === 'ok') {
        findings.push({
          level: 'info',
          title: 'Live probe passed',
          detail: `${probe.summary}. ${probe.detail}`,
        });
      } else if (probe.status === 'failed') {
        findings.push({
          level: 'error',
          title: 'Live probe failed',
          detail: `${probe.summary}. ${probe.detail}`,
        });
      } else if (probe.status === 'not_configured') {
        findings.push({
          level: 'warn',
          title: 'Live probe could not authenticate',
          detail: probe.detail,
        });
      } else if (probe.status === 'unsupported') {
        findings.push({
          level: 'info',
          title: 'Live probe not available yet',
          detail: probe.detail,
        });
      }
    }

    if (findings.length === 0) {
      findings.push({
        level: 'info',
        title: 'No alerts',
        detail: 'The integration seems consistent with the current hub state.',
      });
    }

    return findings;
  }

  private buildNextAction(
    manifest: IntegrationManifest,
    installed: InstalledIntegrationState | null,
    findings: IntegrationDoctorFinding[],
    probe: IntegrationProbeSnapshot | null,
  ): IntegrationDoctorSnapshot['nextAction'] {
    const highest = findings.find((entry) => entry.level === 'error') || findings.find((entry) => entry.level === 'warn');
    const runtimeReady = this.isRuntimeReady(manifest);
    const repairableRuntimeBindings = this.getRepairableRuntimeBindings(manifest, installed);

    if (probe?.status === 'failed') {
      return {
        label: 'Revalidate integration',
        command: 'use the Integration Hub assisted flow',
        reason: highest?.detail || 'The binding seems configured, but the live probe still failed.',
      };
    }

    if (manifest.id === 'AIGateway' && !runtimeReady && config.AIGatewaySidecarEnabled) {
      return {
        label: 'Start AIGateway sidecar',
        command: 'use the Integration Hub assisted flow',
        reason: highest?.detail || 'The local gateway has not responded yet; the safe next step is to start the sidecar from the hub.',
      };
    }

    if (manifest.id === 'zavorth-terminal' && !runtimeReady && config.ZavorthTerminalSidecarEnabled) {
      return {
        label: 'Start ZavorthBridge Remote sidecar',
        command: 'use the Integration Hub assisted flow',
        reason: highest?.detail || 'The ZavorthBridge remote has not responded yet; the safe next step is to start the sidecar from the hub.',
      };
    }

    if (manifest.id === 'oracle-cloudflare-gemma' && !runtimeReady) {
      return {
        label: 'Complete Oracle + Cloudflare rollout',
        command: 'npm run ops:oracle-cloudflare',
        reason: highest?.detail || 'Basic signals from the recommended remote architecture are still missing.',
      };
    }

    if (!installed) {
      return {
        label: runtimeReady ? 'Register in hub' : 'Open onboarding',
        command: runtimeReady ? `/connect ${manifest.id}` : `npm run integrations:show -- --id ${manifest.id}`,
        reason: highest?.detail || (runtimeReady ? 'The runtime already looks ready; now preferences and scope need to be registered in the hub.'
          : 'No saved draft exists for this integration yet.'),
      };
    }

    if (manifest.id === 'ollama' && !this.resolveOllamaHost()) {
      return {
        label: 'Prepare local Ollama host',
        command: 'use the Integration Hub assisted flow',
        reason: highest?.detail || 'Before validating Ollama, Zavorth needs to know which local host to test.',
      };
    }

    if (!runtimeReady && repairableRuntimeBindings.length > 0) {
      return {
        label: 'Repair runtime binding',
        command: 'use the Integration Hub assisted flow',
        reason: highest?.detail || 'The hub already has enough configuration to attempt automatic binding repair.',
      };
    }

    if (!runtimeReady) {
      return {
        label: 'Revalidate integration',
        command: `npm run integrations:doctor -- --id ${manifest.id}`,
        reason: highest?.detail || 'Health signals are still missing in the runtime.',
      };
    }

    return {
      label: 'Use in Zavorth',
      command: `/connect ${manifest.id}`,
      reason: 'The integration already seems ready to join the normal Zavorth flow.',
    };
  }

  private buildPlaybook(
    manifest: IntegrationManifest,
    installed: InstalledIntegrationState | null,
    probe: IntegrationProbeSnapshot | null,
    status: IntegrationDoctorSnapshot['status'],
  ): NonNullable<IntegrationDoctorSnapshot['playbook']> {
    const runtimeReady = this.isRuntimeReady(manifest);
    const unansweredQuestions = this.installerService.getUnansweredQuestions(manifest, installed);
    const missingRequirements = this.installerService.getMissingRequirements(manifest, installed);
    const repairableRuntimeBindings = this.getRepairableRuntimeBindings(manifest, installed);
    const steps: IntegrationDoctorPlaybookStep[] = [];

    steps.push({
      id: 'onboarding',
      label: unansweredQuestions.length > 0 ? 'Fechar onboarding' : 'Onboarding coberto',
      detail: unansweredQuestions.length > 0
        ? `Still missing ${unansweredQuestions.length} response(s): ${unansweredQuestions.map((entry) => entry.label).join(', ')}.`
        : 'As perguntas basic desta integration already foram answered no hub.',
      kind: 'guided',
      status: unansweredQuestions.length > 0 ? 'next' : 'done',
      command: `/connect ${manifest.id}`,
    });

    if (repairableRuntimeBindings.length > 0) {
      steps.push({
        id: 'repair-runtime',
        label: 'Apply saved configuration to runtime',
        detail: `O hub already recebeu ${repairableRuntimeBindings.map((entry) => entry.label).join(', ')} e pode try ativar esse binding without repetir o onboarding.`,
        kind: 'automatic',
        status: runtimeReady ? 'done' : 'next',
        actionId: 'repair-runtime',
        command: 'usar Assisted flow do Integration Hub',
      });
    } else if (missingRequirements.length > 0) {
      steps.push({
        id: 'requirements',
        label: 'Completar requisitos pending',
        detail: `Still missing ${missingRequirements.map((entry) => entry.label).join(', ')} for the runtime to become truly ready.`,
        kind: 'manual',
        status: runtimeReady ? 'optional' : (unansweredQuestions.length > 0 ? 'pending' : 'next'),
        command: `npm run integrations:show -- --id ${manifest.id}`,
      });
    }

    if (manifest.id === 'AIGateway' && !runtimeReady && config.AIGatewaySidecarEnabled) {
      steps.push({
        id: 'AIGateway-sidecar',
        label: 'Subir sidecar AIGateway',
        detail: 'The local gateway has not responded yet. The next safe step is starting the sidecar through the hub itself.',
        kind: 'automatic',
        status: 'next',
        actionId: 'recipe:AIGateway:start-sidecar',
        command: 'usar Assisted flow do Integration Hub',
      });
    }

    if (manifest.id === 'zavorth-terminal' && !runtimeReady && config.ZavorthTerminalSidecarEnabled) {
      steps.push({
        id: 'zavorth-bridge-remote-sidecar',
        label: 'Subir sidecar ZavorthBridge Remote',
        detail: 'The ZavorthBridge remote has not responded yet. The next safe step is starting the remote sidecar through the hub itself.',
        kind: 'automatic',
        status: 'next',
        actionId: 'recipe:zavorth-bridge-remote:start-sidecar',
        command: 'usar Assisted flow do Integration Hub',
      });
    }

    if (manifest.id === 'ollama' && installed && !runtimeReady) {
      steps.push({
        id: 'ollama-host',
        label: 'Prepare local Ollama host',
        detail: 'The draft exists, but the runtime does not know which local endpoint to use to talk to Ollama yet.',
        kind: 'automatic',
        status: 'next',
        actionId: 'recipe:ollama:prepare-host',
        command: 'usar Assisted flow do Integration Hub',
      });
    }

    steps.push({
      id: 'validate',
      label: probe?.status === 'ok' ? 'Validation final completed' : 'run validation final',
      detail: probe?.status === 'ok'
        ? `O latest probe real respondeu bem: ${probe.summary}.`
        : (probe?.status === 'failed'
          ? `O latest probe real ainda failed: ${probe.summary}. Corrija o binding e valide de novo.`
          : 'Use "Validate now" to confirm the integration really responds and does not merely look configured.'),
      kind: 'verification',
      status: probe?.status === 'ok' ? 'done' : ((unansweredQuestions.length > 0 || missingRequirements.length > 0) ? 'pending' : 'next'),
      actionId: 'validate-now',
      command: 'usar Assisted flow do Integration Hub',
    });

    if (status === 'ok') {
      steps.push({
        id: 'use-runtime',
        label: 'Usar no Zavorth',
        detail: 'The integration is already ready to enter routing and be used in conversations and automations.',
        kind: 'guided',
        status: 'done',
        command: `/connect ${manifest.id}`,
      });
    }

    const headline = status === 'ok'
      ? 'Integration ready for use'
      : status === 'error'
        ? 'There is a real block to fix'
        : 'missing alguns passos para fechar a integration';
    const summary = status === 'ok'
      ? 'O hub enxerga binding e validation coerentes para is integration.'
      : status === 'error'
        ? 'Follow the step marked as "next" first; the others support integration stabilization.'
        : 'Start with the step marked as "next". When it is resolved, the rest of the path becomes simpler.';

    return {
      headline,
      summary,
      steps,
    };
  }

  private isRuntimeReady(manifest: IntegrationManifest): boolean {
    if (manifest.id === EXTERNAL_EXECUTOR_ID) {
      return this.looksUsableCommand(this.resolveExternalExecutorCliPath());
    }

    switch (manifest.id) {
      case 'oracle-cloudflare-gemma':
        return Boolean(
          (config.cloudflareTunnelPublicHostname || config.zavorthPublicBaseUrl) &&
          config.cloudflareAiGatewayEnabled &&
          (config.geminiApiKey || config.aiStudioApiKey),
        );
      case 'gemini':
        return Boolean(config.geminiApiKey || config.aiStudioApiKey);
      case 'openai':
        return Boolean(config.openaiApiKey || config.openaiApiKeys?.length > 0);
      case 'minimax':
        return Boolean(config.minimaxApiKey);
      case 'openrouter':
        return Boolean(config.openRouterApiKey);
      case 'opencode':
        return Boolean(config.openCodeApiKey);
      case 'AIGateway':
        return Boolean(this.sidecarStatusService.readSummary().AIGateway.ready);
      case 'zavorth-terminal':
        return Boolean(this.sidecarStatusService.readSummary().ZavorthTerminal.ready);
      case 'ollama':
        return Boolean(this.resolveOllamaHost());
      case 'telegram':
        return Boolean(String(config.telegramBotToken || '').trim() && (config.allowedUserIds || []).length > 0);
      case 'discord':
        return Boolean(
          String(config.discordBotToken || '').trim()
          && (
            config.discordPublicServerMode
            || ((config.discordAllowedGuildIds || []).length > 0 && (config.discordOwnerUserIds || []).length > 0)
          ),
        );
      case 'slack':
        if (!config.slackEnabled) {
          return false;
        }
        if (config.slackTransport === 'local') {
          return true;
        }
        return Boolean(
          config.slackTransport === 'native'
          && String(config.slackBotToken || '').trim()
          && String(config.slackSigningSecret || '').trim()
          && (config.slackAllowedChannelIds || []).length > 0,
        );
      case 'whatsapp':
        if (!config.whatsappEnabled) {
          return false;
        }
        if (config.whatsappProvider === 'local') {
          return true;
        }
        if (config.whatsappProvider === 'baileys') {
          return Boolean(String(config.whatsappSessionDir || '').trim());
        }
        return Boolean(
          String(config.whatsappPhoneNumberId || '').trim()
          && String(config.whatsappAccessToken || '').trim()
          && String(config.whatsappWebhookVerifyToken || '').trim(),
        );
      case 'composio':
        return Boolean(String(process.env.COMPOSIO_API_KEY || '').trim());
      case 'nango':
        return Boolean(String(process.env.NANGO_SECRET_KEY || process.env.NANGO_ACTION_EXECUTE_URL || '').trim());
      case 'pipedream':
        return Boolean(String(process.env.PIPEDREAM_API_KEY || process.env.PIPEDREAM_HEALTH_URL || process.env.PIPEDREAM_EXECUTE_URL || '').trim());
      case 'zapier':
        return Boolean(String(process.env.ZAPIER_API_KEY || process.env.ZAPIER_HEALTH_URL || process.env.ZAPIER_EXECUTE_URL || '').trim());
      case 'n8n':
        return Boolean(String(process.env.N8N_BASE_URL || process.env.N8N_HEALTH_URL || process.env.N8N_EXECUTE_URL || '').trim());
      case 'workato':
        return Boolean(String(process.env.WORKATO_API_TOKEN || process.env.WORKATO_HEALTH_URL || process.env.WORKATO_EXECUTE_URL || '').trim());
      case 'copilot':
        return false;
      default:
        return false;
    }
  }

  private dependsOnRuntimeCredential(manifest: IntegrationManifest): boolean {
    return manifest.requirements.some((entry) => entry.type === 'env' && Boolean(entry.envKey));
  }

  private looksUsableCommand(commandValue: string | null | undefined): boolean {
    const normalized = String(commandValue || '').trim();
    if (!normalized) {
      return false;
    }

    if (!/[\\/]/.test(normalized)) {
      return true;
    }

    return fs.existsSync(normalized);
  }

  private resolveExternalExecutorCliPath(): string | null {
    const runtimeConfig = config as Record<string, unknown>;
    const legacyConfigKey = `${['open', 'claw'].join('')}CliPath`;
    const value = String(runtimeConfig.externalExecutorCliPath || runtimeConfig[legacyConfigKey] || '').trim();
    return value || null;
  }

  private resolveOllamaHost(): string | null {
    const normalized = String(process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || '').trim();
    return normalized ? normalized.replace(/\/+$/, '') : null;
  }

  private getRepairableRuntimeBindings(
    manifest: IntegrationManifest,
    installed: InstalledIntegrationState | null,
  ): IntegrationManifest['requirements'] {
    return manifest.requirements.filter((entry) => {
      const envKey = String(entry.envKey || '').trim();
      if (entry.type !== 'env' || !envKey) {
        return false;
      }
      if (String(process.env[envKey] || '').trim()) {
        return false;
      }
      if (entry.secret) {
        const storedValue = this.installerService.getStoredSecretValue(manifest.id, entry.id);
        return Boolean(String(storedValue || '').trim());
      }

      const answerValue = installed?.answers?.[entry.id];
      if (typeof answerValue === 'string') {
        return Boolean(answerValue.trim());
      }
      if (Array.isArray(answerValue)) {
        return answerValue.some((item) => String(item || '').trim());
      }
      if (typeof answerValue === 'boolean') {
        return true;
      }
      return false;
    });
  }
}
