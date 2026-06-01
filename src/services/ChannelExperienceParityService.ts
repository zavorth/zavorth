import type {
  ChannelMeshSnapshot,
  ChannelMeshSnapshotEntry,
} from '../contracts/ChannelMeshContract.js';
import { isSharedSurfaceChannelCallbackAction } from '../domain/surface/presentation/shared-surface/SharedSurfaceCallbackCommandPolicy.js';
import { ZavorthChannelMeshService } from './ZavorthChannelMeshService.js';

export type ChannelExperienceParityStatus = 'complete' | 'usable' | 'partial' | 'missing';
export type ChannelExperienceCheckStatus = 'pass' | 'fail' | 'na';

export type ChannelExperienceCheck = {
  id: string;
  label: string;
  required: boolean;
  status: ChannelExperienceCheckStatus;
  detail: string;
};

export type ChannelExperienceParityEntry = {
  channelId: string;
  label: string;
  present: boolean;
  readiness: string;
  implementationState: string;
  transport: string;
  status: ChannelExperienceParityStatus;
  score: {
    passed: number;
    required: number;
    percent: number;
  };
  summary: string;
  checks: ChannelExperienceCheck[];
  blockers: string[];
  nextActions: string[];
};

export type ChannelExperienceParitySnapshot = {
  generatedAt: string;
  contractVersion: 'channel-experience-parity.v1';
  summary: {
    total: number;
    complete: number;
    usable: number;
    partial: number;
    missing: number;
    criticalGaps: number;
    qrLoginReady: number;
    richRepliesReady: number;
    guardedCallbacksReady: number;
  };
  entries: ChannelExperienceParityEntry[];
  selected: ChannelExperienceParityEntry | null;
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
  commands: {
    overview: string;
    selected: string;
    channelMesh: string;
    commandDeck: string;
  };
};

type ChannelExperienceParityRuntime = {
  now?: () => Date;
  channelMeshService?: Pick<ZavorthChannelMeshService, 'buildSnapshot'>;
  targetChannelIds?: string[];
};

type ChannelExperienceProfile = {
  id: string;
  label: string;
  nativeButtonsRequired: boolean;
  slashCommandsRequired: boolean;
  qrLoginRequired: boolean;
  localBridgeRequired: boolean;
};

const DEFAULT_TARGET_CHANNELS = [
  'telegram',
  'discord',
  'whatsapp',
  'slack',
  'signal',
  'imessage',
  'teams',
  'email',
  'web',
  'instagram',
];

const CHANNEL_PROFILES: Record<string, ChannelExperienceProfile> = {
  telegram: makeProfile('telegram', 'Telegram', { nativeButtonsRequired: true, slashCommandsRequired: true }),
  discord: makeProfile('discord', 'Discord', { nativeButtonsRequired: true, slashCommandsRequired: true }),
  whatsapp: makeProfile('whatsapp', 'WhatsApp', { qrLoginRequired: true }),
  slack: makeProfile('slack', 'Slack', { nativeButtonsRequired: true, slashCommandsRequired: true }),
  signal: makeProfile('signal', 'Signal', { localBridgeRequired: true }),
  imessage: makeProfile('imessage', 'iMessage', { localBridgeRequired: true }),
  teams: makeProfile('teams', 'Microsoft Teams', { nativeButtonsRequired: true, slashCommandsRequired: true }),
  email: makeProfile('email', 'Email', {}),
  web: makeProfile('web', 'Web', { nativeButtonsRequired: true }),
  instagram: makeProfile('instagram', 'Instagram', {}),
};

export class ChannelExperienceParityService {
  private readonly now: () => Date;
  private readonly channelMesh: Pick<ZavorthChannelMeshService, 'buildSnapshot'>;
  private readonly targetChannelIds: string[];

  constructor(runtime: ChannelExperienceParityRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.channelMesh = runtime.channelMeshService || new ZavorthChannelMeshService();
    this.targetChannelIds = runtime.targetChannelIds || DEFAULT_TARGET_CHANNELS;
  }

  public buildSnapshot(input: { selectedId?: string | null } = {}): ChannelExperienceParitySnapshot {
    const mesh = this.channelMesh.buildSnapshot({ selectedId: null });
    const targetIds = this.resolveTargetIds(mesh);
    const entries = targetIds.map((channelId) => this.buildEntry(channelId, mesh));
    const selectedId = String(input.selectedId || '').trim().toLowerCase();
    const selected = selectedId
      ? entries.find((entry) => entry.channelId === selectedId) || null
      : null;
    const summary = {
      total: entries.length,
      complete: entries.filter((entry) => entry.status === 'complete').length,
      usable: entries.filter((entry) => entry.status === 'usable').length,
      partial: entries.filter((entry) => entry.status === 'partial').length,
      missing: entries.filter((entry) => entry.status === 'missing').length,
      criticalGaps: entries.reduce((total, entry) => total + entry.blockers.length, 0),
      qrLoginReady: entries.filter((entry) => this.hasPassingCheck(entry, 'qr-login')).length,
      richRepliesReady: entries.filter((entry) => this.hasPassingCheck(entry, 'rich-replies')).length,
      guardedCallbacksReady: entries.filter((entry) => this.hasPassingCheck(entry, 'safe-callbacks')).length,
    };

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: 'channel-experience-parity.v1',
      summary,
      entries,
      selected,
      narrative: {
        headline: 'Paridade de experiencia por canal do Zavorth',
        operatorSummary:
          `${summary.complete} completo(s), ${summary.usable} usavel(is), ${summary.partial} parcial(is), `
          + `${summary.missing} ausente(s), ${summary.criticalGaps} gap(s) critico(s).`,
        nextAction: this.buildNextAction(entries),
      },
      commands: {
        overview: '/channels parity',
        selected: '/channels parity <canal>',
        channelMesh: '/channels',
        commandDeck: '/commands channel',
      },
    };
  }

  public renderReport(input: { selectedId?: string | null } = {}): string {
    const snapshot = this.buildSnapshot(input);
    const entries = snapshot.selected ? [snapshot.selected] : snapshot.entries;
    const lines = [
      snapshot.narrative.headline,
      '',
      snapshot.narrative.operatorSummary,
      `Rich replies: ${snapshot.summary.richRepliesReady}/${snapshot.summary.total} | callbacks guardados: ${snapshot.summary.guardedCallbacksReady}/${snapshot.summary.total} | QR/login: ${snapshot.summary.qrLoginReady}.`,
      '',
      'Canais:',
    ];

    for (const entry of entries.slice(0, snapshot.selected ? 1 : 12)) {
      lines.push(`- ${entry.label}: ${entry.status} (${entry.score.percent}%) - ${entry.summary}`);
      for (const blocker of entry.blockers.slice(0, 2)) {
        lines.push(`  * gap: ${blocker}`);
      }
    }

    lines.push('', `Next: ${snapshot.narrative.nextAction}`);
    return lines.join('\n');
  }

  private buildEntry(channelId: string, mesh: ChannelMeshSnapshot): ChannelExperienceParityEntry {
    const channelProfile = CHANNEL_PROFILES[channelId] || makeProfile(channelId, this.toLabel(channelId), {});
    const entry = mesh.entries.find((candidate) => this.normalizeId(candidate.id) === channelId) || null;
    const checks = this.buildChecks(channelProfile, entry);
    const required = checks.filter((check) => check.required && check.status !== 'na');
    const passed = required.filter((check) => check.status === 'pass');
    const blockers = required.filter((check) => check.status === 'fail').map((check) => `${check.label}: ${check.detail}`);
    const status = this.resolveStatus(entry, required.length, passed.length, blockers);
    const scorePercent = required.length > 0
      ? Math.round((passed.length / required.length) * 100)
      : 100;

    return {
      channelId,
      label: entry?.label || channelProfile.label,
      present: Boolean(entry),
      readiness: entry?.readiness || 'missing',
      implementationState: entry?.implementationState || 'missing',
      transport: entry?.transport || 'missing',
      status,
      score: {
        passed: passed.length,
        required: required.length,
        percent: scorePercent,
      },
      summary: this.buildSummary(channelProfile, entry, status, blockers),
      checks,
      blockers,
      nextActions: this.buildNextActions(channelProfile, entry, blockers),
    };
  }

  private buildChecks(profile: ChannelExperienceProfile, entry: ChannelMeshSnapshotEntry | null): ChannelExperienceCheck[] {
    const present = Boolean(entry);
    const statusRowsReady = Boolean(entry?.interactiveSurface?.statusCard || (entry?.statusRows || []).length > 0);
    const richRepliesReady = Boolean(entry?.features.richReplies || entry?.interactiveSurface?.richReplies);
    const guidedActionsReady = Boolean(
      entry?.features.interactiveControls
      || entry?.interactiveSurface?.inlineButtons
      || (entry?.actions || []).length > 0,
    );
    const nativeButtonsReady = Boolean(entry?.interactiveSurface?.inlineButtons);
    const slashCommandsReady = Boolean(entry?.features.slashCommands || entry?.interactiveSurface?.slashCommands);
    const qrLoginRequired = this.requiresQrLogin(profile, entry);
    const webhookStatusRequired = this.requiresWebhookStatus(profile, entry);
    const qrState = String(entry?.loginQr?.state || '').trim().toLowerCase();
    const qrReady = Boolean(
      entry?.loginQr?.supported
      && (qrState === 'ready' || qrState === 'connected')
    );
    const webhookReady = Boolean(entry?.features.webhook || entry?.webhookPath);
    const localBridgeReady = Boolean(entry?.features.localBridge || entry?.transport === 'bridge' || entry?.transport === 'local');
    const connectionVisible = Boolean(entry?.connection || (entry?.statusRows || []).length > 0 || typeof entry?.configured === 'boolean');
    const guardedCallbacksReady =
      isSharedSurfaceChannelCallbackAction('status')
      && isSharedSurfaceChannelCallbackAction('login-qr')
      && !isSharedSurfaceChannelCallbackAction('logout');

    return [
      check('adapter', 'Adapter registrado', true, present, present ? 'canal presente no Channel Mesh' : 'canal ausente do Channel Mesh'),
      check('status-card', 'Status por canal', true, statusRowsReady, statusRowsReady ? 'status card/linhas disponiveis' : 'sem status card legivel'),
      check('rich-replies', 'Resposta rica compartilhada', true, richRepliesReady, richRepliesReady ? 'rich replies disponiveis' : 'sem renderer rico neste canal'),
      check('guided-actions', 'Acoes guiadas', true, guidedActionsReady, guidedActionsReady ? 'acoes do Channel Mesh disponiveis' : 'sem acoes guiadas'),
      check('safe-callbacks', 'Callbacks seguros', true, present && guardedCallbacksReady, guardedCallbacksReady ? 'mutacoes exigem comando explicito' : 'policy de callback ausente'),
      check('connection-status', 'Status de conexao/login', true, connectionVisible, connectionVisible ? 'conexao exposta ao operador' : 'sem telemetria de conexao'),
      check('native-buttons', 'Botoes nativos', profile.nativeButtonsRequired, nativeButtonsReady, nativeButtonsReady ? 'botoes nativos disponiveis' : 'sem botoes nativos exigidos para este canal'),
      check('slash-commands', 'Slash/comandos nativos', profile.slashCommandsRequired, slashCommandsReady, slashCommandsReady ? 'comandos nativos disponiveis' : 'sem slash commands/comandos nativos'),
      check('qr-login', 'QR/login operacional', qrLoginRequired, qrReady, qrReady ? 'QR/login pronto para operador' : 'QR/login nao esta pronto no provider local'),
      check('webhook-status', 'Webhook operacional', webhookStatusRequired, webhookReady, webhookReady ? 'webhook/callback exposto ao operador' : 'webhook obrigatorio nao esta visivel'),
      check('local-bridge', 'Bridge local governada', profile.localBridgeRequired, localBridgeReady, localBridgeReady ? 'bridge local rastreada' : 'bridge local nao configurada'),
    ];
  }

  private requiresQrLogin(profile: ChannelExperienceProfile, entry: ChannelMeshSnapshotEntry | null): boolean {
    if (!profile.qrLoginRequired) {
      return false;
    }
    if (profile.id === 'whatsapp') {
      return !this.isWhatsAppCloudApi(entry);
    }
    return true;
  }

  private requiresWebhookStatus(profile: ChannelExperienceProfile, entry: ChannelMeshSnapshotEntry | null): boolean {
    if (profile.id !== 'whatsapp' && profile.id !== 'instagram') {
      return false;
    }
    if (profile.id === 'instagram') {
      return this.isInstagramMetaMessaging(entry);
    }
    return this.isWhatsAppCloudApi(entry);
  }

  private isWhatsAppCloudApi(entry: ChannelMeshSnapshotEntry | null): boolean {
    if (!entry) {
      return false;
    }
    const provider = String(entry.provider || '').trim().toLowerCase();
    const transport = String(entry.transport || '').trim().toLowerCase();
    return provider === 'meta-cloud-api' || provider === 'cloud-api' || transport === 'webhook';
  }

  private isInstagramMetaMessaging(entry: ChannelMeshSnapshotEntry | null): boolean {
    if (!entry) {
      return false;
    }
    const provider = String(entry.provider || '').trim().toLowerCase();
    const setupMode = String(entry.setupMode || '').trim().toLowerCase();
    const transport = String(entry.transport || '').trim().toLowerCase();
    return provider === 'instagram-messaging-api' || setupMode === 'meta-messaging' || transport === 'webhook';
  }

  private resolveStatus(
    entry: ChannelMeshSnapshotEntry | null,
    requiredCount: number,
    passedCount: number,
    blockers: string[],
  ): ChannelExperienceParityStatus {
    if (!entry) {
      return 'missing';
    }
    if (requiredCount === 0 || blockers.length === 0) {
      return 'complete';
    }
    const ratio = requiredCount > 0 ? passedCount / requiredCount : 1;
    if (ratio >= 0.75) {
      return 'usable';
    }
    return 'partial';
  }

  private buildSummary(
    profile: ChannelExperienceProfile,
    entry: ChannelMeshSnapshotEntry | null,
    status: ChannelExperienceParityStatus,
    blockers: string[],
  ): string {
    if (!entry) {
      return profile.id === 'instagram'
        ? 'Instagram nao esta registrado neste runtime; o gap fica explicito em vez de ser mascarado.'
        : 'Canal ainda nao esta registrado no Channel Mesh.';
    }
    if (status === 'complete') {
      return 'Experiencia equivalente pronta: status, resposta rica, comandos/acoes e guardrails estao visiveis.';
    }
    if (status === 'usable') {
      return `Usavel com ${blockers.length} gap(s) conhecido(s), sem bloquear o uso diario.`;
    }
    return `Parcial: ${blockers.length} requisito(s) ainda precisam fechamento.`;
  }

  private buildNextActions(
    profile: ChannelExperienceProfile,
    entry: ChannelMeshSnapshotEntry | null,
    blockers: string[],
  ): string[] {
    if (!entry && profile.id === 'instagram') {
      return [
        'Criar adapter Instagram DM via Meta Graph/Instagram Messaging API.',
        'Adicionar webhook, allowlist de recipients e receipts antes de envio real.',
      ];
    }
    if (!entry) {
      return [`Registrar ${profile.label} no Channel Mesh antes de prometer paridade.`];
    }
    if (blockers.length === 0) {
      return [entry.operatorNextStep || entry.actionHint || `/channels status ${profile.id}`];
    }
    return [
      entry.operatorNextStep || entry.actionHint || `/channels status ${profile.id}`,
      ...blockers.slice(0, 2).map((blocker) => `Fechar gap: ${blocker}`),
    ];
  }

  private buildNextAction(entries: ChannelExperienceParityEntry[]): string {
    const missingInstagram = entries.find((entry) => entry.channelId === 'instagram' && entry.status === 'missing');
    if (missingInstagram) {
      return 'Fechar o adapter Instagram DM ou manter o gap explicitamente fora do rollout.';
    }
    const firstGap = entries.find((entry) => entry.blockers.length > 0);
    return firstGap
      ? `/channels parity ${firstGap.channelId} e fechar: ${firstGap.blockers[0]}`
      : 'Manter os checks de paridade no doctor antes de cada rollout de canal.';
  }

  private hasPassingCheck(entry: ChannelExperienceParityEntry, checkId: string): boolean {
    return entry.checks.some((check) => check.id === checkId && check.status === 'pass');
  }

  private resolveTargetIds(mesh: ChannelMeshSnapshot): string[] {
    return Array.from(new Set([
      ...this.targetChannelIds.map((entry) => this.normalizeId(entry)).filter(Boolean),
      ...mesh.entries.map((entry) => this.normalizeId(entry.id)).filter(Boolean),
    ]));
  }

  private normalizeId(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private toLabel(value: string): string {
    return String(value || '').trim().replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

function makeProfile(
  id: string,
  label: string,
  overrides: Partial<Omit<ChannelExperienceProfile, 'id' | 'label'>>,
): ChannelExperienceProfile {
  return {
    id,
    label,
    nativeButtonsRequired: false,
    slashCommandsRequired: false,
    qrLoginRequired: false,
    localBridgeRequired: false,
    ...overrides,
  };
}

function check(
  id: string,
  label: string,
  required: boolean,
  passed: boolean,
  detail: string,
): ChannelExperienceCheck {
  if (!required) {
    return {
      id,
      label,
      required,
      status: 'na',
      detail,
    };
  }
  return {
    id,
    label,
    required,
    status: passed ? 'pass' : 'fail',
    detail,
  };
}
