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
    this.llmProvider = String(options.llmProvider || (config.llmProvider || '')).trim().toLowerCase();
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
    this.gemmaModel = String(options.gemmaModel || config.gemmaModel || 'gemma-2-27b-it').trim();
  }

  public inspect(): LocalCloudflareRolloutSnapshot {
    const launcherInstaller = path.join(this.projectRoot, 'scripts', 'install-windows-launcher.ps1');
    const startupInstaller = path.join(this.projectRoot, 'scripts', 'install-windows-startup.ps1');
    const guide = path.join(this.projectRoot, 'docs', '35-windows-cloudflare-gemma.md');

    const steps: LocalCloudflareRolloutStep[] = [
      {
        id: 'launcher-installer',
        title: 'Instalador de shortcuts do Windows',
        status: this.existsSync(launcherInstaller) ? 'done' : 'pending',
        detail: this.existsSync(launcherInstaller) ? 'O repo already consegue criar os shortcuts do Zavorth supervised no desktop e menu iniciar.'
          : 'missing o instalador dos shortcuts locais do Zavorth.',
        command: 'npm run launcher:install',
      },
      {
        id: 'startup-installer',
        title: 'Optional Windows automatic startup',
        status: this.existsSync(startupInstaller) ? 'done' : 'pending',
        detail: this.existsSync(startupInstaller) ? 'an optional automatic-login installer already exists, but the lightweight Zavorth setup recommends leaving it off by default.'
          : 'Only the optional Windows auto-login installer is missing; this does not block the normal rollout.',
        command: 'npm run launcher:startup:install',
      },
      {
        id: 'gemini-provider',
        title: 'Provider Gemini/Gemma',
        status: this.llmProvider === 'gemini' ? 'done' : 'pending',
        detail:
          this.llmProvider === 'gemini'
            ? 'O Zavorth is apontando para o provider certo para usar Gemma via Gemini API.'
            : 'Troque LLM_PROVIDER para gemini para usar Gemma hospedado.',
        command: 'definir LLM_PROVIDER=gemini',
      },
      {
        id: 'gemini-credential',
        title: 'Gemini credential',
        status: this.geminiCredentialReady ? 'done' : 'pending',
        detail: this.geminiCredentialReady ? 'already existe credential Gemini/AI Studio configurada.'
          : 'missing GEMINI_API_KEY ou AISTUDIO_API_KEY.',
        command: 'definir GEMINI_API_KEY ou AISTUDIO_API_KEY',
      },
      {
        id: 'cloudflare-ai-gateway',
        title: 'Cloudflare AI Gateway',
        status: this.cloudflareAiGatewayEnabled ? 'done' : 'pending',
        detail: this.cloudflareAiGatewayEnabled ? `Gateway ready em ${this.cloudflareAiGatewayAccountId}/${this.cloudflareAiGatewayId}.`
          : 'missing CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID e CLOUDFLARE_AI_GATEWAY_ID.',
        command: 'definir CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID e CLOUDFLARE_AI_GATEWAY_ID',
      },
      {
        id: 'cloudflare-tunnel',
        title: 'Public Tunnel hostname',
        status: this.resolvePublicHostname() ? 'done' : 'pending',
        detail: this.resolvePublicHostname() ? `URL public prevista: ${this.publicBaseUrl || `https://${this.cloudflareTunnelPublicHostname}`}.`
          : 'missing a valid public hostname; the shortest path is to start a local quick tunnel for /zavorthControl.',
        command: 'npm run ops:public:tunnel',
      },
      {
        id: 'validate-runtime',
        title: 'validate fallback path',
        status: 'pending',
        detail: 'After configuring Tunnel and Gateway, validate the local supervised runtime, ZavorthControl at /zavorthControl, and the recommended profile for this host.',
        command: 'npm run build && npm run ops:access && npm run profile:status && npm run ops:local-cloudflare',
      },
    ];

    const readyForPlanB = steps
      .filter((step) => step.id !== 'validate-runtime' && step.id !== 'startup-installer')
      .every((step) => step.status === 'done');

    return {
      generatedAt: this.now().toISOString(),
      readyForPlanB,
      summary: readyForPlanB ? 'Local Plan B with Cloudflare and Gemini/Gemma ready for gateway-first rollout.'
        : `Plan B still pending: ${steps.find((step) => step.status === 'pending' && step.id !== 'validate-runtime')?.detail || 'External steps still need completion.'}`,
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
      'Support files:',
      `- Launcher: ${snapshot.helpers.launcherInstaller}`,
      `- Startup: ${snapshot.helpers.startupInstaller}`,
      `- Guia: ${snapshot.helpers.guide}`,
      '',
      'Passos:',
    ];

    for (const step of snapshot.steps) {
      lines.push(`- [${step.status}] ${step.title}`);
      lines.push(`  ${step.detail}`);
      lines.push(`  command: ${step.command}`);
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
