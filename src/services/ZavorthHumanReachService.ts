import fs from 'node:fs';
import path from 'node:path';
import { resolveChannelProductTier } from './ZavorthChannelProductTier.js';

export type ReachPathId =
  | 'desktop'
  | 'telegram'
  | 'whatsapp-cloud'
  | 'whatsapp-baileys'
  | 'web'
  | 'cli';

export type ReachPathStatus =
  | 'pronto'
  | 'precisa-setup'
  | 'experimental'
  | 'opcional';

export type HumanReachPath = {
  id: ReachPathId;
  title: string;
  summary: string;
  status: ReachPathStatus;
  statusLabel: string;
  recommended: boolean;
  stable: boolean;
  ready: boolean;
  howToStart: string;
  setupSteps: string[];
  envHints: string[];
  nextStep: string | null;
  productTier: string;
};

export type HumanReachSnapshot = {
  contractVersion: 'zavorth-human-reach/1';
  generatedAt: string;
  headline: string;
  summary: string;
  preferredPathId: ReachPathId | null;
  stableReadyCount: number;
  paths: HumanReachPath[];
  recommendedOrder: ReachPathId[];
  digestLines: string[];
  promptBlock: string;
  guideLines: string[];
};

type ServiceDeps = {
  projectRoot?: string | null;
  now?: () => Date;
  env?: Record<string, string | undefined>;
};

const STATUS_LABELS: Record<ReachPathStatus, string> = {
  pronto: 'Pronto para usar',
  'precisa-setup': 'Falta configurar',
  experimental: 'Experimental',
  opcional: 'Opcional',
};

export class ZavorthHumanReachService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;

  public constructor(deps: ServiceDeps = {}) {
    this.projectRoot = path.resolve(String(deps.projectRoot || process.cwd()));
    this.now = deps.now || (() => new Date());
    this.env = deps.env || process.env;
  }

  public buildSnapshot(): HumanReachSnapshot {
    const preferredPathId = this.resolvePreferredPathId();
    const paths = this.listPaths(preferredPathId);
    const stableReadyCount = paths.filter((pathItem) => pathItem.stable && pathItem.ready).length;
    const recommendedOrder: ReachPathId[] = ['desktop', 'telegram', 'whatsapp-cloud', 'web', 'cli', 'whatsapp-baileys'];
    return {
      contractVersion: 'zavorth-human-reach/1',
      generatedAt: this.now().toISOString(),
      headline: 'Onde voce me encontra',
      summary: stableReadyCount > 0
        ? `${stableReadyCount} caminho(s) estavel(is) pronto(s). Prefira Desktop e Telegram.`
        : 'Nenhum canal estavel configurado ainda. Comece pelo Desktop ou Telegram.',
      preferredPathId,
      stableReadyCount,
      paths,
      recommendedOrder,
      digestLines: this.formatDigestLines(paths, preferredPathId),
      promptBlock: this.formatPromptBlock(paths, preferredPathId),
      guideLines: this.formatGuideLines(paths, preferredPathId),
    };
  }

  public listPaths(preferredPathId?: ReachPathId | null): HumanReachPath[] {
    const preferred = preferredPathId === undefined ? this.resolvePreferredPathId() : preferredPathId;
    const telegramToken = clean(this.env.TELEGRAM_BOT_TOKEN || this.env.BOT_TOKEN);
    const waToken = clean(this.env.WHATSAPP_ACCESS_TOKEN || this.env.WHATSAPP_BOT_TOKEN);
    const waPhone = clean(this.env.WHATSAPP_PHONE_NUMBER_ID);
    const waBridge = clean(this.env.WHATSAPP_BRIDGE_URL);
    const waProvider = clean(this.env.WHATSAPP_PROVIDER).toLowerCase();
    const desktopHint = this.detectDesktopPresence();

    const telegramTier = resolveChannelProductTier('telegram');
    const waTier = resolveChannelProductTier('whatsapp');
    const baileysTier = resolveChannelProductTier('whatsapp-baileys');

    const paths: HumanReachPath[] = [
      {
        id: 'desktop',
        title: 'App / Desktop',
        summary: 'Melhor caminho no computador para qualquer pessoa.',
        status: 'pronto',
        statusLabel: STATUS_LABELS.pronto,
        recommended: preferred === 'desktop' || !preferred,
        stable: true,
        ready: true,
        howToStart: desktopHint
          ? 'Abra o app Zavorth Desktop e comece a conversar.'
          : 'No projeto: zavorth open (ou abra o Desktop se instalado).',
        setupSteps: [
          'Instale ou abra o Zavorth Desktop / Control.',
          'Fale em linguagem normal — o first-run guia idioma e aprendizado.',
        ],
        envHints: [],
        nextStep: null,
        productTier: 'T0',
      },
      {
        id: 'telegram',
        title: 'Telegram',
        summary: telegramToken
          ? 'Bot configurado — caminho estavel no celular (T1).'
          : 'Canal estavel recomendado no celular.',
        status: telegramToken ? 'pronto' : 'precisa-setup',
        statusLabel: telegramToken ? STATUS_LABELS.pronto : STATUS_LABELS['precisa-setup'],
        recommended: preferred === 'telegram' || !telegramToken,
        stable: true,
        ready: Boolean(telegramToken),
        howToStart: telegramToken
          ? 'Abra o bot no Telegram e mande qualquer mensagem.'
          : 'Crie um bot no @BotFather e cole o token.',
        setupSteps: [
          'No Telegram, fale com @BotFather e crie um bot.',
          'Copie o token.',
          'Defina TELEGRAM_BOT_TOKEN no ambiente /.env.',
          'Reinicie o host Zavorth e envie oi no bot.',
        ],
        envHints: ['TELEGRAM_BOT_TOKEN'],
        nextStep: telegramToken ? null : 'Defina TELEGRAM_BOT_TOKEN e reinicie.',
        productTier: telegramTier?.tier || 'T1',
      },
      {
        id: 'whatsapp-cloud',
        title: 'WhatsApp oficial (Cloud API)',
        summary: waToken && waPhone
          ? 'Cloud API configurada — caminho de producao (T1).'
          : 'WhatsApp estavel via API oficial da Meta (nao e Baileys).',
        status: waToken && waPhone ? 'pronto' : 'precisa-setup',
        statusLabel: waToken && waPhone ? STATUS_LABELS.pronto : STATUS_LABELS['precisa-setup'],
        recommended: preferred === 'desktop' ? false : false,
        stable: true,
        ready: Boolean(waToken && waPhone),
        howToStart: waToken && waPhone
          ? 'Use the numero Business configurado; mensagens entram pelo webhook.'
          : 'Configure app Business no Meta Developers.',
        setupSteps: [
          'Crie app Business no developers.facebook.com',
          'Ative o produto WhatsApp e pegue Phone Number ID + token permanente.',
          'Defina WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID.',
          'Configure webhook publico para /api/webhooks/whatsapp.',
        ],
        envHints: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN'],
        nextStep: waToken && waPhone ? null : 'Configure Cloud API ou ignore se nao for usar WhatsApp.',
        productTier: waTier?.tier || 'T1',
      },
      {
        id: 'web',
        title: 'Web / Control',
        summary: 'Painel e chat no navegador (Control / experience).',
        status: 'opcional',
        statusLabel: STATUS_LABELS.opcional,
        recommended: preferred === 'web',
        stable: true,
        ready: true,
        howToStart: 'Abra o Control local (zavorth ui / experience web).',
        setupSteps: ['Suba o host local e abra a UI web do Zavorth.'],
        envHints: [],
        nextStep: null,
        productTier: 'T0',
      },
      {
        id: 'cli',
        title: 'Terminal',
        summary: 'Para quem ja usa linha de comando.',
        status: 'opcional',
        statusLabel: STATUS_LABELS.opcional,
        recommended: preferred === 'cli',
        stable: true,
        ready: true,
        howToStart: 'Use the chat CLI / zavorth open no terminal.',
        setupSteps: ['Instale o CLI e rode o host local.'],
        envHints: [],
        nextStep: null,
        productTier: 'T0',
      },
      {
        id: 'whatsapp-baileys',
        title: 'WhatsApp experimental (Baileys)',
        summary: waProvider === 'baileys' || waBridge
          ? 'Baileys selecionado/bridge apontado — T2 experimental, nao e o caminho padrao.'
          : 'QR pessoal via processo isolado. So se Cloud API for inviavel.',
        status: 'experimental',
        statusLabel: STATUS_LABELS.experimental,
        recommended: false,
        stable: false,
        ready: Boolean(waBridge) || waProvider === 'baileys',
        howToStart: 'scripts/whatsapp-bridge + WHATSAPP_PROVIDER=baileys (avancado).',
        setupSteps: [
          'cd scripts/whatsapp-bridge && npm install',
          'npm run whatsapp-bridge:start e escaneie o QR',
          'WHATSAPP_PROVIDER=baileys e WHATSAPP_BRIDGE_URL=http://127.0.0.1:3910',
          'Opcional: WHATSAPP_BRIDGE_POLL=1 para inbound local',
        ],
        envHints: ['WHATSAPP_PROVIDER', 'WHATSAPP_BRIDGE_URL'],
        nextStep: 'Prefira WhatsApp Cloud. Baileys so se necessario.',
        productTier: baileysTier?.tier || 'T2',
      },
    ];

    return paths;
  }

  public getPath(id: string): HumanReachPath | null {
    const key = String(id || '').trim().toLowerCase();
    return this.listPaths().find((pathItem) => pathItem.id === key || pathItem.title.toLowerCase().includes(key)) || null;
  }

  /**
   * Free-text NLU packs removed (agent-first: free text → agent).
   * Use explicit slash/API intents instead.
   */
  public matchNaturalCommand(_text: string): null | { kind: 'list' | 'guide'; pathId?: ReachPathId } {
    return null;
  }

  public formatDigestLines(paths?: HumanReachPath[], preferredPathId?: ReachPathId | null): string[] {
    const list = paths || this.listPaths();
    const preferred = preferredPathId === undefined ? this.resolvePreferredPathId() : preferredPathId;
    const lines = ['Where you can reach me:'];
    for (const pathItem of list) {
      const mark = pathItem.ready ? '✓' : pathItem.stable ? '○' : '·';
      const rec = pathItem.id === preferred || pathItem.recommended ? ' (recommended)' : '';
      lines.push(`${mark} ${pathItem.title}${rec} — ${pathItem.statusLabel}`);
      if (!pathItem.ready && pathItem.nextStep) {
        lines.push(`  Next: ${pathItem.nextStep}`);
      }
    }
    lines.push('Stable: Desktop + Telegram (+ WhatsApp Cloud if needed). Baileys is experimental.');
    return lines;
  }

  public formatGuideLines(paths?: HumanReachPath[], preferredPathId?: ReachPathId | null): string[] {
    const list = paths || this.listPaths();
    const preferred = preferredPathId === undefined ? this.resolvePreferredPathId() : preferredPathId;
    const focus = list.find((pathItem) => pathItem.id === preferred)
      || list.find((pathItem) => pathItem.stable && !pathItem.ready)
      || list.find((pathItem) => pathItem.id === 'telegram')
      || list[0];
    if (!focus) return ['No reach path available.'];
    return [
      `Guide: ${focus.title}`,
      focus.summary,
      focus.howToStart,
      ...focus.setupSteps.map((step, index) => `${index + 1}. ${step}`),
      focus.nextStep ? `Next: ${focus.nextStep}` : 'This path is already usable.',
    ];
  }

  public formatPathGuide(pathId: ReachPathId): string[] {
    const pathItem = this.getPath(pathId);
    if (!pathItem) return ['Path not found.'];
    return [
      `Guide: ${pathItem.title} [${pathItem.statusLabel}]`,
      pathItem.summary,
      pathItem.howToStart,
      ...pathItem.setupSteps.map((step, index) => `${index + 1}. ${step}`),
      pathItem.envHints.length ? `Env: ${pathItem.envHints.join(', ')}` : '',
      pathItem.nextStep ? `Next: ${pathItem.nextStep}` : 'Ready to use.',
    ].filter(Boolean);
  }

  public formatPromptBlock(paths?: HumanReachPath[], preferredPathId?: ReachPathId | null): string {
    const list = paths || this.listPaths();
    const preferred = preferredPathId === undefined ? this.resolvePreferredPathId() : preferredPathId;
    const stable = list.filter((pathItem) => pathItem.stable);
    return [
      'Where the user can reach this agent (prefer stable paths; do not overclaim experimental channels):',
      preferred ? `- preferredPath: ${preferred}` : '- preferredPath: desktop',
      ...stable.map((pathItem) => `- ${pathItem.id}: ${pathItem.ready ? 'ready' : 'needs-setup'} — ${pathItem.summary}`),
      '- whatsapp-baileys is experimental (T2); recommend WhatsApp Cloud API for production.',
      '- Guide setup in plain language; never invent that a channel works without credentials.',
    ].join('\n');
  }

  private resolvePreferredPathId(): ReachPathId | null {
    const fromFirstRun = this.readFirstRunSurface();
    if (fromFirstRun) return fromFirstRun;
    const fromAnyone = this.readAnyoneSurface();
    if (fromAnyone) return fromAnyone;
    if (clean(this.env.TELEGRAM_BOT_TOKEN || this.env.BOT_TOKEN)) return 'telegram';
    return 'desktop';
  }

  private readFirstRunSurface(): ReachPathId | null {
    return this.readSurfaceFile(path.join(this.projectRoot, 'data', 'runtime', 'first-run-human.json'));
  }

  private readAnyoneSurface(): ReachPathId | null {
    return this.readSurfaceFile(path.join(this.projectRoot, 'data', 'runtime', 'anyone-agent-path.json'));
  }

  private readSurfaceFile(filePath: string): ReachPathId | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { surface?: string };
      return normalizeReachSurface(parsed.surface);
    } catch {
      return null;
    }
  }

  private detectDesktopPresence(): boolean {
    const candidates = [
      path.join(this.projectRoot, 'apps', 'zavorth-desktop'),
      path.join(this.projectRoot, 'apps', 'zavorth-control-vite-shell'),
    ];
    return candidates.some((candidate) => fs.existsSync(candidate));
  }
}

function clean(value: unknown): string {
  return String(value || '').trim();
}

function normalizeReachSurface(value: unknown): ReachPathId | null {
  const key = clean(value).toLowerCase();
  if (!key) return null;
  if (key === 'desktop' || key === 'app' || key === 'casa') return 'desktop';
  if (key === 'telegram' || key === 'tg') return 'telegram';
  if (key === 'web' || key === 'browser') return 'web';
  if (key === 'cli' || key === 'terminal') return 'cli';
  return null;
}
