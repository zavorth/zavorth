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
        headline: `Channel Mesh exposes ${summary.total} channel(s) with a visible operator contract.`,
        operatorSummary:
          `${summary.ready} ready, ${summary.partial} parcial(is), ${summary.planned} planejado(s) `
          + `${summary.sessionSendReady} with sessions_send imediato e ${summary.liveReady} live-ready.`,
      },
    };
  }

  public async reloadChannelPolicies(input: {
    selectedId?: string | null;
    actor?: string | null;
    reason?: string | null;
  } = {}): Promise<ChannelPolicyReloadControlResult> {
    if (!this.policies?.reloadPolicies) {
      throw new Error('ChannelPolicyManager unavailable for policy reload.');
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
      `Total: ${snapshot.summary.total} | ready: ${snapshot.summary.ready} | parcial: ${snapshot.summary.partial} | planejados: ${snapshot.summary.planned}.`,
    ];

    if (snapshot.selected) {
      lines.push(
        '',
        `${snapshot.selected.label} [${snapshot.selected.id}]`,
        snapshot.selected.summary,
        `Transporte: ${snapshot.selected.transport}.`,
        `Readiness: ${snapshot.selected.readiness}.`,
        `Live ready: ${snapshot.selected.liveReady ? 'yes' : 'no'} (${snapshot.selected.readinessProof}).`,
        snapshot.selected.defaultBlockReason ? `block default: ${snapshot.selected.defaultBlockReason}`
          : 'Default route: allowed for live-ready channel.',
        `next passo: ${snapshot.selected.actionHint}.`,
      );
      if (snapshot.selected.tags.length > 0) {
        lines.push(`Tags: ${snapshot.selected.tags.join(', ')}.`);
      }
      if (snapshot.selected.notes.length > 0) {
        lines.push('', ...snapshot.selected.notes.slice(0, 4).map((note) => `- ${note}`));
      }
      return lines.join('\n');
    }

    lines.push('', 'Highlighted channels:');
    for (const entry of snapshot.entries.slice(0, 6)) {
      lines.push(`- ${entry.label} [${entry.readiness}] - ${entry.summary}`);
    }
    lines.push('', 'Use /channels <id> to inspect a specific channel.');
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
      return 'Channel local principal do app remote, sempre present no control plane.';
    }
    if (entry.id === 'whatsapp' && entry.transport === 'webhook' && entry.implementationState === 'full') {
      return 'Channel operational via WhatsApp Cloud API, with webhook e outbound reais no mesh.';
    }
    if (entry.id === 'instagram' && entry.transport === 'webhook' && entry.implementationState === 'full') {
      return 'Channel operational via Instagram Messaging API, with webhook e outbound reais no mesh.';
    }
    if (entry.id === 'slack' && entry.transport === 'native' && entry.implementationState === 'full') {
      return 'Channel operational via Slack Web API, with inbound por webhook e outbound real.';
    }
    if (entry.id === 'signal') {
      return entry.readiness === 'ready'
        ? 'Channel Signal operando via bridge signal-cli supervised e allowlist fechada.'
        : 'Channel Signal mapeado via bridge signal-cli, ainda exigindo conta dedicada e doctor local.';
    }
    if (entry.id === 'imessage') {
      return entry.readiness === 'ready'
        ? 'iMessage bridge through macOS Node Host validated for supervised operation.'
        : 'iMessage mapped as an experimental Mac bridge, starting in read-only mode.';
    }
    if (entry.id === 'teams') {
      return 'Microsoft Teams channel prepared for Graph/Bot Framework with tenant and allowed conversations.';
    }
    if (entry.id === 'email') {
      return 'Email channel prepared as universal fallback for notifications and approvals.';
    }
    if (entry.readiness === 'ready') {
      return 'Channel ready to operate in the mesh with clear feature and policy readout.';
    }
    if (entry.readiness === 'partial') {
      return 'Channel already known by the runtime, but still requesting final configuration or policy.';
    }
    if (entry.readiness === 'disabled') {
      return 'Channel known, but disabled by current configuration.';
    }
    return 'Channel mapeado no roadmap do mesh, ainda without adapter operational.';
  }

  private buildOperatorSummary(entry: ChannelAdapterStatus, policy: ChannelPolicySummary | null): string {
    const sendLabel = entry.features.sessionSend ? 'sessions_send ready' : 'sessions_send unavailable';
    const policyLabel = entry.features.groupPolicy ? 'policy por grupo available' : 'without policy de grupo';
    const doctorLabel = entry.features.doctor ? 'doctor available' : 'without doctor';
    const riskLabel = entry.riskLevel ? `risk ${entry.riskLevel}` : 'risk n/d';
    const accessLabel = policy ? `access ${policy.state}` : 'access n/d';
    const connectionLabel = entry.connection?.connected ? 'conectado'
      : entry.connection?.running ? 'runtime rodando'
        : 'connection n/a';
    const qrLabel = entry.features.qrLogin ? `QR ${entry.loginQr?.state || 'pending'}`
      : 'without QR';
    return `${sendLabel}; ${policyLabel}; ${doctorLabel}; ${riskLabel}; ${accessLabel}; ${connectionLabel}; ${qrLabel}; transporte ${entry.transport}.`;
  }

  private buildActionHint(entry: ChannelAdapterStatus, policy: ChannelPolicySummary | null): string {
    const suffix = this.buildPolicyActionSuffix(policy);
    switch (entry.id) {
      case 'web':
        return 'Open the remote app or use /sessionspawn web to open a derived session.';
      case 'telegram':
        return `Use /help in Telegram to navigate commands and keep the session alive.${suffix}`;
      case 'discord':
        return `review a policy do Discord e o runtime do adapter before expanding rollout.${suffix}`;
      case 'whatsapp':
        if (entry.transport === 'webhook') {
          return `${entry.readiness === 'ready'
            ? 'Use /channels broadcast-test whatsapp and confirm the callback at /api/webhooks/whatsapp.'
            : 'Complete verify token, chats permitidos e callback /api/webhooks/whatsapp before expanding rollout.'}${suffix}`;
        }
        return `${entry.readiness === 'ready'
          ? 'Use /channels broadcast-test whatsapp to validate the supervised local WhatsApp runtime.'
          : 'Configure allowed chats and supervised local bootstrap before promising real WhatsApp operation.'}${suffix}`;
      case 'instagram':
        if (entry.transport === 'webhook') {
          return `${entry.readiness === 'ready'
            ? 'Use /channels broadcast-test instagram and confirm the callback at /api/webhooks/instagram.'
            : 'Complete business account, verify token, recipients allowed e callback /api/webhooks/instagram before do rollout.'}${suffix}`;
        }
        return `${entry.readiness === 'ready'
          ? 'Use /channels broadcast-test instagram to validate the supervised local Instagram outbox.'
          : 'Preparar Meta Instagram Messaging API ou recipients permitidos before prometer DM real.'}${suffix}`;
      case 'slack':
        if (entry.transport === 'native') {
          return `${entry.readiness === 'ready'
            ? 'Use /channels broadcast-test slack and point Slack to /api/webhooks/slack.'
            : 'Confirm bot token, allowed channels, and webhook /api/webhooks/slack before expanding rollout.'}${suffix}`;
        }
        return `${entry.readiness === 'ready'
          ? 'Use /channels broadcast-test slack to validate the supervised local Slack runtime.'
          : 'Configure allowed channels and supervised local bootstrap before promising real Slack operation.'}${suffix}`;
      case 'signal':
        return `Prepare signal-cli/JSON-RPC, SIGNAL_ACCOUNT_NUMBER e SIGNAL_ALLOWED_RECIPIENTS; after run /channels doctor signal.${suffix}`;
      case 'imessage':
        return `Start a macOS Node Host, keep it read-only, and validate IMESSAGE_ALLOWED_RECIPIENTS before allowing send.${suffix}`;
      case 'teams':
        return `Prepare TEAMS_APP_ID, TEAMS_TENANT_ID, secret and allowed conversations before publishing o webhook /api/webhooks/teams.${suffix}`;
      case 'email':
        return `Configure EMAIL_ALLOWED_RECIPIENTS for supervised local outbox; SMTP/IMAP can be added later for outbound delivery and approvals by reply.${suffix}`;
      default:
        return `review a readiness do canal e o adapter correspondente.${suffix}`;
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
        return ' Revise se open access ainda faz sentido before expanding rollout.';
      case 'allowlist':
        return ' A allowlist already is fechada; mantenha os IDs permitidos sincronizados with o canal real.';
      case 'mixed':
        return ' A policy mistura allowlist e blocklist; revise ambos os lados before do rollout.';
      case 'blocked-only':
      case 'closed':
        return ' set uma allowlist ou enable open access supervised before prometer usage amplo.';
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
        label: 'run doctor',
        kind: 'doctor',
        command: `/channels doctor ${channelId}`,
      },
    ];

    if (channelId !== 'web') {
      actions.push({
        id: `${channelId}:policy-reload`,
        label: 'Reload policy',
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
        label: 'Parear again',
        kind: 'relink',
        command: `/channels relink ${channelId}`,
      });
      actions.push({
        id: `${channelId}:logout`,
        label: 'End session',
        kind: 'logout',
        command: `/channels logout ${channelId}`,
      });
    }

    if (entry.readiness === 'partial' || entry.lastHealth === 'failed') {
      actions.push({
        id: `${channelId}:repair`,
        label: 'Prepare repair',
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
        label: 'configured',
        value: entry.configured ? 'yes' : 'no',
        tone: entry.configured ? 'success' : 'warning',
      },
      {
        label: 'Envio',
        value: entry.features.outbound ? 'yes' : 'no',
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
      nextStep: connected ? 'WhatsApp already appears connected in this snapshot.'
        : 'Use /channels login-qr whatsapp to generate or fetch the QR in zavorthControl/local API.',
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
      return entry.transport === 'webhook' ? 'cloud-api' : 'local';
    }
    if (entry.id === 'instagram') {
      return entry.transport === 'webhook' ? 'meta-messaging' : 'local';
    }
    return entry.transport === 'native' ? 'native' : String(entry.transport || 'local');
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
      'weixin-compat': 'weixin',
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
