import {
  CHANNEL_CONNECTION_PLAYBOOK_VERSION,
  type ChannelConnectionPlaybook,
  type ChannelConnectionPlaybookCommands,
  type ChannelConnectionPlaybookReadiness,
  type ChannelConnectionPlaybookSnapshot,
  type ChannelConnectionPlaybookStatus,
  type ChannelConnectionPlaybookStep,
  type ChannelConnectionStepStatus,
} from '../contracts/ChannelConnectionPlaybookContract.js';
import type { ChannelMeshSnapshot, ChannelMeshSnapshotEntry } from '../contracts/ChannelMeshContract.js';
import {
  PLATFORM_KEYS,
  normalizePlatformKey,
  type PlatformKey,
} from '../contracts/PlatformContract.js';
import { ChannelSetupAssistantService, type ChannelSetupAssistantOption, type ChannelSetupAssistantSession } from './ChannelSetupAssistantService.js';

import { ZavorthChannelMeshService } from './ZavorthChannelMeshService.js';
import type { ChannelInstallMode } from './ChannelInstallScaffoldService.js';

type ChannelSetupAssistantLike = Pick<ChannelSetupAssistantService, 'buildSession'>;
type ChannelMeshLike = Pick<ZavorthChannelMeshService, 'buildSnapshot'>;

export type ChannelConnectionPlaybookInput = {
  selectedId?: string | null;
  mode?: string | null;
  intentText?: string | null;
};

type ChannelConnectionPlaybookDeps = {
  now?: () => Date;
  setupAssistant?: ChannelSetupAssistantLike;
  channelMeshService?: ChannelMeshLike;
};

const CHANNEL_HINTS: Partial<Record<PlatformKey, string[]>> = {
  telegram: [
    'Use a dedicated bot and limit TELEGRAM_ALLOWED_USER_IDS to real operators.',
    'Telegram does not need a public URL to start.',
  ],
  discord: [
    'Invite the bot only to authorized guilds and fill DISCORD_ALLOWED_GUILD_IDS.',
    'Keep DISCORD_PUBLIC_SERVER_MODE=false until commands and policy are validated.',
  ],
  whatsapp: [
    'Cloud API needs a public webhook and allowed recipients before real sending.',
    'local bridge or QR does not count as live until there is proof of a connected runtime.',
  ],
  instagram: [
    'Meta Messaging requires a business account, public webhook, and allowed recipients.',
    'Local/outbox mode prepares the flow; it does not promise real direct messages.',
  ],
  slack: [
    'Native Slack needs a bot token, signing secret, and allowed channels.',
    'Local/outbox is useful for rehearsal, but it does not become the default route.',
  ],
  signal: [
    'Use a dedicated account, signal-cli or local JSON-RPC, and keep SIGNAL_ALLOWED_RECIPIENTS closed.',
    'Signal is a supervised local bridge, not an official Bot API.',
  ],
  imessage: [
    'iMessage depends on a macOS bridge and must start read-only.',
    'Sending requires IMESSAGE_ALLOWED_RECIPIENTS and operational approval.',
  ],
  teams: [
    'Teams needs an app, tenant, secret, and allowed conversations.',
    'Publish webhook only after doctor and allowlist are ready.',
  ],
  email: [
    'local-outbox is useful for safe notifications before real SMTP/IMAP.',
    'EMAIL_ALLOWED_RECIPIENTS must be closed before any send.',
  ],
};

export class ChannelConnectionPlaybookService {
  private readonly now: () => Date;
  private readonly setupAssistant: ChannelSetupAssistantLike;
  private readonly channelMeshService: ChannelMeshLike;

  constructor(deps: ChannelConnectionPlaybookDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.channelMeshService = deps.channelMeshService || new ZavorthChannelMeshService();
    this.setupAssistant = deps.setupAssistant || new ChannelSetupAssistantService({
      channelMeshService: this.channelMeshService,
    });
  }

  public buildSnapshot(input: ChannelConnectionPlaybookInput = {}): ChannelConnectionPlaybookSnapshot {
    const selectedId = this.resolveSelectedId(input.selectedId || this.extractChannelIdFromText(input.intentText));
    const mesh = this.channelMeshService.buildSnapshot({ selectedId });
    const playbooks = PLATFORM_KEYS.map((channelId) => this.buildPlaybook({
      channelId,
      selectedId,
      mode: selectedId === channelId ? input.mode || null : null,
      mesh,
    }));
    const selected = selectedId
      ? playbooks.find((playbook) => playbook.channelId === selectedId) || null
      : null;
    const summary = {
      total: playbooks.length,
      needsScaffold: playbooks.filter((entry) => entry.status === 'needs-scaffold').length,
      needsConfig: playbooks.filter((entry) => entry.status === 'needs-config').length,
      readyToValidate: playbooks.filter((entry) => entry.status === 'ready-to-validate').length,
      liveReady: playbooks.filter((entry) => entry.readiness.liveReady).length,
      defaultRouteAllowed: playbooks.filter((entry) => entry.readiness.defaultRouteAllowed).length,
    };
    const status = summary.defaultRouteAllowed > 0
      ? 'ready'
      : summary.readyToValidate > 0 || summary.liveReady > 0
        ? 'attention'
        : 'needs-setup';

    return {
      generatedAt: this.now().toISOString(),
      version: CHANNEL_CONNECTION_PLAYBOOK_VERSION,
      status,
      selected,
      playbooks,
      summary,
      operatorSummary:
        `${summary.total} channels covered; ${summary.needsConfig} need credentials, `
        + `${summary.readyToValidate} are ready for doctor, ${summary.liveReady} has live proof and `
        + `${summary.defaultRouteAllowed} pode virar rota default.`,
    };
  }

  public renderText(input: ChannelConnectionPlaybookInput = {}): string {
    const snapshot = this.buildSnapshot(input);
    const selected = snapshot.selected;
    const lines = [
      'Zavorth channel connection playbook',
      '',
      snapshot.operatorSummary,
      'Cataloged or scaffolded does not mean connected live.',
    ];

    if (!selected) {
      lines.push(
        '',
        'Canais:',
        ...snapshot.playbooks.map((entry) =>
          `- ${entry.label}: ${entry.status}; next passo: ${entry.nextAction}`),
        '',
        'Use --channel <channel> to view the complete playbook.',
      );
      return lines.join('\n');
    }

    lines.push(
      '',
      `${selected.label} (${selected.channelId})`,
      selected.summary,
      `Modo: ${selected.mode || 'not selected'}.`,
      `Live: ${selected.readiness.liveReady ? 'yes' : 'not'} (${selected.readiness.readinessProof}).`,
      selected.readiness.defaultRouteAllowed ? 'Default route: allowed.'
        : `Default route: blocked ? ${selected.readiness.defaultBlockReason || 'needs live proof.'}`,
      `Next step: ${selected.nextAction}`,
      '',
      'Passos:',
      ...selected.steps.map((step) =>
        `- [${step.status}] ${step.label}${step.command ? `: ${step.command}` : ''}`),
      '',
      `Required variables: ${selected.requiredInputKeys.join(', ') || 'none'}.`,
      `Missing variables: ${selected.missingInputKeys.join(', ') || 'none'}.`,
    );

    if (selected.webhookUrl) {
      lines.push(`Webhook esperado: ${selected.webhookUrl}`);
    }

    lines.push(
      '',
      'Commands:',
      `- Inspecionar: ${selected.commands.inspect}`,
      `- Preparar scaffold: ${selected.commands.apply}`,
      `- run doctor: ${selected.commands.doctor}`,
      `- Provar live: ${selected.commands.liveProof}`,
      `- Safe test: ${selected.commands.sendTest}`,
    );

    return lines.join('\n');
  }

  private buildPlaybook(input: {
    channelId: PlatformKey;
    selectedId: PlatformKey | null;
    mode: string | null;
    mesh: ChannelMeshSnapshot;
  }): ChannelConnectionPlaybook {
    const session = this.setupAssistant.buildSession({
      channelId: input.channelId,
      mode: input.mode,
    });
    const selected = this.requireSelected(session, input.channelId);
    const meshEntry = input.mesh.entries.find((entry) => entry.id === input.channelId) || null;
    const readiness = this.buildReadiness(selected, meshEntry);
    const commands = this.buildCommands(input.channelId, selected);
    const status = this.buildStatus(session.status, readiness);
    const steps = this.buildSteps(selected, readiness, commands, meshEntry);

    return {
      channelId: input.channelId,
      label: selected.label,
      mode: selected.setupMode,
      status,
      summary: this.buildSummary(selected, readiness, meshEntry),
      nextAction: this.buildNextAction(steps, selected, readiness),
      requiredInputKeys: selected.requiredEnvKeys.slice().sort(),
      missingInputKeys: selected.missingEnvKeys.slice().sort(),
      webhookUrl: selected.webhookUrl,
      readiness,
      commands,
      steps,
      safety: {
        rawSecretsSerialized: false,
        catalogSupportIsNotLiveProof: true,
        defaultRouteRequiresLiveProof: true,
        outboxOnlyIsNotLive: true,
      },
    };
  }

  private requireSelected(session: ChannelSetupAssistantSession, channelId: PlatformKey): ChannelSetupAssistantOption {
    if (!session.selected) {
      throw new Error(`Playbook without selected channel: ${channelId}.`);
    }
    return session.selected;
  }

  private buildReadiness(
    selected: ChannelSetupAssistantOption,
    meshEntry: ChannelMeshSnapshotEntry | null,
  ): ChannelConnectionPlaybookReadiness {
    const outboxOnlyMode = selected.setupMode === 'local' || selected.setupMode === 'local-outbox';
    const liveReady = outboxOnlyMode ? false : meshEntry?.liveReady === true;
    const defaultRouteAllowed = outboxOnlyMode ? false : meshEntry?.defaultRouteAllowed === true;
    return {
      configured: selected.configured || meshEntry?.configured === true,
      liveReady,
      defaultRouteAllowed,
      readinessProof: outboxOnlyMode ? 'catalog'
        : meshEntry?.readinessProof || (selected.configured ? 'configuration' : 'none'),
      defaultBlockReason: defaultRouteAllowed
        ? null
        : outboxOnlyMode ? 'Local/outbox mode prepares and records messages, but it is not the default live route.'
          : meshEntry?.defaultBlockReason
            || (selected.configured ? 'Channel is configured, but still needs a doctor result, bridge, or recent event to become live.'
              : 'Known channel, but scaffold or credentials are still missing.'),
    };
  }

  private buildCommands(channelId: PlatformKey, selected: ChannelSetupAssistantOption): ChannelConnectionPlaybookCommands {
    return {
      inspect: selected.commands.inspect,
      apply: selected.commands.apply,
      doctor: selected.commands.doctor,
      liveProof: `npm run zavorth:channel-live-canary -- --channel ${channelId}`,
      sendTest: `zavorth channels ${channelId} send-test`,
    };
  }

  private buildStatus(
    status: ChannelSetupAssistantSession['status'],
    readiness: ChannelConnectionPlaybookReadiness,
  ): ChannelConnectionPlaybookStatus {
    if (readiness.defaultRouteAllowed) {
      return 'default-route-ready';
    }
    if (readiness.liveReady) {
      return 'live-ready';
    }
    if (status === 'ready' || status === 'ready_to_validate') {
      return 'ready-to-validate';
    }
    if (status === 'needs_config') {
      return 'needs-config';
    }
    if (status === 'needs_scaffold') {
      return 'needs-scaffold';
    }
    return 'needs-channel';
  }

  private buildSteps(
    selected: ChannelSetupAssistantOption,
    readiness: ChannelConnectionPlaybookReadiness,
    commands: ChannelConnectionPlaybookCommands,
    meshEntry: ChannelMeshSnapshotEntry | null,
  ): ChannelConnectionPlaybookStep[] {
    const hasScaffold = selected.currentMode !== null;
    const hasSecrets = selected.missingEnvKeys.length === 0;
    const needsWebhook = selected.webhookUrl !== null;
    const allowlistMissing = selected.missingEnvKeys.some((key) => /ALLOWED|RECIPIENT|GUILD|CHANNEL|USER/i.test(key));
    const lastHealthPassed = meshEntry?.lastHealth === 'passed';

    return [
      this.step('choose-channel', 'Choose channel and mode', 'done', null, [
        `${selected.label} selecionado em modo ${selected.setupMode}.`,
      ]),
      this.step('prepare-scaffold', 'Prepare safe scaffold', hasScaffold ? 'done' : 'next', commands.apply, [
        'Creates empty .env entries and local directories when needed.',
        'Could does not fill tokens, passwords, or secrets for the user.',
      ]),
      this.step('fill-secrets', 'Fill credentials in .env', hasSecrets ? 'done' : hasScaffold ? 'next' : 'blocked', null, [
        selected.missingEnvKeys.length > 0
          ? `missing: ${selected.missingEnvKeys.join(', ')}.`
          : 'Required credentials are not missing.',
      ]),
      this.step('configure-webhook', 'Configure webhook or bridge', !needsWebhook ? 'done' : hasSecrets ? 'next' : 'pending', null, [
        needsWebhook ? `Configure the provider to call ${selected.webhookUrl}.`
          : 'This mode does not require a public webhook.',
      ]),
      this.step('set-allowlist', 'Close operator and recipient allowlists', allowlistMissing ? 'next' : hasSecrets ? 'done' : 'pending', null, [
        ...(CHANNEL_HINTS[selected.channelId] || []),
      ]),
      this.step('run-doctor', 'Run channel doctor', lastHealthPassed ? 'done' : hasSecrets ? 'next' : 'blocked', commands.doctor, [
        'The doctor confirms credentials, policy, and local readiness without sending secrets to logs.',
      ]),
      this.step('prove-live', 'Prove live connection', readiness.liveReady ? 'done' : hasSecrets ? 'next' : 'blocked', commands.liveProof, [
        'Live mode requires health, a recent event, or a connected bridge.',
        'catalog, scaffold, QR pending ou outbox do not count as live.',
      ]),
      this.step('send-test', 'Run safe send test', readiness.defaultRouteAllowed ? 'done' : readiness.liveReady ? 'next' : 'blocked', commands.sendTest, [
        'Real sending only after live proof and default route release.',
      ]),
    ];
  }

  private step(
    id: ChannelConnectionPlaybookStep['id'],
    label: string,
    status: ChannelConnectionStepStatus,
    command: string | null,
    details: string[],
  ): ChannelConnectionPlaybookStep {
    return { id, label, status, command, details };
  }

  private buildSummary(
    selected: ChannelSetupAssistantOption,
    readiness: ChannelConnectionPlaybookReadiness,
    meshEntry: ChannelMeshSnapshotEntry | null,
  ): string {
    if (readiness.defaultRouteAllowed) {
      return `${selected.label} has live proof and can be used as the default route.`;
    }
    if (readiness.liveReady) {
      return `${selected.label} has live proof, but is not released as the default route yet.`;
    }
    if (selected.missingEnvKeys.length > 0) {
      return `${selected.label} is prepared for ${selected.setupMode}, but still needs credentials or an allowlist.`;
    }
    if (meshEntry?.readiness === 'ready') {
      return `${selected.label} is configured/cataloged; operational live proof is missing.`;
    }
    return selected.summary;
  }

  private buildNextAction(
    steps: ChannelConnectionPlaybookStep[],
    selected: ChannelSetupAssistantOption,
    readiness: ChannelConnectionPlaybookReadiness,
  ): string {
    const next = steps.find((step) => step.status === 'next') || steps.find((step) => step.status === 'pending');
    if (next?.command) {
      return `${next.label}: ${next.command}`;
    }
    if (next) {
      return next.label;
    }
    if (readiness.defaultRouteAllowed) {
      return `Use ${selected.label} as a live channel with receipts and policy.`;
    }
    return selected.operatorNextStep;
  }

  private resolveSelectedId(value: string | null | undefined): PlatformKey | null {
    return value ? normalizePlatformKey(value) : null;
  }

  private extractChannelIdFromText(text: string | null | undefined): string | null {
    const normalized = String(text || '').trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    return PLATFORM_KEYS.find((key) => normalized.includes(key)) || null;
  }
}
