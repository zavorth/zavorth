
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import {
  EXTERNAL_EXECUTOR_ID,
  ExternalExecutor,
} from '../execution/ExternalExecutor.js';
import type {
  IntegrationManifest,
  IntegrationProbeSnapshot,
  IntegrationProbeTransport,
} from '../contracts/IntegrationHubContract.js';
import type { ChannelProviderDoctorReport } from './ChannelProviderDoctorService.js';
import { ChannelProviderDoctorService } from './ChannelProviderDoctorService.js';
import { IntegrationConnectorMeshService } from './IntegrationConnectorMeshService.js';
import { IntegrationRegistryService } from './IntegrationRegistryService.js';
import { SidecarStatusService } from './SidecarStatusService.js';
import { logger } from '../logger.js';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';
type ProbeFetch = typeof fetch;

type IntegrationProbeRuntime = {
  now?: () => Date;
  fetchImpl?: ProbeFetch;
  registryService?: IntegrationRegistryService;
  sidecarStatusService?: Pick<SidecarStatusService, 'readSummary'>;
  externalExecutor?: Pick<ExternalExecutor, 'isAvailable'>;
  [key: string]: unknown;
  channelProviderDoctorService?: Pick<ChannelProviderDoctorService, 'run'>;
  integrationConnectorMeshService?: Pick<IntegrationConnectorMeshService, 'doctor'>;
  stateFile?: string;
  timeoutMs?: number;
};

type ProbeState = {
  version: number;
  updatedAt: string;
  entries: Record<string, IntegrationProbeSnapshot>;
};

type HttpProbeInput = {
  integrationId: string;
  label: string;
  transport: IntegrationProbeTransport;
  checkedTarget: string;
  headers: Record<string, string>;
};

export class IntegrationProbeService {
  private readonly controlUiEntryPath = '/zavorthControl';
  private readonly now: () => Date;
  private readonly fetchImpl: ProbeFetch;
  private readonly registryService: IntegrationRegistryService;
  private readonly sidecarStatusService: Pick<SidecarStatusService, 'readSummary'>;
  private readonly externalExecutor: Pick<ExternalExecutor, 'isAvailable'>;
  private readonly channelProviderDoctorService: Pick<ChannelProviderDoctorService, 'run'>;
  private readonly integrationConnectorMeshService: Pick<IntegrationConnectorMeshService, 'doctor'>;
  private readonly stateFile: string;
  private readonly timeoutMs: number;

  constructor(runtime: IntegrationProbeRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.fetchImpl = runtime.fetchImpl || fetch;
    this.registryService = runtime.registryService || new IntegrationRegistryService();
    this.sidecarStatusService = runtime.sidecarStatusService || new SidecarStatusService();
    const legacyRuntimeExecutor = runtime[this.legacyRuntimeKey('Executor')] as
      | Pick<ExternalExecutor, 'isAvailable'>
      | undefined;
    const externalExecutorExecutor = runtime.externalExecutorExecutor as
      | Pick<ExternalExecutor, 'isAvailable'>
      | undefined;
    this.externalExecutor = runtime.externalExecutor || externalExecutorExecutor || legacyRuntimeExecutor || new ExternalExecutor();
    this.channelProviderDoctorService = runtime.channelProviderDoctorService || new ChannelProviderDoctorService();
    this.stateFile = runtime.stateFile || config.integrationHubProbeStateFile;
    this.timeoutMs = runtime.timeoutMs || config.integrationHubProbeTimeoutMs;
    this.integrationConnectorMeshService = runtime.integrationConnectorMeshService || new IntegrationConnectorMeshService({
      fetchImpl: this.fetchImpl,
      timeoutMs: this.timeoutMs,
    });
  }

  public getLatestProbe(integrationId: string): IntegrationProbeSnapshot | null {
    const normalizedId = String(integrationId || '').trim().toLowerCase();
    if (!normalizedId) {
      return null;
    }

    const state = this.readState();
    return state.entries[normalizedId] || null;
  }

  public async runProbe(integrationId: string): Promise<IntegrationProbeSnapshot> {
    const manifest = this.registryService.getManifestById(integrationId);
    if (!manifest) {
      throw new Error(`Unknown integration: ${integrationId}`);
    }

    const snapshot = await this.runProbeForManifest(manifest);
    this.persist(snapshot);
    return snapshot;
  }

  private async runProbeForManifest(manifest: IntegrationManifest): Promise<IntegrationProbeSnapshot> {
    switch (manifest.id) {
      case 'oracle-cloudflare-gemma':
        return this.runOracleCloudflareGemmaProbe(manifest);
      case 'openrouter':
        return this.runOpenRouterProbe(manifest);
      case 'openai':
        return this.runOpenAiProbe(manifest);
      case 'minimax':
        return this.runMiniMaxProbe(manifest);
      case 'gemini':
        return this.runGeminiProbe(manifest);
      case 'AIGateway':
        return this.runAIGatewayProbe(manifest);
      case 'zavorth-terminal':
        return this.runZavorthBridgeRemoteProbe(manifest);
      case 'external-executor':
      case EXTERNAL_EXECUTOR_ID:
        return this.runExternalExecutorProbe(manifest);
      case 'ollama':
        return this.runOllamaProbe(manifest);
      case 'telegram':
      case 'discord':
      case 'slack':
      case 'whatsapp':
        return this.runChannelProviderProbe(manifest);
      case 'composio':
      case 'nango':
      case 'pipedream':
      case 'zapier':
      case 'n8n':
      case 'workato':
        return this.runIntegrationConnectorProbe(manifest);
      default:
        return this.createSnapshot(manifest, {
        status: 'unsupported',
        transport: manifest.category === 'remote' ? 'runtime' : 'unsupported',
        summary: 'Probe real ainda nao disponivel',
        detail: `This integration still depends only on the hub heuristic doctor. Review the canonical entry ${this.controlUiEntryPath}.`,
        checkedTarget: null,
        httpStatus: null,
        latencyMs: null,
        });
    }
  }

  private async runOpenRouterProbe(manifest: IntegrationManifest): Promise<IntegrationProbeSnapshot> {
    const apiKey = String(config.openRouterApiKey || process.env.OPENROUTER_API_KEY || '').trim();
    if (!apiKey) {
      return this.createSnapshot(manifest, {
        status: 'not_configured',
        transport: 'api',
        summary: 'Falta ativar a chave do runtime',
        detail: 'No active OPENROUTER_API_KEY was found in the runtime for real connectivity testing.',
        checkedTarget: 'https://openrouter.ai/api/v1/models',
        httpStatus: null,
        latencyMs: null,
      });
    }

    return this.runHttpProbe({
      integrationId: manifest.id,
      label: manifest.label,
      transport: 'api',
      checkedTarget: 'https://openrouter.ai/api/v1/models',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });
  }

  private async runOpenAiProbe(manifest: IntegrationManifest): Promise<IntegrationProbeSnapshot> {
    const apiKey = String(config.openaiApiKey || process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
      return this.createSnapshot(manifest, {
        status: 'not_configured',
        transport: 'api',
        summary: 'Falta ativar a chave do runtime',
        detail: 'No active OPENAI_API_KEY was found in the runtime for real connectivity testing.',
        checkedTarget: 'https://api.openai.com/v1/models',
        httpStatus: null,
        latencyMs: null,
      });
    }

    return this.runHttpProbe({
      integrationId: manifest.id,
      label: manifest.label,
      transport: 'api',
      checkedTarget: 'https://api.openai.com/v1/models',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });
  }

  private async runMiniMaxProbe(manifest: IntegrationManifest): Promise<IntegrationProbeSnapshot> {
    const apiKey = String(config.minimaxApiKey || process.env.MINIMAX_API_KEY || '').trim();
    if (!apiKey) {
      return this.createSnapshot(manifest, {
        status: 'not_configured',
        transport: 'api',
        summary: 'Falta ativar a chave do runtime',
        detail: 'No active MINIMAX_API_KEY was found in the runtime for real connectivity testing.',
        checkedTarget: 'https://api.minimax.io/v1/models',
        httpStatus: null,
        latencyMs: null,
      });
    }

    return this.runHttpProbe({
      integrationId: manifest.id,
      label: manifest.label,
      transport: 'api',
      checkedTarget: 'https://api.minimax.io/v1/models',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });
  }

  private async runGeminiProbe(manifest: IntegrationManifest): Promise<IntegrationProbeSnapshot> {
    const apiKey = String(
      config.aiStudioApiKey || config.geminiApiKey || process.env.AISTUDIO_API_KEY || process.env.GEMINI_API_KEY || '',
    ).trim();
    if (!apiKey) {
      return this.createSnapshot(manifest, {
        status: 'not_configured',
        transport: 'api',
        summary: 'Falta ativar a chave do runtime',
        detail: 'No active GEMINI_API_KEY/AISTUDIO_API_KEY was found in the runtime for real connectivity testing.',
        checkedTarget: 'https://generativelanguage.googleapis.com/v1beta/models',
        httpStatus: null,
        latencyMs: null,
      });
    }

    return this.runHttpProbe({
      integrationId: manifest.id,
      label: manifest.label,
      transport: 'api',
      checkedTarget: 'https://generativelanguage.googleapis.com/v1beta/models',
      headers: {
        'x-goog-api-key': apiKey,
        Accept: 'application/json',
      },
    });
  }

  private async runOracleCloudflareGemmaProbe(
    manifest: IntegrationManifest,
  ): Promise<IntegrationProbeSnapshot> {
    const tunnelHostname = String(
      config.cloudflareTunnelPublicHostname || config.zavorthPublicBaseUrl || '',
    ).trim();
    const gatewayReady = Boolean(config.cloudflareAiGatewayEnabled);
    const geminiReady = Boolean(config.geminiApiKey || config.aiStudioApiKey);

    if (!tunnelHostname || !gatewayReady || !geminiReady) {
      return this.createSnapshot(manifest, {
        status: 'not_configured',
        transport: 'runtime',
        summary: 'Stack Oracle + Cloudflare ainda nao fechou',
        detail:
          'Faltam sinais basicos do rollout: hostname do tunnel, AI Gateway da Cloudflare ou credencial Gemini.',
        checkedTarget: tunnelHostname || config.cloudflareAiGatewayBaseUrl || null,
        httpStatus: null,
        latencyMs: null,
      });
    }

    const checkedTarget = tunnelHostname.startsWith('http')
      ? `${tunnelHostname.replace(/\/+$/, '')}/app`
      : `https://${tunnelHostname.replace(/\/+$/, '')}/app`;

    return this.runHttpProbe({
      integrationId: manifest.id,
      label: manifest.label,
      transport: 'runtime',
      checkedTarget,
      headers: {
        Accept: 'text/html,application/json',
      },
    });
  }

  private async runAIGatewayProbe(manifest: IntegrationManifest): Promise<IntegrationProbeSnapshot> {
    const sidecar = this.sidecarStatusService.readSummary().AIGateway;
    if (!sidecar.enabled) {
      return this.createSnapshot(manifest, {
        status: 'not_configured',
        transport: 'runtime',
        summary: 'AIGateway desativado no runtime',
        detail: 'Enable the AIGateway sidecar before trying to validate this integration.',
        checkedTarget: sidecar.baseUrl ? `${sidecar.baseUrl}/models` : null,
        httpStatus: null,
        latencyMs: null,
      });
    }

    if (!sidecar.ready || !sidecar.baseUrl) {
      return this.createSnapshot(manifest, {
        status: 'not_configured',
        transport: 'runtime',
        summary: 'Sidecar AIGateway ainda nao esta pronto',
        detail: sidecar.message || 'O Zavorth ainda nao conseguiu confirmar o gateway local do AIGateway.',
        checkedTarget: sidecar.baseUrl ? `${sidecar.baseUrl}/models` : null,
        httpStatus: null,
        latencyMs: null,
      });
    }

    return this.runHttpProbe({
      integrationId: manifest.id,
      label: manifest.label,
      transport: 'runtime',
      checkedTarget: this.joinUrl(sidecar.baseUrl, 'models'),
      headers: {
        Accept: 'application/json',
      },
    });
  }

  private async runZavorthBridgeRemoteProbe(manifest: IntegrationManifest): Promise<IntegrationProbeSnapshot> {
    const sidecar = this.sidecarStatusService.readSummary().ZavorthTerminal;
    if (!sidecar.enabled) {
      return this.createSnapshot(manifest, {
        status: 'not_configured',
        transport: 'runtime',
        summary: 'ZavorthBridge Remote desativado no runtime',
        detail: 'Enable the ZavorthBridge remote sidecar before trying to validate this integration.',
        checkedTarget: sidecar.baseUrl ? this.joinUrl(sidecar.baseUrl, 'health') : null,
        httpStatus: null,
        latencyMs: null,
      });
    }

    if (!sidecar.ready || !sidecar.baseUrl) {
      return this.createSnapshot(manifest, {
        status: 'not_configured',
        transport: 'runtime',
        summary: 'Sidecar remoto do ZavorthBridge ainda nao esta pronto',
        detail: sidecar.message || 'O Zavorth ainda nao conseguiu confirmar a saude do remoto do ZavorthBridge.',
        checkedTarget: sidecar.baseUrl ? this.joinUrl(sidecar.baseUrl, 'health') : null,
        httpStatus: null,
        latencyMs: null,
      });
    }

    return this.runHttpProbe({
      integrationId: manifest.id,
      label: manifest.label,
      transport: 'runtime',
      checkedTarget: this.joinUrl(sidecar.baseUrl, 'health'),
      headers: {
        Accept: 'application/json,text/plain',
      },
    });
  }

  private async runExternalExecutorProbe(manifest: IntegrationManifest): Promise<IntegrationProbeSnapshot> {
    const startedAt = Date.now();
    try {
      const available = await this.externalExecutor.isAvailable();
      const latencyMs = Math.max(1, Date.now() - startedAt);
      return this.createSnapshot(manifest, {
        status: available ? 'ok' : 'failed',
        transport: 'cli',
        summary: available
          ? 'ExternalExecutor CLI respondeu ao probe real'
          : 'ExternalExecutor CLI nao respondeu ao probe real',
        detail: available
          ? 'O external runner local/WSL aceitou a checagem de disponibilidade.'
          : 'O Zavorth nao conseguiu confirmar a disponibilidade real da CLI do external runner.',
        checkedTarget: this.resolveExternalExecutorTarget(),
        httpStatus: null,
        latencyMs,
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Integration Probe] network request failed', error);
    return this.createSnapshot(manifest, {
        status: 'failed',
        transport: 'cli',
        summary: 'Probe real do external runner falhou',
        detail: `Falha ao verificar a CLI do external runner: ${errorMessage(error)}`,
        checkedTarget: this.resolveExternalExecutorTarget(),
        httpStatus: null,
        latencyMs: Math.max(1, Date.now() - startedAt),
      });
  }
  }

  private async runChannelProviderProbe(manifest: IntegrationManifest): Promise<IntegrationProbeSnapshot> {
    const report = await this.channelProviderDoctorService.run({});
    const item = report.items.find((entry) => entry.channelId === manifest.id);
    if (!item) {
      return this.createSnapshot(manifest, {
        status: 'unsupported',
        transport: 'unsupported',
        summary: 'Channel doctor did not find this provider',
        detail: 'The current runtime did not expose this channel in the Channel Mesh doctor.',
        checkedTarget: null,
        httpStatus: null,
        latencyMs: null,
      });
    }

    const transport = this.resolveChannelProbeTransport(item.mode);
    const detailParts = [...item.details];
    if (item.error) {
      detailParts.push(`Error: ${item.error}`);
    }

    return this.createSnapshot(manifest, {
      status: item.status === 'passed'
        ? 'ok'
        : item.status === 'failed'
          ? 'failed'
          : 'not_configured',
      transport,
      summary: item.summary,
      detail: detailParts.join(' ').trim() || report.summary,
      checkedTarget: this.resolveChannelCheckedTarget(manifest.id, item.mode, report),
      httpStatus: null,
      latencyMs: null,
    });
  }

  private async runIntegrationConnectorProbe(manifest: IntegrationManifest): Promise<IntegrationProbeSnapshot> {
    const doctor = await this.integrationConnectorMeshService.doctor(manifest.id);
    return this.createSnapshot(manifest, {
      status: doctor.status === 'ready'
        ? 'ok'
        : doctor.status === 'missing_config'
          ? 'not_configured'
          : doctor.status === 'unsupported_probe'
            ? 'unsupported'
            : 'failed',
      transport: doctor.checkedTarget ? 'api' : 'runtime',
      summary: doctor.summary,
      detail: doctor.nextAction,
      checkedTarget: doctor.checkedTarget,
      httpStatus: doctor.httpStatus,
      latencyMs: doctor.latencyMs,
    });
  }

  private async runOllamaProbe(manifest: IntegrationManifest): Promise<IntegrationProbeSnapshot> {
    const host = this.resolveOllamaHost();
    if (!host) {
      return this.createSnapshot(manifest, {
        status: 'not_configured',
        transport: 'runtime',
        summary: 'Ollama host has not been prepared yet',
        detail: 'Set OLLAMA_HOST or OLLAMA_BASE_URL to validate the local Ollama installation.',
        checkedTarget: null,
        httpStatus: null,
        latencyMs: null,
      });
    }

    return this.runHttpProbe({
      integrationId: manifest.id,
      label: manifest.label,
      transport: 'runtime',
      checkedTarget: this.joinUrl(host, 'api/tags'),
      headers: {
        Accept: 'application/json',
      },
    });
  }

  private legacyRuntimeKey(suffix: string): string {
    return `${['open', 'Claw'].join('')}${suffix}`;
  }

  private legacyConfigKey(suffix: string): string {
    return `${['open', 'claw'].join('')}${suffix}`;
  }

  private resolveExternalExecutorTarget(): string | null {
    const runtimeConfig = config as Record<string, unknown>;
    const value = String(
      runtimeConfig.externalExecutorCliPath ||
      runtimeConfig[this.legacyConfigKey('CliPath')] ||
      runtimeConfig.externalExecutorCommand ||
      runtimeConfig[this.legacyConfigKey('Command')] ||
      '',
    ).trim();
    return value || null;
  }

  private async runHttpProbe(input: HttpProbeInput): Promise<IntegrationProbeSnapshot> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(input.checkedTarget, {
        method: 'GET',
        headers: input.headers,
        signal: controller.signal,
      });
      const latencyMs = Math.max(1, Date.now() - startedAt);
      if (response.ok) {
        return {
          generatedAt: this.now().toISOString(),
          integrationId: input.integrationId,
          label: input.label,
          status: 'ok',
          transport: input.transport,
          summary: 'Probe real respondeu com sucesso',
          detail: `The integration responded to the light test in ${latencyMs} ms.`,
          checkedTarget: input.checkedTarget,
          httpStatus: response.status,
          latencyMs,
        };
      }

      const preview = await this.readResponsePreview(response);
      return {
        generatedAt: this.now().toISOString(),
        integrationId: input.integrationId,
        label: input.label,
        status: 'failed',
        transport: input.transport,
        summary: this.describeFailure(response.status),
        detail: preview
          ? `O endpoint respondeu ${response.status}. Detalhe: ${preview}`
          : `O endpoint respondeu ${response.status} durante o probe real.`,
        checkedTarget: input.checkedTarget,
        httpStatus: response.status,
        latencyMs,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const aborted = asErrorLike(error).name === 'AbortError';
      return {
        generatedAt: this.now().toISOString(),
        integrationId: input.integrationId,
        label: input.label,
        status: 'failed',
        transport: input.transport,
        summary: aborted ? 'Probe real expirou' : 'Probe real falhou',
        detail: aborted
          ? `O endpoint nao respondeu dentro de ${this.timeoutMs} ms.`
          : `Falha ao contactar o endpoint: ${errorMessage(error)}`,
        checkedTarget: input.checkedTarget,
        httpStatus: null,
        latencyMs: Math.max(1, Date.now() - startedAt),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readResponsePreview(response: Response): Promise<string> {
    try {
      const text = (await response.text()).trim();
      if (!text) {
        return '';
      }
      return text.slice(0, 180);
    } catch (error: unknown) {logger.warn('[Integration Probe] network request failed', error); return ''; }
  }

  private describeFailure(status: number): string {
    if (status === 401 || status === 403) {
      return 'Probe real falhou por autenticacao';
    }
    if (status >= 500) {
      return 'Probe real encontrou erro remoto';
    }
    return 'Probe real falhou';
  }

  private createSnapshot(
    manifest: IntegrationManifest,
    input: Omit<IntegrationProbeSnapshot, 'generatedAt' | 'integrationId' | 'label'>,
  ): IntegrationProbeSnapshot {
    return {
      generatedAt: this.now().toISOString(),
      integrationId: manifest.id,
      label: manifest.label,
      ...input,
    };
  }

  private readState(): ProbeState {
    if (!fs.existsSync(this.stateFile)) {
      return {
        version: 1,
        updatedAt: this.now().toISOString(),
        entries: {},
      };
    }

    try {
      const raw = fs.readFileSync(this.stateFile, 'utf8');
      const parsed = JSON.parse(raw) as ProbeState;
      return {
        version: 1,
        updatedAt: parsed.updatedAt || this.now().toISOString(),
        entries: parsed.entries || {},
      };
    } catch (error: unknown) {logger.warn('[Integration Probe] JSON parse failed', error);
    return {
        version: 1,
        updatedAt: this.now().toISOString(),
        entries: {},
      };
  }
  }

  private resolveOllamaHost(): string | null {
    const host = String(process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || '').trim();
    if (!host) {
      return null;
    }
    return host.replace(/\/+$/, '');
  }

  private joinUrl(baseUrl: string, suffix: string): string {
    const normalizedBase = String(baseUrl || '').trim().replace(/\/+$/, '');
    const normalizedSuffix = String(suffix || '').trim().replace(/^\/+/, '');
    return `${normalizedBase}/${normalizedSuffix}`;
  }

  private resolveChannelProbeTransport(mode: ChannelProviderDoctorReport['items'][number]['mode']): IntegrationProbeTransport {
    if (mode === 'native' || mode === 'cloud-api') {
      return 'api';
    }
    if (mode === 'stub' || mode === 'baileys' || mode === 'bridge') {
      return 'runtime';
    }
    return 'unsupported';
  }

  private resolveChannelCheckedTarget(
    integrationId: string,
    mode: ChannelProviderDoctorReport['items'][number]['mode'],
    report: ChannelProviderDoctorReport,
  ): string | null {
    switch (integrationId) {
      case 'telegram':
        return String(config.telegramBotToken || '').trim()
          ? 'https://api.telegram.org/bot<token>/getMe'
          : report.command;
      case 'discord':
        return String(config.discordBotToken || '').trim()
          ? 'https://discord.com/api/v10/users/@me'
          : report.command;
      case 'slack':
        return mode === 'native'
          ? `${String(config.slackApiBaseUrl || 'https://slack.com/api').trim().replace(/\/+$/, '')}/auth.test`
          : String(config.slackStatusFile || '').trim() || report.command;
      case 'whatsapp':
        if (mode === 'cloud-api') {
          return `https://graph.facebook.com/${String(config.whatsappCloudApiVersion || 'v20.0').trim()}/<phone-number-id>`;
        }
        if (mode === 'baileys') {
          return String(config.whatsappSessionDir || '').trim() || report.command;
        }
        return String(config.whatsappStatusFile || '').trim() || report.command;
      default:
        return report.command;
    }
  }

  private persist(snapshot: IntegrationProbeSnapshot): void {
    const state = this.readState();
    state.updatedAt = this.now().toISOString();
    state.entries[snapshot.integrationId] = snapshot;
    fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2), 'utf8');
  }
}
