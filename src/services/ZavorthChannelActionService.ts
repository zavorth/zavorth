import type { PlatformGatewayContract } from '../contracts/PlatformContract.js';
import type {
  ChannelLoginQrSnapshot,
  ChannelMeshActionExecution,
  ChannelMeshActionKind,
  ChannelMeshSnapshot,
  ChannelMeshSnapshotEntry,
} from '../contracts/ChannelMeshContract.js';
import { ZavorthChannelMeshService } from './ZavorthChannelMeshService.js';

export type BroadcastCapableGateway = Pick<
  PlatformGatewayContract,
  'broadcast' | 'resolveBroadcastRecipients' | 'supportsRoleAwareBroadcast'
> & {
  requestLoginQr?: () => Promise<{
    ok?: boolean;
    status?: string;
    summary?: string;
    details?: string[];
    loginQr?: ChannelLoginQrSnapshot | null;
  }>;
  relink?: () => Promise<{ ok?: boolean; summary?: string; details?: string[] }>;
  logout?: () => Promise<{ ok?: boolean; summary?: string; details?: string[] }>;
  readStatus?: () => unknown;
};

type ChannelMeshActionPlane =
  Pick<ZavorthChannelMeshService, 'buildSnapshot'>
  & Partial<Pick<ZavorthChannelMeshService, 'reloadChannelPolicies'>>;

type ZavorthChannelActionRuntime = {
  now?: () => Date;
  channelMeshService?: ChannelMeshActionPlane;
  broadcastGateways?: Partial<Record<string, BroadcastCapableGateway | null | undefined>>;
};

export class ZavorthChannelActionService {
  private readonly now: () => Date;
  private readonly channelMesh: ChannelMeshActionPlane;
  private readonly broadcastGateways: Partial<Record<string, BroadcastCapableGateway | null | undefined>>;

  constructor(runtime: ZavorthChannelActionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.channelMesh = runtime.channelMeshService || new ZavorthChannelMeshService();
    this.broadcastGateways = runtime.broadcastGateways || {};
  }

  public async execute(input: {
    channelId: string;
    actionId: string;
    requestedBy?: string | null;
  }): Promise<ChannelMeshActionExecution> {
    const channelId = this.normalizeChannelId(input.channelId);
    const actionId = this.normalizeActionId(input.actionId);
    if (!channelId) {
      throw new Error('channelId required.');
    }
    if (!actionId) {
      throw new Error('actionId required.');
    }

    const snapshot = this.channelMesh.buildSnapshot({ selectedId: channelId });
    const selected = snapshot.selected;
    if (!selected || this.normalizeChannelId(selected.id) !== channelId) {
      throw new Error(`Channel not found: ${channelId}.`);
    }

    switch (actionId) {
      case 'inspect':
        return this.finish(actionId, selected, snapshot, 'manual', 'Channel inspection ready.', [
          selected.summary,
          selected.operatorSummary,
          selected.actionHint,
        ]);
      case 'status':
        return this.finish(actionId, selected, snapshot, 'manual', `Status for ${selected.label} ready for display.`, [
          selected.summary,
          ...this.renderStatusRows(selected),
          selected.lastEventAt ? `Latest event: ${selected.lastEventAt}.` : '',
          selected.loginQr?.supported ? `QR: ${selected.loginQr.state}. ${selected.loginQr.nextStep}` : '',
        ].filter(Boolean));
      case 'policy':
        return this.finish(actionId, selected, snapshot, 'manual', `${selected.label} resumido at policy operational.`, [
          `Readiness: ${selected.readiness}.`,
          `Transport: ${selected.transport}.`,
          `Inbound: ${selected.features.inbound ? 'yes' : 'no'} | Outbound: ${selected.features.outbound ? 'yes' : 'no'}.`,
          `Threads: ${selected.features.threads ? 'yes' : 'no'} | Group policy: ${selected.features.groupPolicy ? 'yes' : 'no'}.`,
          ...(selected.notes || []).slice(0, 4),
        ]);
      case 'policy-reload':
        return this.executePolicyReload(selected, input.requestedBy || null);
      case 'prepare':
        return this.executePrepare(selected, snapshot);
      case 'broadcast-test':
        return this.executeBroadcastTest(selected, snapshot, input.requestedBy || null, 'broadcast-test');
      case 'send-test':
        return this.executeBroadcastTest(selected, snapshot, input.requestedBy || null, 'send-test');
      case 'doctor':
        return this.finish(actionId, selected, snapshot, 'manual', `Doctor de ${selected.label} prepared.`, [
          selected.doctorCommand || 'npm run test:channels:smoke',
          selected.lastHealth ? `Latest health read: ${selected.lastHealth}.` : 'Latest health read unavailable.',
          selected.operatorNextStep || selected.actionHint,
        ]);
      case 'repair':
        return this.finish(actionId, selected, snapshot, 'manual', `Repair plan for ${selected.label} prepared.`, [
          selected.operatorNextStep || selected.actionHint,
          ...this.buildPrepareChecklist(selected),
        ]);
      case 'login-qr':
        return this.executeLoginQr(selected, snapshot);
      case 'relink':
        return this.executeBridgeLifecycleAction(selected, snapshot, 'relink');
      case 'logout':
        return this.executeBridgeLifecycleAction(selected, snapshot, 'logout');
      default:
        throw new Error(`Unknown channel action: ${actionId}.`);
    }
  }

  private async executePolicyReload(
    selected: ChannelMeshSnapshotEntry,
    requestedBy: string | null,
  ): Promise<ChannelMeshActionExecution> {
    if (!this.channelMesh.reloadChannelPolicies) {
      throw new Error('Channel Mesh does not expose policy reload in this runtime.');
    }

    const channelId = this.normalizeChannelId(selected.id);
    const result = await this.channelMesh.reloadChannelPolicies({
      selectedId: channelId,
      actor: requestedBy || 'operator',
      reason: 'channel-mesh-action',
    });
    const receipt = result.receipt;
    const changedChannels = receipt.changedChannels.length > 0
      ? receipt.changedChannels.join(', ')
      : 'no channel difference detected';
    const refreshedSelected = result.selected || selected;

    return {
      generatedAt: receipt.reloadedAt || this.now().toISOString(),
      channelId,
      actionId: 'policy-reload',
      status: 'applied',
      ok: true,
      summary: `${refreshedSelected.label} policy reloaded without restarting active gateways.`,
      details: [
        `source: ${receipt.source}.`,
        `Requested by: ${receipt.actor}.`,
        `Policies carregadas: ${receipt.previousPolicyCount} -> ${receipt.nextPolicyCount}.`,
        `Canais alterados: ${changedChannels}.`,
      ],
      selected: result.snapshot.selected,
      snapshot: result.snapshot,
      policyReloadReceipt: receipt,
    };
  }

  private executePrepare(
    selected: ChannelMeshSnapshotEntry,
    snapshot: ChannelMeshSnapshot,
  ): ChannelMeshActionExecution {
    const details = [
      `next passo oficial: ${selected.actionHint}`,
      ...(selected.notes || []).slice(0, 4),
      ...this.buildPrepareChecklist(selected),
    ];
    return this.finish(
      'prepare',
      selected,
      snapshot,
      'manual',
      `${selected.label} prepared for the next Channel Mesh step.`,
      details,
    );
  }

  private async executeBroadcastTest(
    selected: ChannelMeshSnapshotEntry,
    snapshot: ChannelMeshSnapshot,
    requestedBy: string | null,
    actionId: Extract<ChannelMeshActionKind, 'broadcast-test' | 'send-test'>,
  ): Promise<ChannelMeshActionExecution> {
    const gateway = this.broadcastGateways[this.normalizeChannelId(selected.id)] || null;
    if (!selected.features.outbound) {
      return this.finish(
        actionId,
        selected,
        snapshot,
        'manual',
        `${selected.label} does not expose enough outbound support for a test broadcast yet.`,
        [
          selected.summary,
          'Use the channel mesh to review transport, policy, and next step before expanding rollout.',
        ],
      );
    }
    if (!this.isDefaultLiveActionAllowed(selected)) {
      return this.finish(
        actionId,
        selected,
        snapshot,
        'manual',
        `${selected.label} is not live-ready for default sending.`,
        [
          selected.defaultBlockReason || 'Channel is configured, but has no sufficient live proof for sending.',
          `Proof: ${selected.readinessProof || 'unknown'}.`,
          'Run doctor, validate webhook/bridge, or perform an explicit live probe before sending a real payload.',
        ],
      );
    }
    if (!gateway?.broadcast) {
      throw new Error(`Channel ${selected.label} does not have an operational broadcast bridge in this runtime yet.`);
    }

    const roles = gateway.supportsRoleAwareBroadcast === false ? [] : ['admin', 'operator'];
    const recipients = await this.resolveRecipients(gateway, roles);
    const testMessage =
      `Test of Channel Mesh at ${selected.label}.\n`
      + `Transport: ${selected.transport}.\n`
      + `Requested by: ${requestedBy || 'operator'}.\n`
      + `Sent at: ${this.now().toLocaleString('en-US')}.`;

    await gateway.broadcast(testMessage, roles);

    return this.finish(
      actionId,
      selected,
      snapshot,
      'applied',
      `Broadcast test sent to ${selected.label}.`,
      [
        recipients.length > 0
          ? `Expected recipients: ${recipients.length}.`
          : 'Expected recipients could not be enumerated in this runtime.',
        'The channel received a short verification payload without changing sessions or global state.',
      ],
    );
  }

  private async executeLoginQr(
    selected: ChannelMeshSnapshotEntry,
    snapshot: ChannelMeshSnapshot,
  ): Promise<ChannelMeshActionExecution> {
    const channelId = this.normalizeChannelId(selected.id);
    const gateway = this.broadcastGateways[channelId] || null;
    if (!selected.features.qrLogin && !selected.loginQr?.supported) {
      return {
        ...this.finish(
          'login-qr',
          selected,
          snapshot,
          'manual',
          `${selected.label} does not use QR login in this provider.`,
          [
            selected.loginQr?.nextStep || selected.actionHint,
          ],
        ),
        loginQr: selected.loginQr || null,
      };
    }

    if (typeof gateway?.requestLoginQr !== 'function') {
      return {
        ...this.finish(
          'login-qr',
          selected,
          snapshot,
          'manual',
          `${selected.label} does not expose QR through the active gateway yet.`,
          [
            'Conecte o runtime local que public qr.txt na session ou implemente requestLoginQr no gateway.',
            selected.loginQr?.nextStep || selected.actionHint,
          ],
        ),
        loginQr: selected.loginQr || null,
      };
    }

    const receipt = await gateway.requestLoginQr();
    return {
      generatedAt: this.now().toISOString(),
      channelId,
      actionId: 'login-qr',
      status: receipt.ok ? 'applied' : 'manual',
      ok: receipt.ok === true,
      summary: receipt.summary || `QR de ${selected.label} consultado.`,
      details: Array.isArray(receipt.details) && receipt.details.length > 0
        ? receipt.details
        : [selected.loginQr?.nextStep || selected.actionHint],
      selected: snapshot.selected,
      snapshot,
      loginQr: receipt.loginQr || selected.loginQr || null,
    };
  }

  private async executeBridgeLifecycleAction(
    selected: ChannelMeshSnapshotEntry,
    snapshot: ChannelMeshSnapshot,
    actionId: Extract<ChannelMeshActionKind, 'relink' | 'logout'>,
  ): Promise<ChannelMeshActionExecution> {
    const channelId = this.normalizeChannelId(selected.id);
    const gateway = this.broadcastGateways[channelId] || null;
    const method = actionId === 'relink' ? gateway?.relink : gateway?.logout;

    if (!this.isDefaultLiveActionAllowed(selected)) {
      return this.finish(
        actionId,
        selected,
        snapshot,
        'manual',
        actionId === 'relink'
          ? `${selected.label} pairing requires a live-ready channel.`
          : `${selected.label} logout requires a live-ready channel.`,
        [
          selected.defaultBlockReason || 'Channel has no sufficient live proof to change the session cycle.',
          `Proof: ${selected.readinessProof || 'unknown'}.`,
          'Use prepare/doctor/login-qr before run ciclo de bridge at runtime real.',
        ],
      );
    }

    if (typeof method === 'function') {
      const receipt = await method.call(gateway);
      return this.finish(
        actionId,
        selected,
        snapshot,
        receipt.ok === false ? 'manual' : 'applied',
        receipt.summary || `${selected.label} atualizou ciclo de session.`,
        Array.isArray(receipt.details) && receipt.details.length > 0
          ? receipt.details
          : [selected.operatorNextStep || selected.actionHint],
      );
    }

    return this.finish(
      actionId,
      selected,
      snapshot,
      'manual',
      actionId === 'relink'
        ? `Pareamento de ${selected.label} prepared.`
        : `Encerramento de session de ${selected.label} prepared.`,
      actionId === 'relink'
        ? [
            'Stop the local channel runtime.',
            'Remove or rotate the local session only after confirming no send is in progress.',
            'Request /channels login-qr whatsapp to generate a new QR when the bridge publishes qr.txt.',
          ]
        : [
            'Stop the local runtime before removing persistent sessions.',
            'Revoke tokens/provider in the official panel when the channel uses an external API.',
            'Keep allowlists and audit logs intact for later investigation.',
          ],
    );
  }

  private async resolveRecipients(
    gateway: BroadcastCapableGateway,
    roles: string[],
  ): Promise<string[]> {
    if (typeof gateway.resolveBroadcastRecipients !== 'function') {
      return [];
    }

    const result = await gateway.resolveBroadcastRecipients(roles);
    return Array.isArray(result)
      ? result.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
  }

  private finish(
    actionId: ChannelMeshActionKind,
    selected: ChannelMeshSnapshotEntry,
    snapshot: ChannelMeshSnapshot,
    status: ChannelMeshActionExecution['status'],
    summary: string,
    details: string[],
  ): ChannelMeshActionExecution {
    return {
      generatedAt: this.now().toISOString(),
      channelId: this.normalizeChannelId(selected.id),
      actionId,
      status,
      ok: status !== 'noop',
      summary,
      details,
      selected: snapshot.selected,
      snapshot,
    };
  }

  private normalizeChannelId(value: string | null | undefined): string {
    return String(value || '').trim().toLowerCase();
  }

  private normalizeActionId(value: string | null | undefined): ChannelMeshActionKind | '' {
    const normalized = String(value || '').trim().toLowerCase().split(':').pop() || '';
    switch (normalized) {
      case 'inspect':
      case 'status':
      case 'policy':
      case 'policy-reload':
      case 'prepare':
      case 'broadcast-test':
      case 'send-test':
      case 'doctor':
      case 'repair':
      case 'login-qr':
      case 'relink':
      case 'logout':
        return normalized;
      default:
        return '';
    }
  }

  private isDefaultLiveActionAllowed(selected: ChannelMeshSnapshotEntry): boolean {
    return selected.defaultRouteAllowed === true;
  }

  private buildPrepareChecklist(selected: ChannelMeshSnapshotEntry): string[] {
    const channelId = this.normalizeChannelId(selected.id);
    switch (channelId) {
      case 'slack':
        if (selected.transport === 'native' || (selected.notes || []).some((note) => /slack web api|slack nactive/i.test(String(note || '')))) {
          return [
            'Confirm SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET before receiving real events.',
            'Point Slack to /api/webhooks/slack and validate the webhook signature.',
            'Review SLACK_ALLOWED_CHANNEL_IDS and the target workspace before opening mesh rollout.',
            'Use /channels broadcast-test slack to validate real outbound delivery after bootstrap.',
          ];
        }
        return [
          'set the initial Slack transport before opening sessions_send in the mesh.',
          'Map workspace/channel/thread policy and attachments before rollout.',
          'Promote the Slack adapter to supervised runtime only after credential bootstrap.',
        ];
      case 'whatsapp':
        if (selected.transport === 'webhook' || (selected.notes || []).some((note) => /cloud api|meta cloud api/i.test(String(note || '')))) {
          return [
            'Confirm WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, and WHATSAPP_WEBHOOK_VERIFY_TOKEN.',
            'Register /api/webhooks/whatsapp as the Cloud API callback and validate the hub.challenge.',
            'Keep WHATSAPP_ALLOWED_CHAT_IDS aligned with chats that will receive mesh rollout.',
            'Use /channels broadcast-test whatsapp to validate real outbound delivery after the webhook is ready.',
          ];
        }
        return [
          'Confirm WHATSAPP_ALLOWED_CHAT_IDS for chats that will receive tests.',
          'Validate the supervised local runtime with /channels broadcast-test whatsapp before expanding rollout.',
          'Keep the adapter in controlled local mode until promoting an official provider or dedicated bridge.',
        ];
      case 'instagram':
        if (selected.transport === 'webhook' || (selected.notes || []).some((note) => /instagram messaging|meta graph|meta instagram/i.test(String(note || '')))) {
          return [
            'Confirm INSTAGRAM_BUSINESS_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN, and INSTAGRAM_WEBHOOK_VERIFY_TOKEN.',
            'Register /api/webhooks/instagram as a callback of the Meta Instagram Messaging API and validate the hub.challenge.',
            'Keep INSTAGRAM_ALLOWED_RECIPIENT_IDS aligned with approved recipients before rollout.',
            'Use /channels broadcast-test instagram to validate real outbound delivery after the webhook is ready.',
          ];
        }
        return [
          'Confirm INSTAGRAM_ALLOWED_RECIPIENT_IDS for recipients that will receive tests.',
          'set INSTAGRAM_PROVIDER=meta-messaging to activate real Meta DM.',
          'Validate the supervised local outbox with /channels broadcast-test instagram before connecting official credentials.',
        ];
      case 'discord':
        return [
          'Review allowed guilds/channels and slash-command exposure before expanding rollout.',
        ];
      case 'signal':
        return [
          'Confirm signal-cli/JSON-RPC and a dedicated account before activating inbound/outbound.',
          'Keep ZAVORTH_CHANNEL_POLICY_SIGNAL_OPEN=false and use a recipient allowlist.',
          'Validate the local doctor and supervised outbox before real sending.',
        ];
      case 'imessage':
        return [
          'Start a macOS Node Host and confirm the Mac bridge snapshot.',
          'Comece with IMESSAGE_READ_ONLY=true e exija approval/trust before enviar.',
          'Use a recipient allowlist to prevent invisible automation in personal conversations.',
        ];
      case 'teams':
        return [
          'Configure tenant, app id, and Teams secret before publishing the webhook.',
          'Use allowlist by conversation id before exposing the bot to a real tenant.',
        ];
      case 'email':
        return [
          'Configure SMTP and recipient allowlist for outbound notifications.',
          'Add IMAP only when approvals by email reply are needed.',
        ];
      default:
        return ['Review policy, transport, and channel prerequisites before expanding operation.'];
    }
  }

  private renderStatusRows(selected: ChannelMeshSnapshotEntry): string[] {
    if (!Array.isArray(selected.statusRows) || selected.statusRows.length === 0) {
      return [
        `Readiness: ${selected.readiness}.`,
        `Transport: ${selected.transport}.`,
        `Configured: ${selected.configured ? 'yes' : 'no'}.`,
      ];
    }

    return selected.statusRows.map((row) => `${row.label}: ${row.value}.`);
  }
}
