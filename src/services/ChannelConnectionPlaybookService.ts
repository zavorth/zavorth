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
    'Use um bot dedicado e limite TELEGRAM_ALLOWED_USER_IDS aos operadores reais.',
    'Telegram nao precisa de URL publica para comecar.',
  ],
  discord: [
    'Convide o bot apenas para guilds autorizadas e preencha DISCORD_ALLOWED_GUILD_IDS.',
    'Mantenha DISCORD_PUBLIC_SERVER_MODE=false ate validar comandos e policy.',
  ],
  whatsapp: [
    'Cloud API precisa de webhook publico e recipients permitidos antes de envio real.',
    'Bridge local ou QR nao conta como live ate existir prova de runtime conectado.',
  ],
  instagram: [
    'Meta Messaging exige conta business, webhook publico e recipients permitidos.',
    'Modo stub/outbox serve para preparar fluxo, nao para prometer DM real.',
  ],
  slack: [
    'Slack nativo precisa de bot token, signing secret e canais permitidos.',
    'Stub/outbox e util para ensaio, mas nao vira rota padrao.',
  ],
  signal: [
    'Use conta dedicada, signal-cli ou JSON-RPC local e SIGNAL_ALLOWED_RECIPIENTS fechado.',
    'Signal e bridge local supervisionada, nao Bot API oficial.',
  ],
  imessage: [
    'iMessage depende de macOS bridge e deve iniciar read-only.',
    'Envio exige IMESSAGE_ALLOWED_RECIPIENTS e aprovacao operacional.',
  ],
  teams: [
    'Teams precisa de app, tenant, segredo e conversas permitidas.',
    'Publique webhook so depois de doctor e allowlist.',
  ],
  email: [
    'Local-outbox e bom para notificacoes seguras antes de SMTP/IMAP real.',
    'EMAIL_ALLOWED_RECIPIENTS deve ser fechado antes de qualquer envio.',
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
        `${summary.total} canais cobertos; ${summary.needsConfig} precisam de credenciais, `
        + `${summary.readyToValidate} estao prontos para doctor, ${summary.liveReady} tem prova live e `
        + `${summary.defaultRouteAllowed} pode virar rota padrao.`,
    };
  }

  public renderText(input: ChannelConnectionPlaybookInput = {}): string {
    const snapshot = this.buildSnapshot(input);
    const selected = snapshot.selected;
    const lines = [
      'Playbook de conexao de canais do Zavorth',
      '',
      snapshot.operatorSummary,
      'Catalogado ou scaffoldado nao significa conectado ao vivo.',
    ];

    if (!selected) {
      lines.push(
        '',
        'Canais:',
        ...snapshot.playbooks.map((entry) =>
          `- ${entry.label}: ${entry.status}; proximo passo: ${entry.nextAction}`),
        '',
        'Use --channel <canal> para ver o roteiro completo.',
      );
      return lines.join('\n');
    }

    lines.push(
      '',
      `${selected.label} (${selected.channelId})`,
      selected.summary,
      `Modo: ${selected.mode || 'nao escolhido'}.`,
      `Live: ${selected.readiness.liveReady ? 'sim' : 'nao'} (${selected.readiness.readinessProof}).`,
      selected.readiness.defaultRouteAllowed
        ? 'Rota padrao: liberada.'
        : `Rota padrao: bloqueada - ${selected.readiness.defaultBlockReason || 'precisa de prova live.'}`,
      `Proximo passo: ${selected.nextAction}`,
      '',
      'Passos:',
      ...selected.steps.map((step) =>
        `- [${step.status}] ${step.label}${step.command ? `: ${step.command}` : ''}`),
      '',
      `Variaveis necessarias: ${selected.requiredInputKeys.join(', ') || 'nenhuma'}.`,
      `Variaveis faltantes: ${selected.missingInputKeys.join(', ') || 'nenhuma'}.`,
    );

    if (selected.webhookUrl) {
      lines.push(`Webhook esperado: ${selected.webhookUrl}`);
    }

    lines.push(
      '',
      'Comandos:',
      `- Inspecionar: ${selected.commands.inspect}`,
      `- Preparar scaffold: ${selected.commands.apply}`,
      `- Rodar doctor: ${selected.commands.doctor}`,
      `- Provar live: ${selected.commands.liveProof}`,
      `- Teste seguro: ${selected.commands.sendTest}`,
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
      throw new Error(`Playbook sem canal selecionado: ${channelId}.`);
    }
    return session.selected;
  }

  private buildReadiness(
    selected: ChannelSetupAssistantOption,
    meshEntry: ChannelMeshSnapshotEntry | null,
  ): ChannelConnectionPlaybookReadiness {
    const outboxOnlyMode = selected.setupMode === 'stub' || selected.setupMode === 'local-outbox';
    const liveReady = outboxOnlyMode ? false : meshEntry?.liveReady === true;
    const defaultRouteAllowed = outboxOnlyMode ? false : meshEntry?.defaultRouteAllowed === true;
    return {
      configured: selected.configured || meshEntry?.configured === true,
      liveReady,
      defaultRouteAllowed,
      readinessProof: outboxOnlyMode
        ? 'catalog'
        : meshEntry?.readinessProof || (selected.configured ? 'configuration' : 'none'),
      defaultBlockReason: defaultRouteAllowed
        ? null
        : outboxOnlyMode
          ? 'Modo stub/local-outbox prepara e registra mensagens, mas nao e rota live padrao.'
          : meshEntry?.defaultBlockReason
            || (selected.configured
              ? 'Canal configurado, mas ainda precisa de doctor, bridge ou evento recente para virar live.'
              : 'Canal conhecido, mas ainda falta scaffold ou credenciais.'),
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
      this.step('choose-channel', 'Escolher canal e modo', 'done', null, [
        `${selected.label} selecionado em modo ${selected.setupMode}.`,
      ]),
      this.step('prepare-scaffold', 'Preparar scaffold seguro', hasScaffold ? 'done' : 'next', commands.apply, [
        'Cria entradas vazias no .env e diretorios locais quando necessario.',
        'Nao preenche tokens, senhas ou segredos pelo usuario.',
      ]),
      this.step('fill-secrets', 'Preencher credenciais no .env', hasSecrets ? 'done' : hasScaffold ? 'next' : 'blocked', null, [
        selected.missingEnvKeys.length > 0
          ? `Faltam: ${selected.missingEnvKeys.join(', ')}.`
          : 'Credenciais obrigatorias nao estao faltando.',
      ]),
      this.step('configure-webhook', 'Configurar webhook ou bridge', !needsWebhook ? 'done' : hasSecrets ? 'next' : 'pending', null, [
        needsWebhook
          ? `Configure o provedor para chamar ${selected.webhookUrl}.`
          : 'Este modo nao exige webhook publico.',
      ]),
      this.step('set-allowlist', 'Fechar allowlist de operadores e destinatarios', allowlistMissing ? 'next' : hasSecrets ? 'done' : 'pending', null, [
        ...(CHANNEL_HINTS[selected.channelId] || []),
      ]),
      this.step('run-doctor', 'Rodar doctor do canal', lastHealthPassed ? 'done' : hasSecrets ? 'next' : 'blocked', commands.doctor, [
        'O doctor confirma credenciais, policy e readiness local sem enviar segredo para logs.',
      ]),
      this.step('prove-live', 'Provar conexao live', readiness.liveReady ? 'done' : hasSecrets ? 'next' : 'blocked', commands.liveProof, [
        'Live exige health, evento recente ou bridge conectada.',
        'Catalogo, scaffold, QR pendente ou outbox nao contam como live.',
      ]),
      this.step('send-test', 'Fazer teste seguro de envio', readiness.defaultRouteAllowed ? 'done' : readiness.liveReady ? 'next' : 'blocked', commands.sendTest, [
        'Envio real so depois de prova live e rota padrao liberada.',
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
      return `${selected.label} tem prova live e pode ser usado como rota padrao.`;
    }
    if (readiness.liveReady) {
      return `${selected.label} tem prova live, mas ainda nao esta liberado como rota padrao.`;
    }
    if (selected.missingEnvKeys.length > 0) {
      return `${selected.label} esta preparado para ${selected.setupMode}, mas ainda precisa de credenciais/allowlist.`;
    }
    if (meshEntry?.readiness === 'ready') {
      return `${selected.label} esta configurado/catalogado; falta prova operacional live.`;
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
      return `Usar ${selected.label} como canal live com receipts e policy.`;
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
