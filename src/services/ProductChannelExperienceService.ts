import { config } from '../config/index.js';
import {
  buildZavorthProductModeSnapshot,
  type ZavorthProductModeSnapshot,
} from './ProductModeService.js';

export type ProductChannelJourneyId = 'web-only' | 'web+telegram';
export type ProductChannelSurfaceId = 'control' | 'telegram' | 'discord' | 'cli';
export type ProductChannelSurfaceKind = 'web' | 'telegram' | 'discord' | 'cli';

export type ProductChannelJourney = {
  id: ProductChannelJourneyId;
  label: string;
  description: string;
  recommended: boolean;
  steps: string[];
};

export type ProductChannelSurfaceHint = {
  id: ProductChannelSurfaceId;
  label: string;
  kind: ProductChannelSurfaceKind;
  primary: boolean;
  recommended: boolean;
  ready: boolean;
  visible: boolean;
  legacy: boolean;
  entry: string;
  description: string;
  hiddenReason: string | null;
};

export type ProductChannelExperienceSnapshot = {
  generatedAt: string;
  productMode: ZavorthProductModeSnapshot;
  primarySurface: 'control';
  recommendedJourney: ProductChannelJourneyId;
  recommendedExternalChannel: 'telegram' | null;
  visibleSurfaces: ProductChannelSurfaceId[];
  hiddenSecondaryChannels: string[];
  legacySurfaces: ProductChannelSurfaceId[];
  journeys: ProductChannelJourney[];
  surfaces: ProductChannelSurfaceHint[];
  notes: string[];
};

type ProductChannelExperienceDeps = {
  now?: () => Date;
};

type BuildSnapshotInput = {
  productMode?: ZavorthProductModeSnapshot | null;
  controlEntry?: string | null;
  controlReady?: boolean;
  telegramReady?: boolean;
  discordReady?: boolean;
  cliEntry?: string | null;
  cliReady?: boolean;
};

const SECONDARY_CHANNEL_LABELS = ['Discord', 'Slack', 'WhatsApp', 'Instagram', 'Signal', 'Teams', 'Email', 'iMessage'];

export class ProductChannelExperienceService {
  private readonly now: () => Date;

  constructor(deps: ProductChannelExperienceDeps = {}) {
    this.now = deps.now || (() => new Date());
  }

  public buildSnapshot(input: BuildSnapshotInput = {}): ProductChannelExperienceSnapshot {
    const productMode =
      input.productMode
      || buildZavorthProductModeSnapshot(config.zavorthProductMode, config.zavorthProfile);
    const modeId = productMode.id;
    const isBasicMode = modeId === 'chat' || modeId === 'assistant';
    const telegramReady = input.telegramReady === true;
    const recommendedJourney: ProductChannelJourneyId = telegramReady ? 'web+telegram' : 'web-only';
    const controlEntry = String(input.controlEntry || '/zavorthControl').trim() || '/zavorthControl';
    const cliEntry = String(input.cliEntry || 'npm run cli -- status').trim() || 'npm run cli -- status';
    const hiddenSecondaryChannels = isBasicMode ? [...SECONDARY_CHANNEL_LABELS] : [];

    const surfaces: ProductChannelSurfaceHint[] = [
      {
        id: 'control',
        label: 'ZavorthControl',
        kind: 'web',
        primary: true,
        recommended: true,
        ready: input.controlReady !== false,
        visible: true,
        legacy: false,
        entry: controlEntry,
        description: 'surface principal do produto para conversar, approve e acompanhar o Zavorth.',
        hiddenReason: null,
      },
      {
        id: 'telegram',
        label: 'Telegram',
        kind: 'telegram',
        primary: false,
        recommended: true,
        ready: telegramReady,
        visible: true,
        legacy: false,
        entry: '/start',
        description: telegramReady ? 'Primeiro external channel recomendado para resume, approve e trigger workflows.'
          : 'First recommended external channel when operating Zavorth outside the web.',
        hiddenReason: null,
      },
      {
        id: 'discord',
        label: 'Discord',
        kind: 'discord',
        primary: false,
        recommended: false,
        ready: input.discordReady === true,
        visible: !isBasicMode,
        legacy: false,
        entry: '/status',
        description: 'Channel remote adicional, indicado so when o runtime realmente pedir isso.',
        hiddenReason: isBasicMode ? 'Hidden by default in chat and assistant modes to keep the experience simple.'
          : null,
      },
      {
        id: 'cli',
        label: 'CLI',
        kind: 'cli',
        primary: false,
        recommended: true,
        ready: input.cliReady !== false,
        visible: true,
        legacy: false,
        entry: cliEntry,
        description: 'Fast surface for diagnostics, automation, and local fallback.',
        hiddenReason: null,
      },
    ];

    const journeys: ProductChannelJourney[] = [
      {
        id: 'web-only',
        label: 'Web only',
        description: 'Comece pelo /zavorthControl e mantenha os channels extras desligados ate sentir necessidade real.',
        recommended: !telegramReady,
        steps: [
          'Open zavorthControl.',
          'Chat and approve everything through it.',
          'Deixe outros channels dormindo por default.',
        ],
      },
      {
        id: 'web+telegram',
        label: 'Web + Telegram',
        description: telegramReady ? 'Keep /zavorthControl as the center and use Telegram as the first pocket extension.'
          : 'after de estabilizar o /zavorthControl, conecte Telegram como recommended first external channel.',
        recommended: telegramReady,
        steps: [
          'Use zavorthControl as the primary surface.',
          'Connect Telegram to summarize sessions and approvals.',
          'Ligue channels secundarios so when a task pedir.',
        ],
      },
    ];

    const notes = [
      'The official experience starts in /zavorthControl.',
      telegramReady ? 'Telegram already is ready como first external channel.'
        : 'Telegram is the first recommended external channel when leaving the web-only flow.',
      isBasicMode ? 'Discord, Slack, WhatsApp e outros channels ficam ocultos por default in basic modes.'
        : 'Secondary channels remain available, but Telegram remains the first recommended external path.',
      'CLI continua available para operador/power user; /app e /classic foram removidas.',
    ];

    return {
      generatedAt: this.now().toISOString(),
      productMode,
      primarySurface: 'control',
      recommendedJourney,
      recommendedExternalChannel: 'telegram',
      visibleSurfaces: surfaces.filter((entry) => entry.visible).map((entry) => entry.id),
      hiddenSecondaryChannels,
      legacySurfaces: surfaces.filter((entry) => entry.legacy).map((entry) => entry.id),
      journeys,
      surfaces,
      notes,
    };
  }
}
