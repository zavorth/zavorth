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
  | 'ready'
  | 'needs-setup'
  | 'experimental'
  | 'optional';

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
  ready: 'ready to use',
  'needs-setup': 'Needs setup',
  experimental: 'Experimental',
  optional: 'optional',
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
      headline: 'Onde you me encontra',
      summary: stableReadyCount > 0
        ? `${stableReadyCount} path(s) stable(is) ready. Prefer Desktop e Telegram.`
        : 'No stable channel is configured yet. Start with Desktop or Telegram.',
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
        summary: 'Melhor path no computador para qualquer pessoa.',
        status: 'ready',
        statusLabel: STATUS_LABELS.ready,
        recommended: preferred === 'desktop' || !preferred,
        stable: true,
        ready: true,
        howToStart: desktopHint ? 'Open the Zavorth Desktop app and start chatting.'
          : 'No projeto: zavorth open (ou abra o Desktop se instalado).',
        setupSteps: [
          'Instale ou abra o Zavorth Desktop / Control.',
          'Use natural language; first-run guides language and learning.',
        ],
        envHints: [],
        nextStep: null,
        productTier: 'T0',
      },
      {
        id: 'telegram',
        title: 'Telegram',
        summary: telegramToken ? 'Bot configured — path stable no celular (T1).'
          : 'Stable mobile channel recommended.',
        status: telegramToken ? 'ready' : 'needs-setup',
        statusLabel: telegramToken ? STATUS_LABELS.ready : STATUS_LABELS['needs-setup'],
        recommended: preferred === 'telegram' || !telegramToken,
        stable: true,
        ready: Boolean(telegramToken),
        howToStart: telegramToken ? 'Open the Telegram bot and send any message.'
          : 'Crie um bot no @BotFather e cole o token.',
        setupSteps: [
          'No Telegram, fale com @BotFather e crie um bot.',
          'Copie o token.',
          'set TELEGRAM_BOT_TOKEN no ambiente /.env.',
          'Restart the Zavorth host and send a message to the bot.',
        ],
        envHints: ['TELEGRAM_BOT_TOKEN'],
        nextStep: telegramToken ? null : 'set TELEGRAM_BOT_TOKEN e reinicie.',
        productTier: telegramTier?.tier || 'T1',
      },
      {
        id: 'whatsapp-cloud',
        title: 'WhatsApp oficial (Cloud API)',
        summary: waToken && waPhone ? 'Cloud API configured — production path (T1).'
          : 'Stable WhatsApp via official Meta API (not Baileys).',
        status: waToken && waPhone ? 'ready' : 'needs-setup',
        statusLabel: waToken && waPhone ? STATUS_LABELS.ready : STATUS_LABELS['needs-setup'],
        recommended: preferred === 'desktop' ? false : false,
        stable: true,
        ready: Boolean(waToken && waPhone),
        howToStart: waToken && waPhone ? 'Use the number Business configured; messages enter through the webhook.'
          : 'Configure the Business app in Meta Developers.',
        setupSteps: [
          'Crie app Business no developers.facebook.com',
          'Enable the WhatsApp product and get the Phone Number ID plus a permanent token.',
          'set WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID.',
          'Configure the public webhook for /api/webhooks/whatsapp.',
        ],
        envHints: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN'],
        nextStep: waToken && waPhone ? null : 'Configure Cloud API or ignore it if you will not use WhatsApp.',
        productTier: waTier?.tier || 'T1',
      },
      {
        id: 'web',
        title: 'Web / Control',
        summary: 'Panel and chat in the browser experience.',
        status: 'optional',
        statusLabel: STATUS_LABELS.optional,
        recommended: preferred === 'web',
        stable: true,
        ready: true,
        howToStart: 'Open local Control (zavorth ui / experience web).',
        setupSteps: ['Start the local host and open the Zavorth web UI.'],
        envHints: [],
        nextStep: null,
        productTier: 'T0',
      },
      {
        id: 'cli',
        title: 'Terminal',
        summary: 'Para quem already usa linha de comando.',
        status: 'optional',
        statusLabel: STATUS_LABELS.optional,
        recommended: preferred === 'cli',
        stable: true,
        ready: true,
        howToStart: 'Use the chat CLI / zavorth open no terminal.',
        setupSteps: ['Instale o CLI e run o host local.'],
        envHints: [],
        nextStep: null,
        productTier: 'T0',
      },
      {
        id: 'whatsapp-baileys',
        title: 'WhatsApp experimental (Baileys)',
        summary: waProvider === 'baileys' || waBridge ? 'Baileys selected/bridge pointed — experimental T2, not the default path.'
          : 'QR pessoal via process isolado. So se Cloud API for inviavel.',
        status: 'experimental',
        statusLabel: STATUS_LABELS.experimental,
        recommended: false,
        stable: false,
        ready: Boolean(waBridge) || waProvider === 'baileys',
        howToStart: 'scripts/whatsapp-bridge + WHATSAPP_PROVIDER=baileys (advanced).',
        setupSteps: [
          'cd scripts/whatsapp-bridge && npm install',
          'npm run whatsapp-bridge:start e escaneie o QR',
          'WHATSAPP_PROVIDER=baileys e WHATSAPP_BRIDGE_URL=http://127.0.0.1:3910',
          'optional: WHATSAPP_BRIDGE_POLL=1 para inbound local',
        ],
        envHints: ['WHATSAPP_PROVIDER', 'WHATSAPP_BRIDGE_URL'],
        nextStep: 'Prefer WhatsApp Cloud. Use Baileys only if necessary.',
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
