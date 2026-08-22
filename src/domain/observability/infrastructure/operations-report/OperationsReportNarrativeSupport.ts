import type { OperationsCockpitService } from '../../../../services/OperationsDashboardService.js';

type OperationsCockpitSnapshot = Awaited<ReturnType<OperationsCockpitService['readSnapshot']>>;

export class OperationsReportNarrativeSupport {
  constructor(private readonly now: () => Date) {}

  public formatRelativeTime(value: string | null): string {
    if (!value) {
      return 'no schedule';
    }

    const target = Date.parse(value);
    if (!Number.isFinite(target)) {
      return 'invalid date';
    }

    const diffMs = target - this.now().getTime();
    const absoluteMinutes = Math.round(Math.abs(diffMs) / 60000);
    if (absoluteMinutes < 1) {
      return 'now';
    }

    if (absoluteMinutes < 60) {
      return diffMs >= 0 ? `in ${absoluteMinutes} min` : `${absoluteMinutes} min ago`;
    }

    const absoluteHours = Math.round(absoluteMinutes / 60);
    if (absoluteHours < 24) {
      return diffMs >= 0 ? `in ${absoluteHours} h` : `${absoluteHours} h ago`;
    }

    const absoluteDays = Math.round(absoluteHours / 24);
    return diffMs >= 0 ? `in ${absoluteDays} d` : `${absoluteDays} d ago`;
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
            ? `${channelLabel} active; ${discordBridge.pendingOutbox} recent sends recorded.`
            : `${channelLabel} active; inbox ${discordBridge.pendingInbox} and outbox ${discordBridge.pendingOutbox}.`,
        );
      } else {
        summaries.push(
          discordBridge.lastError ? `${channelLabel} requires attention: ${discordBridge.lastError}.`
            : `${channelLabel} enabled, but has not yet reached ready state.`,
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
          'channel(s)',
          this.resolveLocalChannelModeLabel(slackChannel.mode, 'slack'),
        ),
      );
    }

    if (!summaries.length) {
      return 'No complementary channels enabled on the current host.';
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
            ? `discord ready | native | sends ${discordBridge.pendingOutbox}`
            : `discord ready | bridge | inbox ${discordBridge.pendingInbox} | outbox ${discordBridge.pendingOutbox}`
          : 'discord pending',
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
          'channels',
          this.resolveLocalChannelModeLabel(slackChannel.mode, 'slack'),
        ),
      );
    }

    if (!labels.length) {
      return 'no additional channels';
    }

    return labels.join(' ; ');
  }

  public buildTenantSummary(cockpit: OperationsCockpitSnapshot): string {
    const summary = this.getTenantSummary(cockpit);
    if (!summary.totalCount) {
      return 'No multi-surface tenants have been observed yet.';
    }
    if (summary.pendingOnboardingCount > 0) {
      return `${summary.totalCount} tenant(s) observed; ${summary.pendingOnboardingCount} shared tenant(s) still require onboarding.`;
    }
    return `${summary.totalCount} tenant(s) observed; shared isolation with no pending onboarding.`;
  }

  public buildTenantLabel(cockpit: OperationsCockpitSnapshot): string {
    const summary = this.getTenantSummary(cockpit);
    if (!summary.totalCount) {
      return 'no tenants observed';
    }
    return summary.pendingOnboardingCount > 0
      ? `${summary.totalCount} observados | onboarding pending ${summary.pendingOnboardingCount}`
      : `${summary.totalCount} observed | onboarding current`;
  }

  public buildNodeMeshSummary(cockpit: OperationsCockpitSnapshot): string {
    const smoke = cockpit.operations.nodeMeshSmoke;
    if (!smoke || smoke.status === 'missing') {
      return 'Node Mesh has no recent real smoke test recorded yet.';
    }
    if (smoke.status === 'running') {
      return 'Node Mesh has a real smoke test in progress; please wait for mesh validation.';
    }
    if (smoke.status === 'failed') {
      return smoke.error ? `Node Mesh failed the last real smoke test: ${smoke.error}.`
        : 'Node Mesh failed the last real smoke test; review the mesh before trusting remote invokes.';
    }
    if (smoke.stale) {
      return `Node Mesh real smoke test expired ${this.formatRelativeTime(smoke.checkedAt)}; run ${smoke.recommendedAction || smoke.command || 'npm run test:nodes:smoke'} to renew mesh validation.`;
    }
    return `Node Mesh validated by real smoke test ${this.formatRelativeTime(smoke.checkedAt)}; last invoke ${smoke.recentCapabilityId || 'n/d'}.`;
  }

  public buildNodeMeshLabel(cockpit: OperationsCockpitSnapshot): string {
    const smoke = cockpit.operations.nodeMeshSmoke;
    if (!smoke || smoke.status === 'missing') {
      return 'no recent smoke';
    }
    if (smoke.status === 'running') {
      return `running | ${this.formatRelativeTime(smoke.checkedAt)}`;
    }
    if (smoke.status === 'failed') {
      return `failed | ${this.formatRelativeTime(smoke.checkedAt)}`;
    }
    if (smoke.stale) {
      return `expired | ${this.formatRelativeTime(smoke.checkedAt)}`;
    }
    return `validated | ${this.formatRelativeTime(smoke.checkedAt)} | ${smoke.recentCapabilityId || 'n/d'}`;
  }

  public buildZavorthBridgeMobileSummary(cockpit: OperationsCockpitSnapshot): string {
    const mobile = cockpit.operations.zavorthBridgeMobileAccess;
    if (!mobile || mobile.status === 'missing') {
      return 'ZavorthBridge mobile has no active lease at the moment.';
    }
    if (mobile.status === 'active') {
      return `ZavorthBridge mobile active via ${mobile.mode === 'public' ? 'public URL' : 'LAN'}${mobile.expiresAt ? ` until ${mobile.expiresAt}` : ''}.`;
    }
    if (mobile.status === 'expired') {
      return 'ZavorthBridge mobile had an active lease, but it expired.';
    }
    return 'ZavorthBridge mobile was manually terminated.';
  }

  public buildMaintenanceAutomationSummary(cockpit: OperationsCockpitSnapshot): string {
    const automation = cockpit.operations.maintenanceAutomation;
    const summary = automation.enabled ? `Recurring automation active; next window ${this.formatRelativeTime(automation.nextPlannedAt)}.`
      : 'Recurring automation disabled on this host.';

    if (automation.lastTriggerSource === 'priority') {
      return `${summary} Last priority auto-trigger: ${automation.lastPriorityReason || 'early operational revalidation.'}`;
    }

    return summary;
  }

  public buildMaintenanceAutomationLabel(cockpit: OperationsCockpitSnapshot): string {
    const automation = cockpit.operations.maintenanceAutomation;
    if (!automation.enabled) {
      return 'disabled';
    }
    if (automation.lastTriggerSource === 'priority') {
      return `prioritized | ${automation.lastPriorityReason || 'early operational revalidation.'} | next ${this.formatRelativeTime(automation.nextPlannedAt)}`;
    }
    return `active | next ${this.formatRelativeTime(automation.nextPlannedAt)}`;
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
      return 'Native channel doctor has not yet been executed on this host.';
    }
    if (doctor.status === 'skipped') {
      return doctor.summary || 'Native channel doctor was skipped because no real provider is configured.';
    }
    if (doctor.status === 'failed') {
      return doctor.summary || 'Native channel doctor found pending issues in Slack native or WhatsApp Cloud API.';
    }
    if (doctor.stale) {
      return `Native channel doctor expired ${this.formatRelativeTime(doctor.checkedAt)}; run ${doctor.recommendedAction || doctor.command || 'npm run test:channels:smoke'} before expanding the rollout.`;
    }

    const passedProviders = (doctor.items || [])
      .filter((item) => item.status === 'passed')
      .map((item) => this.describeDoctorProvider(item.channelId, item.mode));
    const providerLabel = passedProviders.length
      ? passedProviders.join(' e ')
      : 'configured providers';
    return `Native channel doctor validated ${providerLabel} ${this.formatRelativeTime(doctor.checkedAt)}.`;
  }

  public buildChannelProviderDoctorLabel(cockpit: OperationsCockpitSnapshot): string {
    const doctor = cockpit.operations.channelProviderDoctor;
    if (!doctor || doctor.status === 'missing') {
      return 'no recent doctor';
    }
    if (doctor.status === 'skipped') {
      return 'skipped';
    }
    if (doctor.status === 'failed') {
      return `failed | ${this.formatRelativeTime(doctor.checkedAt)}`;
    }
    if (doctor.stale) {
      return `expired | ${this.formatRelativeTime(doctor.checkedAt)}`;
    }

    const passedProviders = (doctor.items || [])
      .filter((item) => item.status === 'passed')
      .map((item) => this.describeDoctorProvider(item.channelId, item.mode));
    return `validated | ${this.formatRelativeTime(doctor.checkedAt)} | ${passedProviders.join(', ') || 'configured providers'}`;
  }

  public buildRemoteTransportDoctorSummary(cockpit: OperationsCockpitSnapshot): string {
    const doctor = cockpit.operations.remoteTransportDoctor;
    if (!doctor || doctor.status === 'missing') {
      return 'Remote transport doctor has not yet been executed on this host.';
    }
    if (doctor.status === 'running') {
      return 'Remote transport doctor is validating right now.';
    }
    if (doctor.status === 'skipped') {
      return doctor.summary || 'Remote transport doctor was skipped on this host.';
    }
    if (doctor.status === 'failed') {
      return doctor.summary || 'Remote transport doctor found pending items on the remote plane.';
    }
    if (doctor.stale) {
      return `Remote transport doctor expired ${this.formatRelativeTime(doctor.checkedAt)}; run ${doctor.recommendedAction || doctor.command || 'npm run test:transports:smoke'} before trusting sidecars, gateways, and paired nodes.`;
    }

    const passedItems = (doctor.items || [])
      .filter((item) => item.status === 'passed')
      .length;
    return `Remote transport doctor validated ${passedItems} flow(s) ${this.formatRelativeTime(doctor.checkedAt)}.`;
  }

  public buildRemoteTransportDoctorLabel(cockpit: OperationsCockpitSnapshot): string {
    const doctor = cockpit.operations.remoteTransportDoctor;
    if (!doctor || doctor.status === 'missing') {
      return 'no recent doctor';
    }
    if (doctor.status === 'running') {
      return 'validating';
    }
    if (doctor.status === 'skipped') {
      return 'skipped';
    }
    if (doctor.status === 'failed') {
      return `failed | ${this.formatRelativeTime(doctor.checkedAt)}`;
    }
    if (doctor.stale) {
      return `expired | ${this.formatRelativeTime(doctor.checkedAt)}`;
    }

    const passedItems = (doctor.items || [])
      .filter((item) => item.status === 'passed')
      .length;
    return `validated | ${this.formatRelativeTime(doctor.checkedAt)} | ${passedItems} flow(s)`;
  }

  private describeDiscordChannel(mode: unknown): string {
    return mode === 'native' ? 'Native Discord gateway' : 'Discord bridge';
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
      return `${label} requires attention: ${channel.lastError}.`;
    }
    if (!channel.started) {
      return modeLabel === 'supervised local'
        ? `${label} enabled, but has not yet reached ready state.`
        : `${label} ${modeLabel} enabled, but has not yet reached ready state.`;
    }
    if (channel.recipientsConfigured < 1) {
      return modeLabel === 'supervised local'
        ? `${label} enabled, but no ${recipientsLabel} allowed for mesh rollout yet.`
        : `${label} ${modeLabel} enabled, but no ${recipientsLabel} allowed for mesh rollout yet.`;
    }
    return modeLabel === 'supervised local'
      ? `${label} active in supervised local mode; ${channel.recipientsConfigured} ${recipientsLabel} allowed.`
      : `${label} ${modeLabel} active; ${channel.recipientsConfigured} ${recipientsLabel} allowed.`;
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
      return `${label} error`;
    }
    if (!channel.started || channel.recipientsConfigured < 1) {
      return modeLabel === 'supervised local' ? `${label} pending` : `${label} pending | ${modeLabel}`;
    }
    return `${label} ready | ${modeLabel} | ${recipientsLabel} ${channel.recipientsConfigured}`;
  }

  private resolveLocalChannelModeLabel(
    mode: unknown,
    channelId: unknown,
  ): string {
    if (mode === 'native') {
      return channelId === 'slack' ? 'native' : 'native';
    }
    if (mode === 'cloud-api') {
      return 'Cloud API';
    }
    if (mode === 'baileys') {
      return 'Baileys';
    }
    return 'supervised local';
  }

  private describeDoctorProvider(
    channelId: unknown,
    mode: unknown,
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
