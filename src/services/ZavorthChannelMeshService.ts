import type {
  ChannelAdapterStatus,
  ChannelLoginQrSnapshot,
  ChannelPolicySummary,
  ChannelPolicyReloadReceipt,
  ChannelReadinessProof,
  ChannelMeshActionDescriptor,
  ChannelMeshSnapshot,
  ChannelMeshSnapshotEntry,
} from '../contracts/ChannelMeshContract.js';
import { ChannelPolicyManager } from '../channels/policies/ChannelPolicyManager.js';
import { GatewayChannelAdapterRegistryService } from './GatewayChannelAdapterRegistryService.js';

type ChannelPolicyControlPlane = Pick<ChannelPolicyManager, 'describePolicy' | 'reloadPolicies'>;

type ZavorthChannelMeshRuntime = {
  now?: () => Date;
  channelAdapterRegistryService?: Pick<GatewayChannelAdapterRegistryService, 'listAdapters' | 'getAdapter'>;
  channelPolicyManager?: ChannelPolicyControlPlane | null;
};

export type ChannelPolicyReloadControlResult = {
  generatedAt: string;
  selectedId: string | null;
  receipt: ChannelPolicyReloadReceipt;
  selected: ChannelMeshSnapshotEntry | null;
  snapshot: ChannelMeshSnapshot;
};

export class ZavorthChannelMeshService {
  private readonly now: () => Date;
  private readonly adapters: Pick<GatewayChannelAdapterRegistryService, 'listAdapters' | 'getAdapter'>;
  private readonly policies: ChannelPolicyControlPlane | null;

  constructor(runtime: ZavorthChannelMeshRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.adapters = runtime.channelAdapterRegistryService || new GatewayChannelAdapterRegistryService({
      includeLongTailActivationAdapters: true,
    });
    this.policies = runtime.channelPolicyManager === undefined
      ? new ChannelPolicyManager()
      : runtime.channelPolicyManager;
  }

  public buildSnapshot(input: { selectedId?: string | null } = {}): ChannelMeshSnapshot {
    const entries = this.adapters.listAdapters().map((entry) => this.fromAdapter(entry)).sort((left, right) =>
      left.label.localeCompare(right.label, 'en-US'),
    );
    const selected = this.selectEntry(entries, input.selectedId);
    const summary = {
      total: entries.length,
      ready: entries.filter((entry) => entry.readiness === 'ready').length,
      partial: entries.filter((entry) => entry.readiness === 'partial').length,
      planned: entries.filter((entry) => entry.readiness === 'planned').length,
      disabled: entries.filter((entry) => entry.readiness === 'disabled').length,
      configured: entries.filter((entry) => entry.configured).length,
      sessionSendReady: entries.filter((entry) => entry.features.sessionSend).length,
      attachments: entries.filter((entry) => entry.features.attachments).length,
      groupPolicy: entries.filter((entry) => entry.features.groupPolicy).length,
      liveReady: entries.filter((entry) => entry.liveReady).length,
      catalogReadyButNotLive: entries.filter((entry) => entry.readiness === 'ready' && !entry.liveReady).length,
      defaultRouteAllowed: entries.filter((entry) => entry.defaultRouteAllowed).length,
    };

    return {
      generatedAt: this.now().toISOString(),
      summary,
      entries,
      selected,
      featuredIds: this.buildFeaturedIds(entries),
      liveCompletion: this.buildLiveCompletion(summary),
      narrative: {
        headline: `Channel Mesh expoe ${summary.total} canal(is) com contrato visivel para o operador.`,
        operatorSummary:
          `${summary.ready} pronto(s), ${summary.partial} parcial(is), ${summary.planned} planejado(s) `
          + `${summary.sessionSendReady} com sessions_send imediato e ${summary.liveReady} live-ready.`,
      },
    };
  }

  public async reloadChannelPolicies(input: {
    selectedId?: string | null;
    actor?: string | null;
    reason?: string | null;
  } = {}): Promise<ChannelPolicyReloadControlResult> {
    if (!this.policies?.reloadPolicies) {
      throw new Error('ChannelPolicyManager indisponivel para recarregar policies.');
    }

    const selectedId = String(input.selectedId || '').trim().toLowerCase() || null;
    const receipt = await this.policies.reloadPolicies({
      actor: String(input.actor || '').trim() || 'operator',
      reason: String(input.reason || '').trim() || 'channel-mesh-action',
    });
    const snapshot = this.buildSnapshot({ selectedId });
    return {
      generatedAt: this.now().toISOString(),
      selectedId,
      receipt,
      selected: snapshot.selected,
      snapshot,
    };
  }

  public renderReport(input: { selectedId?: string | null } = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Channel Mesh do Zavorth',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Total: ${snapshot.summary.total} | prontos: ${snapshot.summary.ready} | parcial: ${snapshot.summary.partial} | planejados: ${snapshot.summary.planned}.`,
    ];

    if (snapshot.selected) {
      lines.push(
        '',
        `${snapshot.selected.label} [${snapshot.selected.id}]`,
        snapshot.selected.summary,
        `Transporte: ${snapshot.selected.transport}.`,
        `Readiness: ${snapshot.selected.readiness}.`,
        `Live ready: ${snapshot.selected.liveReady ? 'sim' : 'nao'} (${snapshot.selected.readinessProof}).`,
        snapshot.selected.defaultBlockReason
          ? `Bloqueio padrao: ${snapshot.selected.defaultBlockReason}`
          : 'Rota padrao: permitida para canal live-ready.',
        `Proximo passo: ${snapshot.selected.actionHint}.`,
      );
      if (snapshot.selected.tags.length > 0) {
        lines.push(`Tags: ${snapshot.selected.tags.join(', ')}.`);
      }
      if (snapshot.selected.notes.length > 0) {
        lines.push('', ...snapshot.selected.notes.slice(0, 4).map((note) => `- ${note}`));
      }
      return lines.join('\n');
    }

    lines.push('', 'Canais em destaque:');
    for (const entry of snapshot.entries.slice(0, 6)) {
      lines.push(`- ${entry.label} [${entry.readiness}] - ${entry.summary}`);
    }
    lines.push('', 'Use /channels <id> para aprofundar um canal especifico.');
    return lines.join('\n');
  }

  private fromAdapter(entry: ChannelAdapterStatus): ChannelMeshSnapshotEntry {
    const policy = entry.id !== 'web'
      ? this.policies?.describePolicy(String(entry.id || '').trim().toLowerCase()) || null
      : null;
    const actionHint = entry.operatorNextStep || this.buildActionHint(entry, policy);
    const notes = this.buildNotes(entry, policy);
    const normalizedEntry: ChannelAdapterStatus = {
      ...entry,
      statusRows: this.buildStatusRows(entry),
      loginQr: entry.loginQr || this.buildLoginQr(entry),
      interactiveSurface: entry.interactiveSurface || this.buildInteractiveSurface(entry),
    };
    const enrichedEntry: Omit<
      ChannelMeshSnapshotEntry,
      'liveReady' | 'defaultRouteAllowed' | 'readinessProof' | 'defaultBlockReason'
    > = {
      ...normalizedEntry,
      notes,
      riskLevel: normalizedEntry.riskLevel || this.buildRiskLevel(normalizedEntry),
      setupMode: normalizedEntry.setupMode || this.buildSetupMode(normalizedEntry),
      provider: normalizedEntry.provider || this.buildProvider(normalizedEntry),
      webhookPath: normalizedEntry.webhookPath || this.buildWebhookPath(normalizedEntry),
      doctorCommand: normalizedEntry.doctorCommand || 'npm run test:channels:smoke',
      lastHealth: normalizedEntry.lastHealth || this.buildLastHealth(normalizedEntry),
      lastEventAt: normalizedEntry.lastEventAt || null,
      operatorNextStep: actionHint,
      source: 'runtime',
      summary: this.buildSummary(normalizedEntry),
      operatorSummary: this.buildOperatorSummary(normalizedEntry, policy),
      actionHint,
      tags: this.buildTags(normalizedEntry, policy),
      actions: this.buildActions(normalizedEntry),
      policy,
    };
    return this.completeEntry(enrichedEntry);
  }

  private completeEntry(entry: Omit<
    ChannelMeshSnapshotEntry,
    'liveReady' | 'defaultRouteAllowed' | 'readinessProof' | 'defaultBlockReason'
  >): ChannelMeshSnapshotEntry {
    const readinessProof = this.resolveReadinessProof(entry);
    const liveReady = readinessProof === 'health' || readinessProof === 'live_event' || readinessProof === 'bridge';
    const defaultRouteAllowed = entry.readiness === 'ready'
      && liveReady
      && entry.configured
      && (entry.features.sessionSend || entry.features.outbound || entry.id === 'web');
    return {
      ...entry,
      liveReady,
      defaultRouteAllowed,
      readinessProof,
      defaultBlockReason: defaultRouteAllowed ? null : this.defaultBlockReason(entry, readinessProof),
    };
  }

  private resolveReadinessProof(entry: ChannelAdapterStatus): ChannelReadinessProof {
    if (entry.readiness === 'disabled' || entry.implementationState === 'planned') {
      return entry.readiness === 'disabled' ? 'blocked' : 'none';
    }
    if (entry.connection?.connected || entry.connection?.linked || entry.connection?.running) {
      return 'bridge';
    }
    if (entry.lastEventAt || entry.connection?.lastInboundAt || entry.connection?.lastOutboundAt) {
      return 'live_event';
    }
    if (entry.lastHealth === 'passed') {
      return 'health';
    }
    if (entry.configured) {
      return entry.readiness === 'ready' ? 'configuration' : 'catalog';
    }
    return entry.readiness === 'ready' ? 'catalog' : 'none';
  }

  private defaultBlockReason(entry: ChannelAdapterStatus, proof: ChannelReadinessProof): string {
    if (proof === 'blocked') {
      return 'Channel is disabled or blocked by current runtime configuration.';
    }
    if (entry.readiness !== 'ready') {
      return 'Channel is not ready; use prepare/doctor before enabling live actions.';
    }
    if (!entry.configured) {
      return 'Channel is known, but required configuration is missing.';
    }
    if (proof === 'configuration' || proof === 'catalog') {
      return 'Channel is configured/catalogued, but default live actions require health, bridge, or recent event proof.';
    }
    if (!entry.features.sessionSend && !entry.features.outbound && entry.id !== 'web') {
      return 'Channel does not expose an outbound/session path for default live routing.';
    }
    return 'Channel is not live-ready for default routing.';
  }

  private buildLiveCompletion(summary: ChannelMeshSnapshot['summary']): ChannelMeshSnapshot['liveCompletion'] {
    return {
      channelSelectionRequiresLiveProof: true,
      catalogSupportIsNotLiveProof: true,
      sensitiveActionsRequireLiveProof: true,
      liveBridgeRequiresExplicitOperatorAction: true,
      rawSecretsSerialized: false,
      publicApiChannelActionEndpoint: '/api/v1/channels/:id/action',
      defaultRoutingPolicy: 'ready-and-live-proof',
      counts: {
        catalogReady: summary.ready,
        liveReady: summary.liveReady,
        catalogReadyButNotLive: summary.catalogReadyButNotLive,
        defaultRouteAllowed: summary.defaultRouteAllowed,
      },
    };
  }

  private buildSummary(entry: ChannelAdapterStatus): string {
    if (entry.id === 'web') {
      return 'Canal local principal do app remoto, sempre presente no control plane.';
    }
    if (entry.id === 'whatsapp' && entry.transport === 'webhook' && entry.implementationState === 'full') {
      return 'Canal operacional via WhatsApp Cloud API, com webhook e outbound reais no mesh.';
    }
    if (entry.id === 'instagram' && entry.transport === 'webhook' && entry.implementationState === 'full') {
      return 'Canal operacional via Instagram Messaging API, com webhook e outbound reais no mesh.';
    }
    if (entry.id === 'slack' && entry.transport === 'native' && entry.implementationState === 'full') {
      return 'Canal operacional via Slack Web API, com inbound por webhook e outbound real.';
    }
    if (entry.id === 'signal') {
      return entry.readiness === 'ready'
        ? 'Canal Signal operando via bridge signal-cli supervisionada e allowlist fechada.'
        : 'Canal Signal mapeado via bridge signal-cli, ainda exigindo conta dedicada e doctor local.';
    }
    if (entry.id === 'imessage') {
      return entry.readiness === 'ready'
        ? 'Bridge iMessage via macOS Node Host validada para operacao supervisionada.'
        : 'iMessage mapeado como Mac bridge experimental, iniciando em modo read-only.';
    }
    if (entry.id === 'teams') {
      return 'Canal Microsoft Teams preparado para Graph/Bot Framework com tenant e conversas permitidas.';
    }
    if (entry.id === 'email') {
      return 'Canal Email preparado como fallback universal para notificacoes e approvals.';
    }
    if (entry.readiness === 'ready') {
      return 'Canal pronto para operar no mesh com leitura clara de features e policy.';
    }
    if (entry.readiness === 'partial') {
      return 'Canal ja conhecido pelo runtime, mas ainda pedindo configuracao ou policy final.';
    }
    if (entry.readiness === 'disabled') {
      return 'Canal conhecido, mas desligado por configuracao atual.';
    }
    return 'Canal mapeado no roadmap do mesh, ainda sem adapter operacional.';
  }

  private buildOperatorSummary(entry: ChannelAdapterStatus, policy: ChannelPolicySummary | null): string {
    const sendLabel = entry.features.sessionSend ? 'sessions_send pronto' : 'sessions_send indisponivel';
    const policyLabel = entry.features.groupPolicy ? 'policy por grupo disponivel' : 'sem policy de grupo';
    const doctorLabel = entry.features.doctor ? 'doctor disponivel' : 'sem doctor';
    const riskLabel = entry.riskLevel ? `risco ${entry.riskLevel}` : 'risco n/d';
    const accessLabel = policy ? `acesso ${policy.state}` : 'acesso n/d';
    const connectionLabel = entry.connection?.connected
      ? 'conectado'
      : entry.connection?.running
        ? 'runtime rodando'
        : 'conexao n/d';
    const qrLabel = entry.features.qrLogin
      ? `QR ${entry.loginQr?.state || 'pendente'}`
      : 'sem QR';
    return `${sendLabel}; ${policyLabel}; ${doctorLabel}; ${riskLabel}; ${accessLabel}; ${connectionLabel}; ${qrLabel}; transporte ${entry.transport}.`;
  }

  private buildActionHint(entry: ChannelAdapterStatus, policy: ChannelPolicySummary | null): string {
    const suffix = this.buildPolicyActionSuffix(policy);
    switch (entry.id) {
      case 'web':
        return 'Abra o app remoto ou use /sessionspawn web para abrir uma sessao derivada.';
      case 'telegram':
        return `Use /help no Telegram para navegar os comandos e manter a sessao viva.${suffix}`;
      case 'discord':
        return `Revisar a policy do Discord e o runtime do adapter antes de ampliar o rollout.${suffix}`;
      case 'whatsapp':
        if (entry.transport === 'webhook') {
          return `${entry.readiness === 'ready'
            ? 'Use /channels broadcast-test whatsapp e confirme o callback em /api/webhooks/whatsapp.'
            : 'Complete verify token, chats permitidos e callback /api/webhooks/whatsapp antes de ampliar o rollout.'}${suffix}`;
        }
        return `${entry.readiness === 'ready'
          ? 'Use /channels broadcast-test whatsapp para validar o runtime local supervisionado do WhatsApp.'
          : 'Configurar chats permitidos e bootstrap local supervisionado antes de prometer operacao real para WhatsApp.'}${suffix}`;
      case 'instagram':
        if (entry.transport === 'webhook') {
          return `${entry.readiness === 'ready'
            ? 'Use /channels broadcast-test instagram e confirme o callback em /api/webhooks/instagram.'
            : 'Complete business account, verify token, recipients permitidos e callback /api/webhooks/instagram antes do rollout.'}${suffix}`;
        }
        return `${entry.readiness === 'ready'
          ? 'Use /channels broadcast-test instagram para validar o outbox local supervisionado do Instagram.'
          : 'Preparar Meta Instagram Messaging API ou recipients permitidos antes de prometer DM real.'}${suffix}`;
      case 'slack':
        if (entry.transport === 'native') {
          return `${entry.readiness === 'ready'
            ? 'Use /channels broadcast-test slack e aponte o Slack para /api/webhooks/slack.'
            : 'Confirme bot token, canais permitidos e webhook /api/webhooks/slack antes de ampliar o rollout.'}${suffix}`;
        }
        return `${entry.readiness === 'ready'
          ? 'Use /channels broadcast-test slack para validar o runtime local supervisionado do Slack.'
          : 'Configurar canais permitidos e bootstrap local supervisionado antes de prometer operacao real para Slack.'}${suffix}`;
      case 'signal':
        return `Prepare signal-cli/JSON-RPC, SIGNAL_ACCOUNT_NUMBER e SIGNAL_ALLOWED_RECIPIENTS; depois rode /channels doctor signal.${suffix}`;
      case 'imessage':
        return `Suba um Node Host macOS, mantenha read-only e valide IMESSAGE_ALLOWED_RECIPIENTS antes de permitir envio.${suffix}`;
      case 'teams':
        return `Prepare TEAMS_APP_ID, TEAMS_TENANT_ID, secret e conversas permitidas antes de publicar o webhook /api/webhooks/teams.${suffix}`;
      case 'email':
        return `Configure EMAIL_ALLOWED_RECIPIENTS para local-outbox supervisionado; SMTP/IMAP podem entrar depois para outbound e approvals por resposta.${suffix}`;
      default:
        return `Revisar a readiness do canal e o adapter correspondente.${suffix}`;
    }
  }

  private buildTags(entry: ChannelAdapterStatus, policy: ChannelPolicySummary | null): string[] {
    return [
      String(entry.transport || 'unknown'),
      String(entry.implementationState || 'planned'),
      entry.features.attachments ? 'attachments' : 'text-only',
      entry.features.groupPolicy ? 'group-policy' : 'single-policy',
      entry.features.webhook ? 'webhook' : 'no-webhook',
      entry.features.localBridge ? 'local-bridge' : 'no-bridge',
      entry.features.interactiveControls ? 'interactive' : 'no-interactive',
      entry.features.richReplies ? 'rich-replies' : 'plain-replies',
      entry.features.qrLogin ? `qr-${entry.loginQr?.state || 'pending'}` : 'no-qr',
      entry.riskLevel ? `risk-${entry.riskLevel}` : 'risk-unknown',
      policy ? `policy-${policy.state}` : 'policy-unknown',
    ];
  }

  private buildNotes(entry: ChannelAdapterStatus, policy: ChannelPolicySummary | null): string[] {
    const notes = Array.isArray(entry.notes) ? entry.notes.slice() : [];
    if (policy) {
      notes.push(`Policy do canal: ${policy.summary}`);
    }
    return Array.from(new Set(notes.map((note) => String(note || '').trim()).filter(Boolean)));
  }

  private buildPolicyActionSuffix(policy: ChannelPolicySummary | null): string {
    if (!policy) {
      return '';
    }
    switch (policy.state) {
      case 'open':
        return ' Revise se open access ainda faz sentido antes de ampliar o rollout.';
      case 'allowlist':
        return ' A allowlist ja esta fechada; mantenha os IDs permitidos sincronizados com o canal real.';
      case 'mixed':
        return ' A policy mistura allowlist e blocklist; revise ambos os lados antes do rollout.';
      case 'blocked-only':
      case 'closed':
        return ' Defina uma allowlist ou habilite open access supervisionado antes de prometer uso amplo.';
      default:
        return '';
    }
  }

  private buildActions(entry: ChannelAdapterStatus): ChannelMeshActionDescriptor[] {
    const channelId = String(entry.id || '').trim().toLowerCase();
    const actions: ChannelMeshActionDescriptor[] = [
      {
        id: `${channelId}:inspect`,
        label: 'Inspecionar',
        kind: 'inspect',
        command: `/channels ${channelId}`,
      },
      {
        id: `${channelId}:status`,
        label: 'Status',
        kind: 'status',
        command: `/channels status ${channelId}`,
      },
      {
        id: `${channelId}:policy`,
        label: 'Ver policy',
        kind: 'policy',
        command: `/channels policy ${channelId}`,
      },
      {
        id: `${channelId}:doctor`,
        label: 'Rodar doctor',
        kind: 'doctor',
        command: `/channels doctor ${channelId}`,
      },
    ];

    if (channelId !== 'web') {
      actions.push({
        id: `${channelId}:policy-reload`,
        label: 'Recarregar policy',
        kind: 'policy-reload',
        command: `/channels policy-reload ${channelId}`,
      });
    }

    if (entry.readiness !== 'ready') {
      actions.push({
        id: `${channelId}:prepare`,
        label: channelId === 'slack' ? 'Preparar onboarding' : 'Preparar canal',
        kind: 'prepare',
        command: `/channels prepare ${channelId}`,
      });
    }

    if (entry.features.outbound && entry.readiness !== 'planned' && entry.readiness !== 'disabled') {
      actions.push({
        id: `${channelId}:broadcast-test`,
        label: 'Testar broadcast',
        kind: 'broadcast-test',
        command: `/channels broadcast-test ${channelId}`,
      });
      actions.push({
        id: `${channelId}:send-test`,
        label: 'Teste de envio',
        kind: 'send-test',
        command: `/channels send-test ${channelId}`,
      });
    }

    if (entry.features.qrLogin || entry.loginQr?.supported) {
      actions.push({
        id: `${channelId}:login-qr`,
        label: 'QR de login',
        kind: 'login-qr',
        command: `/channels login-qr ${channelId}`,
      });
      actions.push({
        id: `${channelId}:relink`,
        label: 'Parear novamente',
        kind: 'relink',
        command: `/channels relink ${channelId}`,
      });
      actions.push({
        id: `${channelId}:logout`,
        label: 'Encerrar sessao',
        kind: 'logout',
        command: `/channels logout ${channelId}`,
      });
    }

    if (entry.readiness === 'partial' || entry.lastHealth === 'failed') {
      actions.push({
        id: `${channelId}:repair`,
        label: 'Preparar reparo',
        kind: 'repair',
        command: `/channels repair ${channelId}`,
      });
    }

    return actions;
  }

  private buildStatusRows(entry: ChannelAdapterStatus): ChannelAdapterStatus['statusRows'] {
    if (Array.isArray(entry.statusRows) && entry.statusRows.length > 0) {
      return entry.statusRows.slice();
    }

    return [
      {
        label: 'Readiness',
        value: entry.readiness,
        tone: entry.readiness === 'ready' ? 'success' : entry.readiness === 'disabled' ? 'danger' : 'warning',
      },
      {
        label: 'Transporte',
        value: String(entry.transport || 'n/d'),
        tone: 'neutral',
      },
      {
        label: 'Configurado',
        value: entry.configured ? 'sim' : 'nao',
        tone: entry.configured ? 'success' : 'warning',
      },
      {
        label: 'Envio',
        value: entry.features.outbound ? 'sim' : 'nao',
        tone: entry.features.outbound ? 'success' : 'warning',
      },
    ];
  }

  private buildLoginQr(entry: ChannelAdapterStatus): ChannelLoginQrSnapshot | null {
    if (!entry.features.qrLogin) {
      return entry.loginQr || null;
    }

    const connected = entry.connection?.connected === true;
    return {
      supported: true,
      state: connected ? 'connected' : 'not_requested',
      source: null,
      dataUrl: null,
      expiresAt: null,
      updatedAt: null,
      nextStep: connected
        ? 'WhatsApp ja aparece conectado neste snapshot.'
        : 'Use /channels login-qr whatsapp para gerar ou buscar o QR no dashboard/API local.',
    };
  }

  private buildInteractiveSurface(entry: ChannelAdapterStatus): ChannelAdapterStatus['interactiveSurface'] {
    return {
      statusCard: true,
      inlineButtons: Boolean(entry.features.interactiveControls),
      slashCommands: Boolean(entry.features.slashCommands),
      richReplies: Boolean(entry.features.richReplies),
      modelMenus: Boolean(entry.features.slashCommands || entry.id === 'web' || entry.id === 'telegram'),
      qrLogin: Boolean(entry.features.qrLogin),
    };
  }

  private buildRiskLevel(entry: ChannelAdapterStatus): ChannelAdapterStatus['riskLevel'] {
    if (entry.id === 'imessage') {
      return 'experimental';
    }
    if (entry.id === 'signal') {
      return 'high';
    }
    if (entry.id === 'discord' || entry.id === 'whatsapp' || entry.id === 'instagram' || entry.id === 'teams') {
      return 'medium';
    }
    return 'low';
  }

  private buildSetupMode(entry: ChannelAdapterStatus): string {
    if (entry.id === 'signal') {
      return 'signal-cli';
    }
    if (entry.id === 'imessage') {
      return 'mac-bridge';
    }
    if (entry.id === 'teams') {
      return 'graph-bot';
    }
    if (entry.id === 'email') {
      return 'smtp-imap';
    }
    if (entry.id === 'whatsapp') {
      return entry.transport === 'webhook' ? 'cloud-api' : 'stub';
    }
    if (entry.id === 'instagram') {
      return entry.transport === 'webhook' ? 'meta-messaging' : 'stub';
    }
    return entry.transport === 'native' ? 'native' : String(entry.transport || 'stub');
  }

  private buildProvider(entry: ChannelAdapterStatus): string {
    if (entry.id === 'signal') {
      return 'signal-cli';
    }
    if (entry.id === 'imessage') {
      return 'macos-node-host';
    }
    if (entry.id === 'teams') {
      return 'microsoft-graph-bot-framework';
    }
    if (entry.id === 'email') {
      return 'smtp-imap';
    }
    if (entry.id === 'slack') {
      return entry.transport === 'native' ? 'slack-web-api' : 'local-outbox';
    }
    if (entry.id === 'whatsapp') {
      return entry.transport === 'webhook' ? 'meta-cloud-api' : 'local-provider';
    }
    if (entry.id === 'instagram') {
      return entry.transport === 'webhook' ? 'instagram-messaging-api' : 'local-outbox';
    }
    return String(entry.id || 'unknown');
  }

  private buildWebhookPath(entry: ChannelAdapterStatus): string | null {
    if (entry.id === 'slack' && entry.transport === 'native') {
      return '/api/webhooks/slack';
    }
    if (entry.id === 'whatsapp' && entry.transport === 'webhook') {
      return '/api/webhooks/whatsapp';
    }
    if (entry.id === 'instagram' && entry.transport === 'webhook') {
      return '/api/webhooks/instagram';
    }
    if (entry.id === 'teams' && entry.configured) {
      return '/api/webhooks/teams';
    }
    return null;
  }

  private buildLastHealth(entry: ChannelAdapterStatus): ChannelAdapterStatus['lastHealth'] {
    if (entry.readiness === 'ready') {
      return 'passed';
    }
    if (entry.readiness === 'disabled') {
      return 'skipped';
    }
    return 'unknown';
  }

  private selectEntry(entries: ChannelMeshSnapshotEntry[], selectedId?: string | null): ChannelMeshSnapshotEntry | null {
    const normalized = String(selectedId || '').trim().toLowerCase();
    if (normalized) {
      const resolved = this.resolveChannelAlias(normalized);
      return entries.find((entry) => String(entry.id || '').trim().toLowerCase() === resolved) || null;
    }
    const prioritized = this.prioritizeForOperator(entries);
    return prioritized.find((entry) => entry.readiness === 'partial')
      || prioritized.find((entry) => entry.readiness === 'planned')
      || prioritized.find((entry) => entry.readiness === 'ready')
      || entries[0]
      || null;
  }

  private resolveChannelAlias(value: string): string {
    const normalized = String(value || '').trim().toLowerCase();
    const aliases: Record<string, string> = {
      lark: 'feishu',
      gchat: 'googlechat',
      'google-chat': 'googlechat',
      msteams: 'teams',
      'microsoft-teams': 'teams',
      'openclaw-weixin': 'weixin',
      wechat: 'weixin',
      qywx: 'wecom',
      wework: 'wecom',
      'enterprise-wechat': 'wecom',
      'nc-talk': 'nextcloud-talk',
      nc: 'nextcloud-talk',
      'twitch-chat': 'twitch',
      zl: 'zalo',
      zlu: 'zalouser',
      'zalo-user': 'zalouser',
      yb: 'yuanbao',
      'tencent-yuanbao': 'yuanbao',
    };
    return aliases[normalized] || normalized;
  }

  private buildFeaturedIds(entries: ChannelMeshSnapshotEntry[]): string[] {
    return this.prioritizeForOperator(entries)
      .filter((entry) =>
        entry.readiness === 'partial'
        || entry.readiness === 'planned'
        || entry.id === 'web'
        || entry.id === 'slack'
        || entry.id === 'whatsapp'
        || entry.id === 'instagram'
        || entry.id === 'signal'
        || entry.id === 'imessage')
      .slice(0, 4)
      .map((entry) => entry.id);
  }

  private prioritizeForOperator(entries: ChannelMeshSnapshotEntry[]): ChannelMeshSnapshotEntry[] {
    const priority: Record<string, number> = {
      web: 0,
      slack: 1,
      whatsapp: 2,
      instagram: 3,
      discord: 4,
      telegram: 5,
      signal: 6,
      teams: 7,
      email: 8,
      imessage: 9,
    };
    return [...entries].sort((left, right) => {
      const leftReadiness = left.readiness === 'partial' ? 0 : left.readiness === 'planned' ? 1 : left.readiness === 'ready' ? 2 : 3;
      const rightReadiness = right.readiness === 'partial' ? 0 : right.readiness === 'planned' ? 1 : right.readiness === 'ready' ? 2 : 3;
      if (leftReadiness !== rightReadiness) {
        return leftReadiness - rightReadiness;
      }
      const leftPriority = priority[String(left.id || '').toLowerCase()] ?? 99;
      const rightPriority = priority[String(right.id || '').toLowerCase()] ?? 99;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return left.label.localeCompare(right.label, 'en-US');
    });
  }
}
