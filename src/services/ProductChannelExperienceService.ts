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
    const controlEntry = String(input.controlEntry || '/dashboard').trim() || '/dashboard';
    const cliEntry = String(input.cliEntry || 'npm run cli -- status').trim() || 'npm run cli -- status';
    const hiddenSecondaryChannels = isBasicMode ? [...SECONDARY_CHANNEL_LABELS] : [];

    const surfaces: ProductChannelSurfaceHint[] = [
      {
        id: 'control',
        label: 'Dashboard',
        kind: 'web',
        primary: true,
        recommended: true,
        ready: input.controlReady !== false,
        visible: true,
        legacy: false,
        entry: controlEntry,
        description: 'Superficie principal do produto para conversar, aprovar e acompanhar o Zavorth.',
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
        description: telegramReady
          ? 'Primeiro canal externo recomendado para retomar, aprovar e disparar workflows.'
          : 'Primeiro canal externo recomendado quando voce quiser falar com o Zavorth fora da web.',
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
        description: 'Canal remoto adicional, indicado so quando o runtime realmente pedir isso.',
        hiddenReason: isBasicMode
          ? 'Oculto por padrao nos modos chat e assistant para manter a experiencia simples.'
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
        description: 'Superficie rapida para diagnostico, automacao e fallback local.',
        hiddenReason: null,
      },
    ];

    const journeys: ProductChannelJourney[] = [
      {
        id: 'web-only',
        label: 'Web only',
        description: 'Comece pelo /dashboard e mantenha os canais extras desligados ate sentir necessidade real.',
        recommended: !telegramReady,
        steps: [
          'Abra o dashboard.',
          'Converse e aprove tudo por ela.',
          'Deixe outros canais dormindo por padrao.',
        ],
      },
      {
        id: 'web+telegram',
        label: 'Web + Telegram',
        description: telegramReady
          ? 'Mantenha o /dashboard como centro e use Telegram como primeira extensao de bolso.'
          : 'Depois de estabilizar o /dashboard, conecte Telegram como primeiro canal externo recomendado.',
        recommended: telegramReady,
        steps: [
          'Use o dashboard como superficie principal.',
          'Conecte Telegram para retomar sessoes e approvals.',
          'Ligue canais secundarios so quando a tarefa pedir.',
        ],
      },
    ];

    const notes = [
      'A experiencia oficial comeca em /dashboard.',
      telegramReady
        ? 'Telegram ja esta pronto como primeiro canal externo.'
        : 'Telegram e o primeiro canal externo recomendado quando voce quiser sair do fluxo web-only.',
      isBasicMode
        ? 'Discord, Slack, WhatsApp e outros canais ficam ocultos por padrao nos modos basicos.'
        : 'Canais secundarios continuam disponiveis, mas Telegram segue sendo o primeiro caminho externo recomendado.',
      'CLI continua disponivel para operador/power user; /app e /classic foram removidas.',
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
