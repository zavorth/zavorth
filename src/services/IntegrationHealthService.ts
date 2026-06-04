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
      throw new Error(`Integracao desconhecida: ${integrationId}`);
    }

    const installed = this.installerService.getInstalled(manifest.id);
    const probe = this.probeService.getLatestProbe(manifest.id);
    const findings = this.buildFindings(manifest, installed, probe);
    const status = findings.some((entry) => entry.level === 'error')
      ? 'error'
      : findings.some((entry) => entry.level === 'warn')
        ? 'warn'
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
        status: runtimeReady
          ? 'ready'
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
        title: 'IntegraÃ§Ã£o experimental',
        detail: 'A receita existe, mas ainda nÃ£o tem maturidade de produÃ§Ã£o no Zavorth.',
      });
    }

    if (manifest.supportLevel === 'template') {
      findings.push({
        level: 'warn',
        title: 'Template, nÃ£o integraÃ§Ã£o pronta',
        detail: 'Este item serve para guiar um novo conector e ainda depende de implementaÃ§Ã£o especÃ­fica.',
      });
    }

    if (!installed && !runtimeReady) {
      findings.push({
        level: 'warn',
        title: 'Ainda nÃ£o foi preparada',
        detail: 'Nenhum draft de onboarding foi salvo e o runtime tambÃ©m nÃ£o detectou configuraÃ§Ã£o pronta.',
      });
    }

    if (!runtimeReady && unansweredQuestions.length > 0) {
      findings.push({
        level: 'warn',
        title: 'Onboarding incompleto',
        detail: `Ainda faltam ${unansweredQuestions.length} respostas bÃ¡sicas para fechar o plano da integraÃ§Ã£o.`,
      });
    }

    if (!runtimeReady && missingRequirements.length > 0) {
      findings.push({
        level: 'warn',
        title: 'Requisitos pendentes',
        detail: `Ainda faltam ${missingRequirements.map((entry) => entry.label).join(', ')}.`,
      });
    }

    if (installed && repairableRuntimeBindings.length > 0 && !runtimeReady && this.dependsOnRuntimeCredential(manifest)) {
      findings.push({
        level: 'warn',
        title: 'Configuracao guardada, mas nao aplicada no runtime',
        detail:
          'O hub ja recebeu a configuracao necessaria, mas o binding atual do Zavorth ainda depende de aplicar esses valores no runtime local para ficar realmente saudavel.',
      });
    }

    if (runtimeReady) {
      findings.push({
        level: 'info',
        title: 'Runtime detectado',
        detail: 'O Zavorth jÃ¡ enxerga sinais de que essa integraÃ§Ã£o estÃ¡ pronta para uso real.',
      });
    } else if (manifest.binding.status === 'ready') {
      findings.push({
        level: 'warn',
        title: 'Binding existe, mas nÃ£o estÃ¡ pronto',
        detail: 'O runtime sabe falar com essa integraÃ§Ã£o, mas faltam credenciais, sidecar ou binÃ¡rio.',
      });
    } else {
      findings.push({
        level: 'info',
        title: 'Receita disponÃ­vel',
        detail: manifest.binding.summary,
      });
    }

    if (probe) {
      if (probe.status === 'ok') {
        findings.push({
          level: 'info',
          title: 'Probe real aprovado',
          detail: `${probe.summary}. ${probe.detail}`,
        });
      } else if (probe.status === 'failed') {
        findings.push({
          level: 'error',
          title: 'Probe real falhou',
          detail: `${probe.summary}. ${probe.detail}`,
        });
      } else if (probe.status === 'not_configured') {
        findings.push({
          level: 'warn',
          title: 'Probe real nao conseguiu autenticar',
          detail: probe.detail,
        });
      } else if (probe.status === 'unsupported') {
        findings.push({
          level: 'info',
          title: 'Probe real ainda nao disponivel',
          detail: probe.detail,
        });
      }
    }

    if (findings.length === 0) {
      findings.push({
        level: 'info',
        title: 'Sem alertas',
        detail: 'A integraÃ§Ã£o parece coerente com o estado atual do hub.',
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
        label: 'Revalidar integraÃƒÂ§ÃƒÂ£o',
        command: 'usar fluxo assistido do Integration Hub',
        reason: highest?.detail || 'O binding parece configurado, mas o probe real ainda falhou.',
      };
    }

    if (manifest.id === 'AIGateway' && !runtimeReady && config.AIGatewaySidecarEnabled) {
      return {
        label: 'Subir sidecar AIGateway',
        command: 'usar fluxo assistido do Integration Hub',
        reason: highest?.detail || 'O gateway local ainda nao respondeu; o proximo passo seguro e subir o sidecar pelo hub.',
      };
    }

    if (manifest.id === 'zavorth-terminal' && !runtimeReady && config.ZavorthTerminalSidecarEnabled) {
      return {
        label: 'Subir sidecar ZavorthBridge Remote',
        command: 'usar fluxo assistido do Integration Hub',
        reason: highest?.detail || 'O remoto do ZavorthBridge ainda nao respondeu; o proximo passo seguro e subir o sidecar pelo hub.',
      };
    }

    if (manifest.id === 'oracle-cloudflare-gemma' && !runtimeReady) {
      return {
        label: 'Fechar rollout Oracle + Cloudflare',
        command: 'npm run ops:oracle-cloudflare',
        reason: highest?.detail || 'Ainda faltam sinais basicos da arquitetura remota recomendada.',
      };
    }

    if (!installed) {
      return {
        label: runtimeReady ? 'Registrar no hub' : 'Abrir onboarding',
        command: runtimeReady ? `/connect ${manifest.id}` : `npm run integrations:show -- --id ${manifest.id}`,
        reason: highest?.detail || (runtimeReady
          ? 'O runtime jÃ¡ parece pronto; agora falta registrar preferÃªncias e escopo no hub.'
          : 'Ainda nÃ£o existe um draft salvo para essa integraÃ§Ã£o.'),
      };
    }

    if (manifest.id === 'ollama' && !this.resolveOllamaHost()) {
      return {
        label: 'Preparar host local do Ollama',
        command: 'usar fluxo assistido do Integration Hub',
        reason: highest?.detail || 'Antes de validar o Ollama, o Zavorth precisa saber qual host local deve testar.',
      };
    }

    if (!runtimeReady && repairableRuntimeBindings.length > 0) {
      return {
        label: 'Reparar binding do runtime',
        command: 'usar fluxo assistido do Integration Hub',
        reason: highest?.detail || 'O hub ja guarda configuracao suficiente para tentar reparar o binding automaticamente.',
      };
    }

    if (!runtimeReady) {
      return {
        label: 'Revalidar integraÃ§Ã£o',
        command: `npm run integrations:doctor -- --id ${manifest.id}`,
        reason: highest?.detail || 'Ainda faltam sinais de saÃºde no runtime.',
      };
    }

    return {
      label: 'Usar no Zavorth',
      command: `/connect ${manifest.id}`,
      reason: 'A integraÃ§Ã£o jÃ¡ parece pronta para entrar no fluxo normal do Zavorth.',
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
        ? `Ainda faltam ${unansweredQuestions.length} resposta(s): ${unansweredQuestions.map((entry) => entry.label).join(', ')}.`
        : 'As perguntas basicas desta integracao ja foram respondidas no hub.',
      kind: 'guided',
      status: unansweredQuestions.length > 0 ? 'next' : 'done',
      command: `/connect ${manifest.id}`,
    });

    if (repairableRuntimeBindings.length > 0) {
      steps.push({
        id: 'repair-runtime',
        label: 'Aplicar configuracao guardada ao runtime',
        detail: `O hub ja recebeu ${repairableRuntimeBindings.map((entry) => entry.label).join(', ')} e pode tentar ativar esse binding sem repetir o onboarding.`,
        kind: 'automatic',
        status: runtimeReady ? 'done' : 'next',
        actionId: 'repair-runtime',
        command: 'usar fluxo assistido do Integration Hub',
      });
    } else if (missingRequirements.length > 0) {
      steps.push({
        id: 'requirements',
        label: 'Completar requisitos pendentes',
        detail: `Ainda faltam ${missingRequirements.map((entry) => entry.label).join(', ')} para o runtime ficar realmente pronto.`,
        kind: 'manual',
        status: runtimeReady ? 'optional' : (unansweredQuestions.length > 0 ? 'pending' : 'next'),
        command: `npm run integrations:show -- --id ${manifest.id}`,
      });
    }

    if (manifest.id === 'AIGateway' && !runtimeReady && config.AIGatewaySidecarEnabled) {
      steps.push({
        id: 'AIGateway-sidecar',
        label: 'Subir sidecar AIGateway',
        detail: 'O gateway local ainda nao respondeu. O proximo passo seguro e subir o sidecar pelo proprio hub.',
        kind: 'automatic',
        status: 'next',
        actionId: 'recipe:AIGateway:start-sidecar',
        command: 'usar fluxo assistido do Integration Hub',
      });
    }

    if (manifest.id === 'zavorth-terminal' && !runtimeReady && config.ZavorthTerminalSidecarEnabled) {
      steps.push({
        id: 'zavorth-bridge-remote-sidecar',
        label: 'Subir sidecar ZavorthBridge Remote',
        detail: 'O remoto do ZavorthBridge ainda nao respondeu. O proximo passo seguro e subir o sidecar remoto pelo proprio hub.',
        kind: 'automatic',
        status: 'next',
        actionId: 'recipe:zavorth-bridge-remote:start-sidecar',
        command: 'usar fluxo assistido do Integration Hub',
      });
    }

    if (manifest.id === 'ollama' && installed && !runtimeReady) {
      steps.push({
        id: 'ollama-host',
        label: 'Preparar host local do Ollama',
        detail: 'O draft existe, mas o runtime ainda nao sabe qual endpoint local usar para falar com o Ollama.',
        kind: 'automatic',
        status: 'next',
        actionId: 'recipe:ollama:prepare-host',
        command: 'usar fluxo assistido do Integration Hub',
      });
    }

    steps.push({
      id: 'validate',
      label: probe?.status === 'ok' ? 'Validacao final concluida' : 'Rodar validacao final',
      detail: probe?.status === 'ok'
        ? `O ultimo probe real respondeu bem: ${probe.summary}.`
        : (probe?.status === 'failed'
          ? `O ultimo probe real ainda falhou: ${probe.summary}. Corrija o binding e valide de novo.`
          : 'Use "Validar agora" para confirmar se a integracao realmente responde, e nao apenas parece configurada.'),
      kind: 'verification',
      status: probe?.status === 'ok' ? 'done' : ((unansweredQuestions.length > 0 || missingRequirements.length > 0) ? 'pending' : 'next'),
      actionId: 'validate-now',
      command: 'usar fluxo assistido do Integration Hub',
    });

    if (status === 'ok') {
      steps.push({
        id: 'use-runtime',
        label: 'Usar no Zavorth',
        detail: 'A integracao ja esta pronta para entrar no roteamento e ser usada nas conversas e automacoes.',
        kind: 'guided',
        status: 'done',
        command: `/connect ${manifest.id}`,
      });
    }

    const headline = status === 'ok'
      ? 'Integracao pronta para uso'
      : status === 'error'
        ? 'Existe um bloqueio real para corrigir'
        : 'Faltam alguns passos para fechar a integracao';
    const summary = status === 'ok'
      ? 'O hub enxerga binding e validacao coerentes para esta integracao.'
      : status === 'error'
        ? 'Siga o passo marcado como "next" primeiro; os demais servem como apoio para estabilizar a integracao.'
        : 'Comece pelo passo marcado como "next". Quando ele estiver resolvido, o restante do roteiro fica mais simples.';

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
        return Boolean(config.openaiApiKey || (config as any).openaiApiKeys?.length > 0);
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
        if (config.slackTransport === 'stub') {
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
        if (config.whatsappProvider === 'stub') {
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
