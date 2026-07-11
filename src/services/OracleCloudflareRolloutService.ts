import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export type OracleCloudflareRolloutStep = {
  id: string;
  title: string;
  status: 'done' | 'pending';
  detail: string;
  command: string;
};

export type OracleCloudflareRolloutSnapshot = {
  generatedAt: string;
  readyForRemoteRollout: boolean;
  summary: string;
  target: {
    host: 'oracle-always-free';
    edge: 'cloudflare';
    modelProvider: 'gemini';
    modelName: string;
  };
  templates: {
    oracleSystemd: string;
    cloudflared: string;
  };
  steps: OracleCloudflareRolloutStep[];
};

type OracleCloudflareRolloutOptions = {
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

export class OracleCloudflareRolloutService {
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

  constructor(options: OracleCloudflareRolloutOptions = {}) {
    this.now = options.now || (() => new Date());
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.llmProvider = String(options.llmProvider || (config.llmProvider || '')).trim().toLowerCase();
    this.geminiCredentialReady = typeof options.geminiCredentialReady === 'boolean'
      ? options.geminiCredentialReady
      : Boolean(config.geminiApiKey || config.aiStudioApiKey);
    this.cloudflareAiGatewayEnabled = typeof options.cloudflareAiGatewayEnabled === 'boolean'
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

  public inspect(): OracleCloudflareRolloutSnapshot {
    const oracleSystemdTemplate = path.join(
      this.projectRoot,
      'config',
      'deploy',
      'zavorth-oracle.service.example',
    );
    const cloudflaredTemplate = path.join(
      this.projectRoot,
      'config',
      'deploy',
      'cloudflared.oracle.example.yml',
    );

    const steps: OracleCloudflareRolloutStep[] = [
      {
        id: 'oracle-template',
        title: 'Template systemd da Oracle',
        status: this.existsSync(oracleSystemdTemplate) ? 'done' : 'pending',
        detail: this.existsSync(oracleSystemdTemplate)
          ? 'Template pronto para subir o Zavorth como servico na VM.'
          : 'Falta o template systemd para a VM da Oracle.',
        command: `usar ${oracleSystemdTemplate}`,
      },
      {
        id: 'cloudflared-template',
        title: 'Template do cloudflared',
        status: this.existsSync(cloudflaredTemplate) ? 'done' : 'pending',
        detail: this.existsSync(cloudflaredTemplate)
          ? 'Template pronto para publicar o /zavorthControl por tunnel.'
          : 'Falta o template do cloudflared para publicar o /zavorthControl.',
        command: `usar ${cloudflaredTemplate}`,
      },
      {
        id: 'gemini-provider',
        title: 'Provider Gemini/Gemma',
        status: this.llmProvider === 'gemini' ? 'done' : 'pending',
        detail: this.llmProvider === 'gemini'
          ? 'O Zavorth esta apontando para o provider certo para usar Gemma via Gemini API.'
          : 'Troque LLM_PROVIDER para gemini para seguir a arquitetura recomendada.',
        command: 'definir LLM_PROVIDER=gemini',
      },
      {
        id: 'gemini-credential',
        title: 'Credencial Gemini',
        status: this.geminiCredentialReady ? 'done' : 'pending',
        detail: this.geminiCredentialReady
          ? 'Ja existe credencial Gemini/AI Studio configurada.'
          : 'Falta GEMINI_API_KEY ou AISTUDIO_API_KEY para o provider Gemini.',
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
        title: 'Hostname publico do Cloudflare Tunnel',
        status: this.resolvePublicHostname() ? 'done' : 'pending',
        detail: this.resolvePublicHostname()
          ? `URL publica prevista: ${this.publicBaseUrl || `https://${this.cloudflareTunnelPublicHostname}`}.`
          : 'Falta CLOUDFLARE_TUNNEL_PUBLIC_HOSTNAME ou ZAVORTH_PUBLIC_BASE_URL.',
        command: 'definir CLOUDFLARE_TUNNEL_PUBLIC_HOSTNAME',
      },
      {
        id: 'validate-runtime',
        title: 'Validar rollout',
        status: 'pending',
        detail: 'Depois de configurar Oracle, Cloudflare e Gemini, valide o runtime supervisionado.',
        command: 'npm run build && npm run ops:access',
      },
    ];

    const readyForRemoteRollout = steps
      .filter((step) => step.id !== 'validate-runtime')
      .every((step) => step.status === 'done');

    return {
      generatedAt: this.now().toISOString(),
      readyForRemoteRollout,
      summary: readyForRemoteRollout
        ? 'Arquitetura Oracle + Cloudflare + Gemini/Gemma pronta para rollout.'
        : `Rollout ainda pendente: ${steps.find((step) => step.status === 'pending' && step.id !== 'validate-runtime')?.detail || 'Ainda existem passos externos para concluir.'}`,
      target: {
        host: 'oracle-always-free',
        edge: 'cloudflare',
        modelProvider: 'gemini',
        modelName: this.gemmaModel,
      },
      templates: {
        oracleSystemd: oracleSystemdTemplate,
        cloudflared: cloudflaredTemplate,
      },
      steps,
    };
  }

  public renderText(snapshot: OracleCloudflareRolloutSnapshot = this.inspect()): string {
    const lines = [
      'Rollout Oracle + Cloudflare + Gemini/Gemma',
      '',
      snapshot.summary,
      `Modelo alvo: ${snapshot.target.modelName}`,
      `Templates:`,
      `- Oracle: ${snapshot.templates.oracleSystemd}`,
      `- Cloudflared: ${snapshot.templates.cloudflared}`,
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
