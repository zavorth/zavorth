import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export type LocalCloudflareRolloutStep = {
  id: string;
  title: string;
  status: 'done' | 'pending';
  detail: string;
  command: string;
};

export type LocalCloudflareRolloutSnapshot = {
  generatedAt: string;
  readyForPlanB: boolean;
  summary: string;
  target: {
    host: 'windows-local';
    edge: 'cloudflare';
    modelProvider: 'gemini';
    modelName: string;
  };
  helpers: {
    launcherInstaller: string;
    startupInstaller: string;
    guide: string;
  };
  steps: LocalCloudflareRolloutStep[];
};

type LocalCloudflareRolloutOptions = {
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  projectRoot?: string;
  llmProvider?: string;
  geminiCredentialReady?: boolean;
  cloudflareAiGatewayEnabled?: boolean;
  cloudflareAiGatewayAccountId?: string;
  cloudflareAiGatewayId?: string;
  cloudflareTunnelPublicHostname?: string;
  publicBaseUrl?: string;
  gemmaModel?: string;
};

export class LocalCloudflareRolloutService {
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly projectRoot: string;
  private readonly llmProvider: string;
  private readonly geminiCredentialReady: boolean;
  private readonly cloudflareAiGatewayEnabled: boolean;
  private readonly cloudflareAiGatewayAccountId: string;
  private readonly cloudflareAiGatewayId: string;
  private readonly cloudflareTunnelPublicHostname: string;
  private readonly publicBaseUrl: string;
  private readonly gemmaModel: string;

  constructor(options: LocalCloudflareRolloutOptions = {}) {
    this.now = options.now || (() => new Date());
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.llmProvider = String(options.llmProvider || config.llmProvider || 'gemini').trim().toLowerCase();
    this.geminiCredentialReady =
      typeof options.geminiCredentialReady === 'boolean'
        ? options.geminiCredentialReady
        : Boolean(config.geminiApiKey || config.aiStudioApiKey);
    this.cloudflareAiGatewayEnabled =
      typeof options.cloudflareAiGatewayEnabled === 'boolean'
        ? options.cloudflareAiGatewayEnabled
        : Boolean(config.cloudflareAiGatewayEnabled);
    this.cloudflareAiGatewayAccountId = String(
      options.cloudflareAiGatewayAccountId ?? config.cloudflareAiGatewayAccountId ?? '',
    ).trim();
    this.cloudflareAiGatewayId = String(
      options.cloudflareAiGatewayId ?? config.cloudflareAiGatewayId ?? '',
    ).trim();
    this.cloudflareTunnelPublicHostname = String(
      options.cloudflareTunnelPublicHostname ?? config.cloudflareTunnelPublicHostname ?? '',
    ).trim();
    this.publicBaseUrl = String(options.publicBaseUrl ?? config.zavorthPublicBaseUrl ?? '').trim();
    this.gemmaModel = String(options.gemmaModel || config.gemmaModel || 'gemma-4-31b-it').trim();
  }

  public inspect(): LocalCloudflareRolloutSnapshot {
    const launcherInstaller = path.join(this.projectRoot, 'scripts', 'install-windows-launcher.ps1');
    const startupInstaller = path.join(this.projectRoot, 'scripts', 'install-windows-startup.ps1');
    const guide = path.join(this.projectRoot, 'docs', '35-windows-cloudflare-gemma.md');

    const steps: LocalCloudflareRolloutStep[] = [
      {
        id: 'launcher-installer',
        title: 'Instalador de atalhos do Windows',
        status: this.existsSync(launcherInstaller) ? 'done' : 'pending',
        detail: this.existsSync(launcherInstaller)
          ? 'O repo ja consegue criar os atalhos do Zavorth supervisionado no desktop e menu iniciar.'
          : 'Falta o instalador dos atalhos locais do Zavorth.',
        command: 'npm run launcher:install',
      },
      {
        id: 'startup-installer',
        title: 'Startup automatico opcional do Windows',
        status: this.existsSync(startupInstaller) ? 'done' : 'pending',
        detail: this.existsSync(startupInstaller)
          ? 'Ja existe um instalador opcional para login automatico, mas o Zavorth leve recomenda deixar isso desligado por padrao.'
          : 'Falta apenas o instalador opcional para login automatico do Windows; isso nao bloqueia o rollout normal.',
        command: 'npm run launcher:startup:install',
      },
      {
        id: 'gemini-provider',
        title: 'Provider Gemini/Gemma',
        status: this.llmProvider === 'gemini' ? 'done' : 'pending',
        detail:
          this.llmProvider === 'gemini'
            ? 'O Zavorth esta apontando para o provider certo para usar Gemma via Gemini API.'
            : 'Troque LLM_PROVIDER para gemini para usar Gemma hospedado.',
        command: 'definir LLM_PROVIDER=gemini',
      },
      {
        id: 'gemini-credential',
        title: 'Credencial Gemini',
        status: this.geminiCredentialReady ? 'done' : 'pending',
        detail: this.geminiCredentialReady
          ? 'Ja existe credencial Gemini/AI Studio configurada.'
          : 'Falta GEMINI_API_KEY ou AISTUDIO_API_KEY.',
        command: 'definir GEMINI_API_KEY ou AISTUDIO_API_KEY',
      },
      {
        id: 'cloudflare-ai-gateway',
        title: 'Cloudflare AI Gateway',
        status: this.cloudflareAiGatewayEnabled ? 'done' : 'pending',
        detail: this.cloudflareAiGatewayEnabled
          ? `Gateway pronto em ${this.cloudflareAiGatewayAccountId}/${this.cloudflareAiGatewayId}.`
          : 'Faltam CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID e CLOUDFLARE_AI_GATEWAY_ID.',
        command: 'definir CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID e CLOUDFLARE_AI_GATEWAY_ID',
      },
      {
        id: 'cloudflare-tunnel',
        title: 'Hostname publico do Tunnel',
        status: this.resolvePublicHostname() ? 'done' : 'pending',
        detail: this.resolvePublicHostname()
          ? `URL publica prevista: ${this.publicBaseUrl || `https://${this.cloudflareTunnelPublicHostname}`}.`
          : 'Falta um hostname publico valido; o caminho mais curto e subir um quick tunnel local para o /dashboard.',
        command: 'npm run ops:public:tunnel',
      },
      {
        id: 'validate-runtime',
        title: 'Validar plano B',
        status: 'pending',
        detail: 'Depois de configurar Tunnel e Gateway, valide o runtime supervisionado local, a Dashboard em /dashboard e o profile recomendado para este host.',
        command: 'npm run build && npm run ops:access && npm run profile:status && npm run ops:local-cloudflare',
      },
    ];

    const readyForPlanB = steps
      .filter((step) => step.id !== 'validate-runtime' && step.id !== 'startup-installer')
      .every((step) => step.status === 'done');

    return {
      generatedAt: this.now().toISOString(),
      readyForPlanB,
      summary: readyForPlanB
        ? 'Plano B local com Cloudflare e Gemini/Gemma pronto para rollout gateway-first.'
        : `Plano B ainda pendente: ${steps.find((step) => step.status === 'pending' && step.id !== 'validate-runtime')?.detail || 'Ainda existem passos externos para concluir.'}`,
      target: {
        host: 'windows-local',
        edge: 'cloudflare',
        modelProvider: 'gemini',
        modelName: this.gemmaModel,
      },
      helpers: {
        launcherInstaller,
        startupInstaller,
        guide,
      },
      steps,
    };
  }

  public renderText(snapshot: LocalCloudflareRolloutSnapshot = this.inspect()): string {
    const lines = [
      'Rollout local no Windows + Cloudflare + Gemini/Gemma',
      '',
      snapshot.summary,
      `Modelo alvo: ${snapshot.target.modelName}`,
      'Arquivos de apoio:',
      `- Launcher: ${snapshot.helpers.launcherInstaller}`,
      `- Startup: ${snapshot.helpers.startupInstaller}`,
      `- Guia: ${snapshot.helpers.guide}`,
      '',
      'Passos:',
    ];

    for (const step of snapshot.steps) {
      lines.push(`- [${step.status}] ${step.title}`);
      lines.push(`  ${step.detail}`);
      lines.push(`  comando: ${step.command}`);
    }

    return lines.join('\n');
  }

  private resolvePublicHostname(): string | null {
    if (this.publicBaseUrl) {
      return this.publicBaseUrl;
    }

    if (this.cloudflareTunnelPublicHostname) {
      return `https://${this.cloudflareTunnelPublicHostname}`;
    }

    return null;
  }
}
