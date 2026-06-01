import type {
  ChannelMeshSnapshot,
  ChannelMeshSnapshotEntry,
} from '../contracts/ChannelMeshContract.js';
import type {
  ChannelExperienceCertificationCheck,
  ChannelExperienceCertificationEntry,
  ChannelExperienceCertificationStatus,
  ChannelExperienceCertificationSnapshot,
} from '../contracts/ChannelExperienceCertificationContract.js';
import type {
  ChannelExperienceParityEntry,
  ChannelExperienceParitySnapshot,
} from './ChannelExperienceParityService.js';
import { ChannelExperienceParityService } from './ChannelExperienceParityService.js';
import { getSharedSurfaceCommandContract } from './SharedSurfaceCommandContract.js';
import { createSurfaceResponse, renderSurfaceResponseForTarget } from '../domain/surface/application/surface-response/index.js';
import { isSharedSurfaceChannelCallbackAction } from '../domain/surface/presentation/shared-surface/SharedSurfaceCallbackCommandPolicy.js';
import { resolveSharedSurfaceRenderTarget } from '../domain/surface/presentation/shared-surface/SharedSurfaceResponseSender.js';
import { ZavorthChannelMeshService } from './ZavorthChannelMeshService.js';

type ChannelExperienceCertificationRuntime = {
  now?: () => Date;
  channelMeshService?: Pick<ZavorthChannelMeshService, 'buildSnapshot'>;
  channelExperienceParityService?: Pick<ChannelExperienceParityService, 'buildSnapshot'>;
  requiredChannelIds?: string[];
  extendedChannelIds?: string[];
};

const REQUIRED_CERTIFIED_CHANNELS = [
  'telegram',
  'discord',
  'whatsapp',
  'slack',
  'signal',
  'imessage',
  'instagram',
];

const EXTENDED_CERTIFIED_CHANNELS = [
  'teams',
  'email',
  'web',
];

const REQUIRED_CHANNEL_EXPERIENCE_COMMANDS = [
  '/help',
  '/commands',
  '/channels',
  '/models',
  '/status',
  '/gateway',
];

const REFERENCE_BASELINE_BY_CHANNEL: Record<string, string[]> = {
  telegram: ['inline buttons', 'model menus', 'slash-like commands', 'chunked rich replies'],
  discord: ['slash commands', 'button components', 'status cards', 'safe mentions'],
  whatsapp: ['channel status', 'QR/login or cloud webhook', 'text fallback actions', 'recipient policy'],
  slack: ['interactive commands', 'webhook status', 'operator buttons', 'channel policy'],
  signal: ['bridge status', 'recipient allowlist', 'doctor', 'plain rich fallback'],
  imessage: ['macOS bridge status', 'read-only/approval posture', 'recipient allowlist', 'plain rich fallback'],
  instagram: ['Meta webhook status', 'DM recipient policy', 'rich fallback', 'business account readiness'],
  teams: ['Graph/Bot status', 'slash-like commands', 'webhook status', 'operator buttons'],
  email: ['fallback delivery', 'recipient policy', 'approvals', 'plain rich fallback'],
  web: ['dashboard status card', 'actions', 'operator command surface', 'rich web response'],
};

export class ChannelExperienceCertificationService {
  private readonly now: () => Date;
  private readonly channelMesh: Pick<ZavorthChannelMeshService, 'buildSnapshot'>;
  private readonly parity: Pick<ChannelExperienceParityService, 'buildSnapshot'>;
  private readonly requiredChannelIds: string[];
  private readonly extendedChannelIds: string[];

  public constructor(runtime: ChannelExperienceCertificationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.channelMesh = runtime.channelMeshService || new ZavorthChannelMeshService();
    this.parity = runtime.channelExperienceParityService || new ChannelExperienceParityService({
      channelMeshService: this.channelMesh,
      targetChannelIds: [
        ...(runtime.requiredChannelIds || REQUIRED_CERTIFIED_CHANNELS),
        ...(runtime.extendedChannelIds || EXTENDED_CERTIFIED_CHANNELS),
      ],
    });
    this.requiredChannelIds = runtime.requiredChannelIds || REQUIRED_CERTIFIED_CHANNELS;
    this.extendedChannelIds = runtime.extendedChannelIds || EXTENDED_CERTIFIED_CHANNELS;
  }

  public buildSnapshot(input: { selectedId?: string | null } = {}): ChannelExperienceCertificationSnapshot {
    const mesh = this.channelMesh.buildSnapshot({ selectedId: null });
    const parity = this.parity.buildSnapshot({ selectedId: null });
    const targetIds = this.resolveTargetIds(mesh);
    const entries = targetIds.map((channelId) => this.buildEntry(channelId, mesh, parity));
    const selectedId = this.normalizeId(input.selectedId);
    const selected = selectedId
      ? entries.find((entry) => entry.channelId === selectedId) || null
      : null;
    const summary = this.buildSummary(entries);
    const smokePlan = this.buildSmokePlan(entries);
    const dashboardEvidence = this.buildDashboardEvidence(entries);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: 'channel-experience-certification.v1',
      profile: 'zavorth-channel-experience',
      summary,
      entries,
      selected,
      smokePlan,
      dashboardEvidence,
      narrative: {
        headline: 'Certificacao de experiencia dos canais do Zavorth',
        operatorSummary:
          `${summary.certified} certificado(s), ${summary.usable} usavel(is), ${summary.partial} parcial(is), `
          + `${summary.missing} ausente(s), ${summary.blockers} bloqueador(es).`,
        nextAction: this.buildNextAction(entries),
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
      `Gate: ${snapshot.summary.releaseReady ? 'release-ready' : 'bloqueado'} | requisitos: ${snapshot.summary.requiredPassed}/${snapshot.summary.requiredTotal}.`,
      '',
      'Matriz:',
    ];

    for (const entry of entries.slice(0, snapshot.selected ? 1 : 14)) {
      lines.push(`- ${entry.label}: ${entry.status} (${entry.score.percent}%) - ${entry.summary}`);
      for (const blocker of entry.blockers.slice(0, 2)) {
        lines.push(`  * blocker: ${blocker}`);
      }
    }

    lines.push(
      '',
      'Smokes globais:',
      ...snapshot.smokePlan.globalCommands.map((command) => `- ${command}`),
      '',
      `Dashboard: ${snapshot.dashboardEvidence.status} - ${snapshot.dashboardEvidence.note}`,
      '',
      `Next: ${snapshot.narrative.nextAction}`,
    );
    return lines.join('\n');
  }

  private buildEntry(
    channelId: string,
    mesh: ChannelMeshSnapshot,
    parity: ChannelExperienceParitySnapshot,
  ): ChannelExperienceCertificationEntry {
    const meshEntry = mesh.entries.find((entry) => this.normalizeId(entry.id) === channelId) || null;
    const parityEntry = parity.entries.find((entry) => entry.channelId === channelId) || null;
    const checks = this.buildChecks(channelId, meshEntry, parityEntry);
    const required = checks.filter((check) => check.required && check.status !== 'na');
    const passed = required.filter((check) => check.status === 'pass');
    const blockers = required
      .filter((check) => check.status === 'fail')
      .map((check) => `${check.label}: ${check.detail}`);
    const status = this.resolveStatus(meshEntry, required.length, passed.length, blockers);

    return {
      channelId,
      label: meshEntry?.label || parityEntry?.label || this.toLabel(channelId),
      status,
      readiness: meshEntry?.readiness || parityEntry?.readiness || 'missing',
      transport: meshEntry?.transport || parityEntry?.transport || 'missing',
      implementationState: meshEntry?.implementationState || parityEntry?.implementationState || 'missing',
      score: {
        passed: passed.length,
        required: required.length,
        percent: required.length > 0 ? Math.round((passed.length / required.length) * 100) : 100,
      },
      summary: this.buildEntrySummary(channelId, meshEntry, status, blockers),
      checks,
      blockers,
      referenceBaseline: REFERENCE_BASELINE_BY_CHANNEL[channelId] || ['status', 'commands', 'safe delivery'],
      zavorthEvidence: this.buildZavorthEvidence(channelId, meshEntry, parityEntry),
      smokeCommands: this.buildChannelSmokeCommands(channelId, meshEntry),
    };
  }

  private buildChecks(
    channelId: string,
    meshEntry: ChannelMeshSnapshotEntry | null,
    parityEntry: ChannelExperienceParityEntry | null,
  ): ChannelExperienceCertificationCheck[] {
    const actionKinds = new Set((meshEntry?.actions || []).map((action) => action.kind));
    const commandDeckReady = this.hasRequiredCommandDeck();
    const renderTarget = resolveSharedSurfaceRenderTarget(channelId);
    const rendererReady = renderTarget !== 'plain' || channelId === 'web';
    const renderSmokeReady = this.canRenderSurfaceForChannel(channelId);
    const richFallbackReady = ['whatsapp', 'instagram', 'teams', 'signal', 'imessage', 'email', 'web'].includes(channelId)
      && renderSmokeReady;
    const statusReady = Boolean(meshEntry?.interactiveSurface?.statusCard || (meshEntry?.statusRows || []).length > 0);
    const guidedActionsReady = ['inspect', 'status', 'policy', 'doctor'].every((kind) => actionKinds.has(kind as any));
    const policyReady = Boolean(meshEntry?.policy || meshEntry?.features.groupPolicy || channelId === 'web');
    const safeCallbacksReady =
      isSharedSurfaceChannelCallbackAction('status')
      && isSharedSurfaceChannelCallbackAction('login-qr')
      && !isSharedSurfaceChannelCallbackAction('logout');
    const parityRichReady = this.parityCheckPassed(parityEntry, 'rich-replies');
    const parityGuidedReady = this.parityCheckPassed(parityEntry, 'guided-actions');
    const qrRequired = channelId === 'whatsapp' && !this.isWebhookBacked(meshEntry);
    const qrReady = Boolean(
      meshEntry?.loginQr?.supported
      && ['ready', 'connected', 'not_requested', 'pending'].includes(String(meshEntry.loginQr.state || '').toLowerCase()),
    );
    const webhookRequired = this.requiresWebhook(channelId, meshEntry);
    const webhookReady = Boolean(meshEntry?.features.webhook || meshEntry?.webhookPath);
    const bridgeRequired = channelId === 'signal' || channelId === 'imessage';
    const bridgeReady = Boolean(meshEntry?.features.localBridge || meshEntry?.transport === 'bridge' || meshEntry?.transport === 'local');
    const modelMenuReady = Boolean(meshEntry?.interactiveSurface?.modelMenus || commandDeckReady);
    const sessionContinuityReady = Boolean(
      meshEntry?.features.sessionList
      && meshEntry?.features.sessionHistory
      && (meshEntry?.features.sessionSend || actionKinds.has('send-test') || meshEntry?.readiness !== 'ready'),
    );
    const dashboardReady = Boolean(meshEntry && statusReady && guidedActionsReady && (meshEntry.statusRows || []).length > 0);

    return [
      this.check('adapter', 'Adapter/canal registrado', true, Boolean(meshEntry), 'canal precisa existir no Channel Mesh', [meshEntry?.summary || '']),
      this.check('status-card', 'Status por canal visivel', true, statusReady, 'status card/linhas de status precisam estar no contrato', this.statusEvidence(meshEntry)),
      this.check('shared-renderer', 'Resposta rica multi-canal', true, rendererReady && renderSmokeReady && (parityRichReady || richFallbackReady), 'renderer compartilhado precisa ter alvo e smoke por canal', [`target=${renderTarget}`, parityEntry?.summary || '']),
      this.check('guided-actions', 'Acoes guiadas equivalentes', true, guidedActionsReady && parityGuidedReady, 'acoes minimas inspect/status/policy/doctor precisam existir', Array.from(actionKinds)),
      this.check('command-deck', 'Command deck de canais', true, commandDeckReady, `comandos exigidos: ${REQUIRED_CHANNEL_EXPERIENCE_COMMANDS.join(', ')}`, REQUIRED_CHANNEL_EXPERIENCE_COMMANDS),
      this.check('model-menu', 'Selecao de modelo acessivel', true, modelMenuReady, '/models precisa existir com menu nativo ou fallback textual', [`modelMenus=${Boolean(meshEntry?.interactiveSurface?.modelMenus)}`]),
      this.check('connection-state', 'Estado de conexao/login', true, Boolean(meshEntry?.connection || (meshEntry?.statusRows || []).length > 0 || typeof meshEntry?.configured === 'boolean'), 'operador precisa ver conectado/configurado/erro', this.statusEvidence(meshEntry)),
      this.check('governance', 'Policy e callbacks seguros', true, policyReady && safeCallbacksReady, 'mutacoes perigosas precisam exigir comando/confirmacao e policy visivel', [meshEntry?.policy?.summary || 'policy n/d']),
      this.check('session-continuity', 'Historico e envio por sessao', true, sessionContinuityReady, 'session list/history/send precisam estar modelados ou bloqueados por readiness', this.featureEvidence(meshEntry)),
      this.check('dashboard-contract', 'Dashboard operavel por contrato', true, dashboardReady, 'dashboard precisa receber status rows e actions reais do mesh', [`rows=${meshEntry?.statusRows?.length || 0}`, `actions=${meshEntry?.actions?.length || 0}`]),
      this.check('qr-login', 'QR/login WhatsApp', qrRequired, qrReady, 'WhatsApp local precisa expor QR/login/relink/logout', [meshEntry?.loginQr?.state || 'qr n/d']),
      this.check('webhook-status', 'Webhook/status publico', webhookRequired, webhookReady, 'canais webhook precisam expor path/status', [meshEntry?.webhookPath || 'webhook n/d']),
      this.check('local-bridge', 'Bridge local governada', bridgeRequired, bridgeReady, 'Signal/iMessage precisam mostrar bridge local e allowlist', this.featureEvidence(meshEntry)),
    ];
  }

  private buildSummary(entries: ChannelExperienceCertificationEntry[]): ChannelExperienceCertificationSnapshot['summary'] {
    const requiredEntries = entries.filter((entry) => this.requiredChannelIds.includes(entry.channelId));
    const requiredTotal = requiredEntries.reduce((total, entry) => total + entry.score.required, 0);
    const requiredPassed = requiredEntries.reduce((total, entry) => total + entry.score.passed, 0);
    const blockers = requiredEntries.reduce((total, entry) => total + entry.blockers.length, 0);
    return {
      total: entries.length,
      certified: entries.filter((entry) => entry.status === 'certified').length,
      usable: entries.filter((entry) => entry.status === 'usable').length,
      partial: entries.filter((entry) => entry.status === 'partial').length,
      missing: entries.filter((entry) => entry.status === 'missing').length,
      blockers,
      requiredPassed,
      requiredTotal,
      releaseReady: blockers === 0 && requiredEntries.every((entry) => entry.status === 'certified'),
    };
  }

  private buildSmokePlan(entries: ChannelExperienceCertificationEntry[]): ChannelExperienceCertificationSnapshot['smokePlan'] {
    const requiredEntries = entries.filter((entry) => this.requiredChannelIds.includes(entry.channelId));
    return {
      globalCommands: [
        'npm run channel-experience-certification',
        'npm run channel-experience-certification:check',
        '/channels parity',
        '/channels',
        '/commands channel',
        '/models',
        '/status',
        '/gateway',
      ],
      channelCommands: requiredEntries.map((entry) => ({
        channelId: entry.channelId,
        commands: entry.smokeCommands,
      })),
      notes: [
        'Smokes de envio real continuam dependentes de credenciais e allowlists do ambiente.',
        'O gate valida contrato, renderizacao, comandos, QR/status/actions e governanca sem enviar mensagens externas.',
      ],
    };
  }

  private buildDashboardEvidence(entries: ChannelExperienceCertificationEntry[]): ChannelExperienceCertificationSnapshot['dashboardEvidence'] {
    const requiredEntries = entries.filter((entry) => this.requiredChannelIds.includes(entry.channelId));
    const hasDashboardContract = requiredEntries.every((entry) =>
      entry.checks.some((check) => check.id === 'dashboard-contract' && check.status === 'pass'));
    return {
      status: hasDashboardContract ? 'contract-ready' : 'blocked',
      note: hasDashboardContract
        ? 'O backend entrega status rows, actions e QR/login para o dashboard sem exigir terminal.'
        : 'Algum canal essencial ainda nao entrega status/actions suficientes para o dashboard.',
      routes: [
        '/api/web/channels',
        '/api/web/channels/actions',
        '/api/web/channels/:id',
        '/api/webhooks/whatsapp',
        '/api/webhooks/instagram',
      ],
      requiredSurfaceItems: [
        'status card',
        'actions',
        'login-qr',
        'policy',
        'doctor',
        'webhook status',
      ],
    };
  }

  private buildZavorthEvidence(
    channelId: string,
    meshEntry: ChannelMeshSnapshotEntry | null,
    parityEntry: ChannelExperienceParityEntry | null,
  ): string[] {
    if (!meshEntry) {
      return ['canal ausente'];
    }
    return [
      `readiness=${meshEntry.readiness}`,
      `transport=${meshEntry.transport}`,
      `provider=${meshEntry.provider || 'n/d'}`,
      `actions=${(meshEntry.actions || []).map((action) => action.kind).join(',') || 'n/d'}`,
      `policy=${meshEntry.policy?.state || 'n/d'}`,
      `parity=${parityEntry?.status || 'n/d'}`,
    ];
  }

  private buildChannelSmokeCommands(channelId: string, meshEntry: ChannelMeshSnapshotEntry | null): string[] {
    const commands = [
      `/channels ${channelId}`,
      `/channels status ${channelId}`,
      `/channels policy ${channelId}`,
      `/channels doctor ${channelId}`,
      `/channels parity ${channelId}`,
    ];
    if (channelId === 'whatsapp' && (meshEntry?.features.qrLogin || meshEntry?.loginQr?.supported)) {
      commands.push('/channels login-qr whatsapp');
      commands.push('/channels relink whatsapp');
    }
    if (meshEntry?.features.outbound && meshEntry.readiness !== 'planned' && meshEntry.readiness !== 'disabled') {
      commands.push(`/channels send-test ${channelId}`);
    }
    return commands;
  }

  private resolveStatus(
    meshEntry: ChannelMeshSnapshotEntry | null,
    requiredCount: number,
    passedCount: number,
    blockers: string[],
  ): ChannelExperienceCertificationStatus {
    if (!meshEntry) {
      return 'missing';
    }
    if (blockers.length === 0) {
      return 'certified';
    }
    const ratio = requiredCount > 0 ? passedCount / requiredCount : 1;
    if (ratio >= 0.85) {
      return 'usable';
    }
    if (ratio >= 0.5) {
      return 'partial';
    }
    return 'missing';
  }

  private buildEntrySummary(
    channelId: string,
    meshEntry: ChannelMeshSnapshotEntry | null,
    status: ChannelExperienceCertificationStatus,
    blockers: string[],
  ): string {
    if (!meshEntry) {
      return 'Canal ausente da matriz, logo nao pode ser declarado equivalente ao baseline de referencia.';
    }
    if (status === 'certified') {
      return 'Equivalente no contrato: status, comandos, resposta rica, actions e guardrails estao presentes.';
    }
    if (status === 'usable') {
      return `Quase equivalente, mas ainda tem ${blockers.length} bloqueador(es) antes do selo final.`;
    }
    if (channelId === 'instagram') {
      return 'Instagram precisa permanecer explicito: DM real depende de Meta Messaging/API, webhook e recipients.';
    }
    return `Paridade parcial com ${blockers.length} bloqueador(es).`;
  }

  private buildNextAction(entries: ChannelExperienceCertificationEntry[]): string {
    const firstRequiredBlocker = entries
      .filter((entry) => this.requiredChannelIds.includes(entry.channelId))
      .find((entry) => entry.blockers.length > 0);
    if (firstRequiredBlocker) {
      return `/channels parity ${firstRequiredBlocker.channelId} e fechar: ${firstRequiredBlocker.blockers[0]}`;
    }
    return 'Manter npm run channel-experience-certification:check no QA antes de alterar qualquer canal.';
  }

  private resolveTargetIds(mesh: ChannelMeshSnapshot): string[] {
    return Array.from(new Set([
      ...this.requiredChannelIds,
      ...this.extendedChannelIds,
      ...mesh.entries.map((entry) => this.normalizeId(entry.id)).filter(Boolean),
    ]));
  }

  private hasRequiredCommandDeck(): boolean {
    const commands = new Set(getSharedSurfaceCommandContract().map((entry) => entry.commandType));
    return REQUIRED_CHANNEL_EXPERIENCE_COMMANDS.every((command) => commands.has(command));
  }

  private canRenderSurfaceForChannel(channelId: string): boolean {
    const target = resolveSharedSurfaceRenderTarget(channelId);
    const response = createSurfaceResponse({
      id: `channel-experience-cert-${channelId}`,
      intent: 'status',
      title: `Channel experience certification ${channelId}`,
      summary: 'render smoke',
      blocks: [
        {
          kind: 'list',
          title: 'Smoke',
          items: ['/channels', '/models', '/status'],
        },
      ],
      actions: [
        {
          id: `status-${channelId}`,
          label: 'Status',
          kind: 'command',
          command: `/channels status ${channelId}`,
          callbackData: `/channels status ${channelId}`,
          style: 'primary',
        },
      ],
    });
    const rendered = renderSurfaceResponseForTarget(target === 'plain' ? 'plain' : target, response);
    return rendered.text.includes('Channel experience certification') && rendered.actions.length > 0;
  }

  private parityCheckPassed(entry: ChannelExperienceParityEntry | null, checkId: string): boolean {
    return Boolean(entry?.checks.some((check) => check.id === checkId && check.status === 'pass'));
  }

  private requiresWebhook(channelId: string, meshEntry: ChannelMeshSnapshotEntry | null): boolean {
    if (!meshEntry) {
      return channelId === 'instagram';
    }
    if (channelId === 'instagram') {
      return this.isWebhookBacked(meshEntry) || String(meshEntry.provider || '').toLowerCase() === 'instagram-messaging-api';
    }
    if (channelId === 'whatsapp') {
      return this.isWebhookBacked(meshEntry);
    }
    return ['slack', 'teams'].includes(channelId) && Boolean(meshEntry.features.webhook);
  }

  private isWebhookBacked(meshEntry: ChannelMeshSnapshotEntry | null): boolean {
    const transport = String(meshEntry?.transport || '').trim().toLowerCase();
    return transport === 'webhook' || Boolean(meshEntry?.features.webhook);
  }

  private statusEvidence(meshEntry: ChannelMeshSnapshotEntry | null): string[] {
    return (meshEntry?.statusRows || []).map((row) => `${row.label}: ${row.value}`);
  }

  private featureEvidence(meshEntry: ChannelMeshSnapshotEntry | null): string[] {
    if (!meshEntry) {
      return [];
    }
    return Object.entries(meshEntry.features)
      .filter(([, value]) => value === true)
      .map(([key]) => key);
  }

  private check(
    id: string,
    label: string,
    required: boolean,
    passed: boolean,
    detail: string,
    evidence: string[],
  ): ChannelExperienceCertificationCheck {
    if (!required) {
      return {
        id,
        label,
        required,
        status: 'na',
        detail,
        evidence: evidence.filter(Boolean),
      };
    }
    return {
      id,
      label,
      required,
      status: passed ? 'pass' : 'fail',
      detail,
      evidence: evidence.filter(Boolean),
    };
  }

  private normalizeId(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private toLabel(value: string): string {
    return String(value || '').trim().replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

export { REQUIRED_CERTIFIED_CHANNELS, REQUIRED_CHANNEL_EXPERIENCE_COMMANDS };
