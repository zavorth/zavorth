import type { OperationsCockpitService } from '../../../../services/OperationsCockpitService.js';

type OperationsCockpitSnapshot = Awaited<ReturnType<OperationsCockpitService['readSnapshot']>>;

export class OperationsReportNarrativeSupport {
  constructor(private readonly now: () => Date) {}

  public formatRelativeTime(value: string | null): string {
    if (!value) {
      return 'sem agenda';
    }

    const target = Date.parse(value);
    if (!Number.isFinite(target)) {
      return 'data invalida';
    }

    const diffMs = target - this.now().getTime();
    const absoluteMinutes = Math.round(Math.abs(diffMs) / 60000);
    if (absoluteMinutes < 1) {
      return 'agora';
    }

    if (absoluteMinutes < 60) {
      return diffMs >= 0 ? `em ${absoluteMinutes} min` : `ha ${absoluteMinutes} min`;
    }

    const absoluteHours = Math.round(absoluteMinutes / 60);
    if (absoluteHours < 24) {
      return diffMs >= 0 ? `em ${absoluteHours} h` : `ha ${absoluteHours} h`;
    }

    const absoluteDays = Math.round(absoluteHours / 24);
    return diffMs >= 0 ? `em ${absoluteDays} d` : `ha ${absoluteDays} d`;
  }

  public buildChannelSummary(cockpit: OperationsCockpitSnapshot): string {
    const discordBridge = cockpit.operations.channels?.discordBridge;
    const whatsAppChannel = cockpit.operations.channels?.whatsapp;
    const slackChannel = cockpit.operations.channels?.slack;
    const summaries: string[] = [];

    if (discordBridge?.enabled) {
      const channelLabel = this.describeDiscordChannel(discordBridge?.mode);
      if (discordBridge.started) {
        summaries.push(
          discordBridge.mode === 'native'
            ? `${channelLabel} ativo; ${discordBridge.pendingOutbox} envios recentes registrados.`
            : `${channelLabel} ativo; inbox ${discordBridge.pendingInbox} e outbox ${discordBridge.pendingOutbox}.`,
        );
      } else {
        summaries.push(
          discordBridge.lastError
            ? `${channelLabel} requer atencao: ${discordBridge.lastError}.`
            : `${channelLabel} habilitado, mas ainda nao entrou em estado pronto.`,
        );
      }
    }

    if (whatsAppChannel?.enabled) {
      summaries.push(
        this.describeLocalChannelSummary(
          whatsAppChannel,
          'WhatsApp',
          'chat(s)',
          this.resolveLocalChannelModeLabel(whatsAppChannel.mode, 'whatsapp'),
        ),
      );
    }

    if (slackChannel?.enabled) {
      summaries.push(
        this.describeLocalChannelSummary(
          slackChannel,
          'Slack',
          'canal(is)',
          this.resolveLocalChannelModeLabel(slackChannel.mode, 'slack'),
        ),
      );
    }

    if (!summaries.length) {
      return 'Nenhum canal complementar habilitado no host atual.';
    }

    return summaries.join(' ');
  }

  public buildChannelLabel(cockpit: OperationsCockpitSnapshot): string {
    const discordBridge = cockpit.operations.channels?.discordBridge;
    const whatsAppChannel = cockpit.operations.channels?.whatsapp;
    const slackChannel = cockpit.operations.channels?.slack;
    const labels: string[] = [];

    if (discordBridge?.enabled) {
      labels.push(
        discordBridge.started
          ? discordBridge.mode === 'native'
            ? `discord pronto | nativo | envios ${discordBridge.pendingOutbox}`
            : `discord pronto | bridge | inbox ${discordBridge.pendingInbox} | outbox ${discordBridge.pendingOutbox}`
          : 'discord pendente',
      );
    }

    if (whatsAppChannel?.enabled) {
      labels.push(
        this.describeLocalChannelLabel(
          whatsAppChannel,
          'whatsapp',
          'chats',
          this.resolveLocalChannelModeLabel(whatsAppChannel.mode, 'whatsapp'),
        ),
      );
    }

    if (slackChannel?.enabled) {
      labels.push(
        this.describeLocalChannelLabel(
          slackChannel,
          'slack',
          'canais',
          this.resolveLocalChannelModeLabel(slackChannel.mode, 'slack'),
        ),
      );
    }

    if (!labels.length) {
      return 'sem canais adicionais';
    }

    return labels.join(' ; ');
  }

  public buildTenantSummary(cockpit: OperationsCockpitSnapshot): string {
    const summary = this.getTenantSummary(cockpit);
    if (!summary.totalCount) {
      return 'Nenhum tenant multi-superficie foi observado ainda.';
    }
    if (summary.pendingOnboardingCount > 0) {
      return `${summary.totalCount} tenant(s) observados; ${summary.pendingOnboardingCount} compartilhado(s) ainda exigem onboarding.`;
    }
    return `${summary.totalCount} tenant(s) observados; isolamento compartilhado sem onboarding pendente.`;
  }

  public buildTenantLabel(cockpit: OperationsCockpitSnapshot): string {
    const summary = this.getTenantSummary(cockpit);
    if (!summary.totalCount) {
      return 'sem tenants observados';
    }
    return summary.pendingOnboardingCount > 0
      ? `${summary.totalCount} observados | onboarding pendente ${summary.pendingOnboardingCount}`
      : `${summary.totalCount} observados | onboarding em dia`;
  }

  public buildNodeMeshSummary(cockpit: OperationsCockpitSnapshot): string {
    const smoke = cockpit.operations.nodeMeshSmoke;
    if (!smoke || smoke.status === 'missing') {
      return 'Node Mesh ainda sem smoke real recente registrado.';
    }
    if (smoke.status === 'running') {
      return 'Node Mesh com smoke real em andamento; aguarde a validacao da malha.';
    }
    if (smoke.status === 'failed') {
      return smoke.error
        ? `Node Mesh com falha no ultimo smoke real: ${smoke.error}.`
        : 'Node Mesh com falha no ultimo smoke real; revise a malha antes de confiar em invokes remotos.';
    }
    if (smoke.stale) {
      return `Node Mesh com smoke real vencido ${this.formatRelativeTime(smoke.checkedAt)}; rode ${smoke.recommendedAction || smoke.command || 'npm run test:nodes:smoke'} para renovar a validacao da malha.`;
    }
    return `Node Mesh validado por smoke real ${this.formatRelativeTime(smoke.checkedAt)}; ultimo invoke ${smoke.recentCapabilityId || 'n/d'}.`;
  }

  public buildNodeMeshLabel(cockpit: OperationsCockpitSnapshot): string {
    const smoke = cockpit.operations.nodeMeshSmoke;
    if (!smoke || smoke.status === 'missing') {
      return 'sem smoke recente';
    }
    if (smoke.status === 'running') {
      return `rodando | ${this.formatRelativeTime(smoke.checkedAt)}`;
    }
    if (smoke.status === 'failed') {
      return `falhou | ${this.formatRelativeTime(smoke.checkedAt)}`;
    }
    if (smoke.stale) {
      return `vencido | ${this.formatRelativeTime(smoke.checkedAt)}`;
    }
    return `validado | ${this.formatRelativeTime(smoke.checkedAt)} | ${smoke.recentCapabilityId || 'n/d'}`;
  }

  public buildZavorthBridgeMobileSummary(cockpit: OperationsCockpitSnapshot): string {
    const mobile = cockpit.operations.zavorthBridgeMobileAccess;
    if (!mobile || mobile.status === 'missing') {
      return 'ZavorthBridge mobile sem lease ativo no momento.';
    }
    if (mobile.status === 'active') {
      return `ZavorthBridge mobile ativo via ${mobile.mode === 'public' ? 'URL publica' : 'LAN'}${mobile.expiresAt ? ` ate ${mobile.expiresAt}` : ''}.`;
    }
    if (mobile.status === 'expired') {
      return 'ZavorthBridge mobile tinha lease ativo, mas ele expirou.';
    }
    return 'ZavorthBridge mobile foi encerrado manualmente.';
  }

  public buildMaintenanceAutomationSummary(cockpit: OperationsCockpitSnapshot): string {
    const automation = cockpit.operations.maintenanceAutomation;
    const summary = automation.enabled
      ? `Automacao recorrente ativa; proxima janela ${this.formatRelativeTime(automation.nextPlannedAt)}.`
      : 'Automacao recorrente desativada neste host.';

    if (automation.lastTriggerSource === 'priority') {
      return `${summary} Ultimo autodisparo prioritario: ${automation.lastPriorityReason || 'revalidacao operacional antecipada.'}`;
    }

    return summary;
  }

  public buildMaintenanceAutomationLabel(cockpit: OperationsCockpitSnapshot): string {
    const automation = cockpit.operations.maintenanceAutomation;
    if (!automation.enabled) {
      return 'desativada';
    }
    if (automation.lastTriggerSource === 'priority') {
      return `priorizada | ${automation.lastPriorityReason || 'revalidacao operacional antecipada.'} | proxima ${this.formatRelativeTime(automation.nextPlannedAt)}`;
    }
    return `ativa | proxima ${this.formatRelativeTime(automation.nextPlannedAt)}`;
  }

  public getTenantSummary(cockpit: OperationsCockpitSnapshot): {
    totalCount: number;
    sharedCount: number;
    personalCount: number;
    pendingOnboardingCount: number;
    publicServerCount: number;
    byPlatform: Record<string, number>;
    recent: Array<{
      tenantId: string;
      platform: string;
      policyProfile: string;
      onboardingStatus: string;
      lastSeenAt: string;
    }>;
  } {
    const summary = cockpit.operations.tenants;
    if (summary) {
      return summary;
    }

    return {
      totalCount: 0,
      sharedCount: 0,
      personalCount: 0,
      pendingOnboardingCount: 0,
      publicServerCount: 0,
      byPlatform: {},
      recent: [],
    };
  }

  public buildChannelProviderDoctorSummary(cockpit: OperationsCockpitSnapshot): string {
    const doctor = cockpit.operations.channelProviderDoctor;
    if (!doctor || doctor.status === 'missing') {
      return 'Doctor dos canais nativos ainda nao foi executado neste host.';
    }
    if (doctor.status === 'skipped') {
      return doctor.summary || 'Doctor dos canais nativos foi pulado porque nenhum provider real esta configurado.';
    }
    if (doctor.status === 'failed') {
      return doctor.summary || 'Doctor dos canais nativos encontrou pendencias em Slack native ou WhatsApp Cloud API.';
    }
    if (doctor.stale) {
      return `Doctor dos canais nativos venceu ${this.formatRelativeTime(doctor.checkedAt)}; rode ${doctor.recommendedAction || doctor.command || 'npm run test:channels:smoke'} antes de ampliar o rollout.`;
    }

    const passedProviders = (doctor.items || [])
      .filter((item) => item.status === 'passed')
      .map((item) => this.describeDoctorProvider(item.channelId, item.mode));
    const providerLabel = passedProviders.length
      ? passedProviders.join(' e ')
      : 'os providers configurados';
    return `Doctor dos canais nativos validou ${providerLabel} ${this.formatRelativeTime(doctor.checkedAt)}.`;
  }

  public buildChannelProviderDoctorLabel(cockpit: OperationsCockpitSnapshot): string {
    const doctor = cockpit.operations.channelProviderDoctor;
    if (!doctor || doctor.status === 'missing') {
      return 'sem doctor recente';
    }
    if (doctor.status === 'skipped') {
      return 'pulado';
    }
    if (doctor.status === 'failed') {
      return `falhou | ${this.formatRelativeTime(doctor.checkedAt)}`;
    }
    if (doctor.stale) {
      return `vencido | ${this.formatRelativeTime(doctor.checkedAt)}`;
    }

    const passedProviders = (doctor.items || [])
      .filter((item) => item.status === 'passed')
      .map((item) => this.describeDoctorProvider(item.channelId, item.mode));
    return `validado | ${this.formatRelativeTime(doctor.checkedAt)} | ${passedProviders.join(', ') || 'providers configurados'}`;
  }

  public buildRemoteTransportDoctorSummary(cockpit: OperationsCockpitSnapshot): string {
    const doctor = cockpit.operations.remoteTransportDoctor;
    if (!doctor || doctor.status === 'missing') {
      return 'Doctor dos transportes remotos ainda nao foi executado neste host.';
    }
    if (doctor.status === 'running') {
      return 'Doctor dos transportes remotos em validacao neste momento.';
    }
    if (doctor.status === 'skipped') {
      return doctor.summary || 'Doctor dos transportes remotos foi pulado neste host.';
    }
    if (doctor.status === 'failed') {
      return doctor.summary || 'Doctor dos transportes remotos encontrou pendencias no plano remoto.';
    }
    if (doctor.stale) {
      return `Doctor dos transportes remotos venceu ${this.formatRelativeTime(doctor.checkedAt)}; rode ${doctor.recommendedAction || doctor.command || 'npm run test:transports:smoke'} antes de confiar em sidecars, gateways e nodes pareados.`;
    }

    const passedItems = (doctor.items || [])
      .filter((item) => item.status === 'passed')
      .length;
    return `Doctor dos transportes remotos validou ${passedItems} fluxo(s) ${this.formatRelativeTime(doctor.checkedAt)}.`;
  }

  public buildRemoteTransportDoctorLabel(cockpit: OperationsCockpitSnapshot): string {
    const doctor = cockpit.operations.remoteTransportDoctor;
    if (!doctor || doctor.status === 'missing') {
      return 'sem doctor recente';
    }
    if (doctor.status === 'running') {
      return 'em validacao';
    }
    if (doctor.status === 'skipped') {
      return 'pulado';
    }
    if (doctor.status === 'failed') {
      return `falhou | ${this.formatRelativeTime(doctor.checkedAt)}`;
    }
    if (doctor.stale) {
      return `vencido | ${this.formatRelativeTime(doctor.checkedAt)}`;
    }

    const passedItems = (doctor.items || [])
      .filter((item) => item.status === 'passed')
      .length;
    return `validado | ${this.formatRelativeTime(doctor.checkedAt)} | ${passedItems} fluxo(s)`;
  }

  private describeDiscordChannel(mode: 'bridge' | 'native' | 'unknown' | undefined): string {
    return mode === 'native' ? 'Gateway nativo do Discord' : 'Discord bridge';
  }

  private describeLocalChannelSummary(
    channel: {
      enabled: boolean;
      started: boolean;
      recipientsConfigured: number;
      lastError: string | null;
    },
    label: string,
    recipientsLabel: string,
    modeLabel: string,
  ): string {
    if (channel.lastError) {
      return `${label} requer atencao: ${channel.lastError}.`;
    }
    if (!channel.started) {
      return modeLabel === 'local supervisionado'
        ? `${label} habilitado, mas ainda nao entrou em estado pronto.`
        : `${label} ${modeLabel} habilitado, mas ainda nao entrou em estado pronto.`;
    }
    if (channel.recipientsConfigured < 1) {
      return modeLabel === 'local supervisionado'
        ? `${label} habilitado, mas ainda sem ${recipientsLabel} permitidos para rollout no mesh.`
        : `${label} ${modeLabel} habilitado, mas ainda sem ${recipientsLabel} permitidos para rollout no mesh.`;
    }
    return modeLabel === 'local supervisionado'
      ? `${label} ativo em modo local supervisionado; ${channel.recipientsConfigured} ${recipientsLabel} permitidos.`
      : `${label} ${modeLabel} ativo; ${channel.recipientsConfigured} ${recipientsLabel} permitidos.`;
  }

  private describeLocalChannelLabel(
    channel: {
      enabled: boolean;
      started: boolean;
      recipientsConfigured: number;
      lastError: string | null;
    },
    label: string,
    recipientsLabel: string,
    modeLabel: string,
  ): string {
    if (channel.lastError) {
      return `${label} erro`;
    }
    if (!channel.started || channel.recipientsConfigured < 1) {
      return modeLabel === 'local supervisionado' ? `${label} pendente` : `${label} pendente | ${modeLabel}`;
    }
    return `${label} pronto | ${modeLabel} | ${recipientsLabel} ${channel.recipientsConfigured}`;
  }

  private resolveLocalChannelModeLabel(
    mode: 'stub' | 'native' | 'cloud-api' | 'baileys' | 'unknown' | undefined,
    channelId: 'slack' | 'whatsapp',
  ): string {
    if (mode === 'native') {
      return channelId === 'slack' ? 'nativo' : 'native';
    }
    if (mode === 'cloud-api') {
      return 'Cloud API';
    }
    if (mode === 'baileys') {
      return 'Baileys';
    }
    return 'local supervisionado';
  }

  private describeDoctorProvider(
    channelId: 'slack' | 'whatsapp' | 'telegram' | 'discord' | 'signal' | 'imessage' | 'teams' | 'email',
    mode:
      | 'native'
      | 'cloud-api'
      | 'stub'
      | 'baileys'
      | 'bridge'
      | 'signal-cli'
      | 'mac-bridge'
      | 'graph-bot'
      | 'smtp-imap'
      | 'unknown',
  ): string {
    if (channelId === 'telegram') {
      return 'Telegram';
    }
    if (channelId === 'discord') {
      return mode === 'bridge' ? 'Discord bridge' : 'Discord';
    }
    if (channelId === 'whatsapp') {
      if (mode === 'cloud-api') {
        return 'WhatsApp Cloud API';
      }
      if (mode === 'baileys') {
        return 'WhatsApp Baileys';
      }
      return 'WhatsApp';
    }

    if (channelId === 'signal') {
      return 'Signal bridge';
    }
    if (channelId === 'imessage') {
      return 'iMessage Mac bridge';
    }
    if (channelId === 'teams') {
      return 'Microsoft Teams';
    }
    if (channelId === 'email') {
      return 'Email SMTP/IMAP';
    }

    return mode === 'native' ? 'Slack native' : 'Slack';
  }
}
