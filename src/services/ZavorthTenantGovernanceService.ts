import {
  TenantRegistryService,
  type TenantRegistryRecord,
} from './TenantRegistryService.js';

type TenantRegistryLike = Pick<TenantRegistryService, 'list' | 'summarize'>;

type ZavorthTenantGovernanceRuntime = {
  now?: () => Date;
  tenantRegistryService?: TenantRegistryLike;
};

export type ZavorthTenantGovernanceStatus = 'ready' | 'pending_onboarding' | 'restricted' | 'personal';

export type ZavorthTenantGovernanceAction = {
  id: string;
  label: string;
  description: string;
  command: string;
  actionKind: 'guided' | 'compose';
  emphasis: 'primary' | 'secondary';
};

export type ZavorthTenantGovernanceRecipe = {
  id: string;
  tenantId: string;
  governanceStatus: ZavorthTenantGovernanceStatus;
  label: string;
  summary: string;
  actions: ZavorthTenantGovernanceAction[];
};

export type ZavorthTenantGovernanceEntry = {
  tenantId: string;
  platform: string;
  boundary: TenantRegistryRecord['boundary'];
  isolationMode: string;
  onboardingStatus: string;
  policyProfile: string;
  publicServerMode: boolean;
  scopeId: string | null;
  sessionId: string | null;
  guildId: string | null;
  channelId: string | null;
  threadId: string | null;
  sourceUserId: string | null;
  runtimeUserId: string | null;
  ownerCount: number;
  allowedGuildCount: number;
  allowedChannelCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  governanceStatus: ZavorthTenantGovernanceStatus;
  scopeLabel: string;
  operatorSummary: string;
  nextAction: string | null;
  actions: ZavorthTenantGovernanceAction[];
  recipe: ZavorthTenantGovernanceRecipe | null;
};

export type ZavorthTenantGovernanceSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    shared: number;
    personal: number;
    pendingOnboarding: number;
    publicServers: number;
    readyShared: number;
    restrictedShared: number;
    byPlatform: Record<string, number>;
  };
  tenants: ZavorthTenantGovernanceEntry[];
  pendingOnboarding: ZavorthTenantGovernanceEntry[];
  featuredRecipes: ZavorthTenantGovernanceRecipe[];
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

export class ZavorthTenantGovernanceService {
  private readonly now: () => Date;
  private readonly tenantRegistry: TenantRegistryLike;

  constructor(runtime: ZavorthTenantGovernanceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.tenantRegistry = runtime.tenantRegistryService || new TenantRegistryService();
  }

  public buildSnapshot(input: { limit?: number } = {}): ZavorthTenantGovernanceSnapshot {
    const limit = this.normalizeLimit(input.limit);
    const summary = this.tenantRegistry.summarize(limit);
    const records = this.tenantRegistry.list();
    const tenantEntries = records.slice(0, limit).map((record) => this.buildEntry(record));
    const pendingEntries = summary.pendingOnboarding.map((record) => this.buildEntry(record));
    const featuredRecipes = records
      .map((record) => this.buildEntry(record))
      .filter((entry) => entry.recipe)
      .sort((left, right) => this.compareRecipePriority(left, right))
      .slice(0, 3)
      .map((entry) => entry.recipe as ZavorthTenantGovernanceRecipe);
    const readyShared = records.filter((record) => this.resolveGovernanceStatus(record) === 'ready' && record.boundary === 'shared').length;
    const restrictedShared = records.filter((record) => this.resolveGovernanceStatus(record) === 'restricted').length;

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        total: summary.totalCount,
        shared: summary.sharedCount,
        personal: summary.personalCount,
        pendingOnboarding: summary.pendingOnboardingCount,
        publicServers: summary.publicServerCount,
        readyShared,
        restrictedShared,
        byPlatform: { ...summary.byPlatform },
      },
      tenants: tenantEntries,
      pendingOnboarding: pendingEntries,
      featuredRecipes,
      narrative: {
        headline: `Governanca de tenants com ${summary.totalCount} tenant(s) observado(s).`,
        operatorSummary: this.buildOperatorSummary({
          summary,
          readyShared,
          restrictedShared,
        }),
        nextAction: this.buildNextAction({
          summary,
          restrictedShared,
        }),
      },
    };
  }

  private normalizeLimit(value: number | undefined): number {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 6;
    }
    return Math.max(1, Math.min(24, Math.floor(numeric)));
  }

  private buildEntry(record: TenantRegistryRecord): ZavorthTenantGovernanceEntry {
    const governanceStatus = this.resolveGovernanceStatus(record);
    const ownerCount = record.ownerUserIds.length;
    const allowedGuildCount = record.allowedGuildIds.length;
    const allowedChannelCount = record.allowedChannelIds.length;
    const actions = this.buildEntryActions(record, governanceStatus);
    const recipe = this.buildEntryRecipe(record, governanceStatus, actions);

    return {
      tenantId: record.tenantId,
      platform: record.platform,
      boundary: record.boundary,
      isolationMode: record.isolationMode,
      onboardingStatus: record.onboardingStatus,
      policyProfile: record.policyProfile,
      publicServerMode: record.publicServerMode,
      scopeId: record.scopeId,
      sessionId: record.sessionId,
      guildId: record.guildId,
      channelId: record.channelId,
      threadId: record.threadId,
      sourceUserId: record.sourceUserId,
      runtimeUserId: record.runtimeUserId,
      ownerCount,
      allowedGuildCount,
      allowedChannelCount,
      firstSeenAt: record.firstSeenAt,
      lastSeenAt: record.lastSeenAt,
      governanceStatus,
      scopeLabel: this.buildScopeLabel(record),
      operatorSummary: this.buildEntrySummary(record, governanceStatus),
      nextAction: this.buildEntryNextAction(record, governanceStatus),
      actions,
      recipe,
    };
  }

  private buildEntryActions(
    record: TenantRegistryRecord,
    governanceStatus: ZavorthTenantGovernanceStatus,
  ): ZavorthTenantGovernanceAction[] {
    const inspectTenant = this.createAction(
      'inspect-tenant',
      'Trazer /tenants',
      'Carrega o tenant filtrado na surface textual compartilhada.',
      `/tenants ${record.tenantId}`,
      'primary',
    );
    const reviewTeams = this.createAction(
      'review-teams',
      'review /teams',
      'Confere quais workflows compostos podem operar nesta surface.',
      '/teams',
    );
    const reviewChannels = this.createAction(
      'review-channels',
      'review /channels',
      'Confere o channel mesh oficial before abrir new surfaces.',
      '/channels',
    );
    const reviewRuntime = this.createAction(
      'review-runtime',
      'review /runtime',
      'Confere posture, fail-closed e sinais do runtime principal.',
      '/runtime',
    );
    const reviewMemoryPlane = this.createAction(
      'review-memoryplane',
      'review /memoryplane',
      'Resumes contexto, entregas e memorys ligadas a este tenant.',
      '/memoryplane',
      'secondary',
      'guided',
    );
    const reviewSessions = this.createAction(
      'review-sessions',
      'review /sessions',
      'Opens the session plane for resume points and handoffs linked to the tenant.',
      '/sessions',
      'secondary',
      'guided',
    );

    if (governanceStatus === 'personal') {
      return [inspectTenant, reviewMemoryPlane, reviewSessions];
    }

    if (record.publicServerMode && (governanceStatus === 'pending_onboarding' || governanceStatus === 'restricted')) {
      return [
        inspectTenant,
        this.createAction(
          'start-onboarding-review',
          'Abrir review de onboarding',
          'Starts a review workflow to close tenant onboarding and policy.',
          `/workflow review Fechar onboarding do tenant ${record.tenantId}`,
          'primary',
        ),
        this.createAction(
          reviewChannels.id,
          reviewChannels.label,
          reviewChannels.description,
          reviewChannels.command,
          'primary',
        ),
        reviewTeams,
        reviewRuntime,
      ];
    }

    if (record.publicServerMode) {
      return [
        inspectTenant,
        this.createAction(
          'start-tenant-audit',
          'Open audit do tenant',
          'Starts a review workflow to audit governance and public surface.',
          `/workflow review Auditar governanca do tenant ${record.tenantId}`,
          'primary',
        ),
        this.createAction(
          reviewChannels.id,
          reviewChannels.label,
          reviewChannels.description,
          reviewChannels.command,
          'primary',
        ),
        reviewTeams,
      ];
    }

    if (governanceStatus === 'pending_onboarding') {
      return [
        inspectTenant,
        this.createAction(
          'start-onboarding-review',
          'Abrir review de onboarding',
          'Starts a review workflow to close tenant onboarding and policy.',
          `/workflow review Fechar onboarding do tenant ${record.tenantId}`,
          'primary',
        ),
        reviewTeams,
        reviewRuntime,
      ];
    }

    return [
      inspectTenant,
      this.createAction(
        'start-tenant-audit',
        'Open audit do tenant',
        'Starts a review workflow to audit tenant governance and continuity.',
        `/workflow review Auditar governanca do tenant ${record.tenantId}`,
        'primary',
      ),
      reviewTeams,
      reviewSessions,
    ];
  }

  private buildEntryRecipe(
    record: TenantRegistryRecord,
    governanceStatus: ZavorthTenantGovernanceStatus,
    actions: ZavorthTenantGovernanceAction[],
  ): ZavorthTenantGovernanceRecipe | null {
    if (!actions.length) {
      return null;
    }

    if (governanceStatus === 'personal') {
      return {
        id: `recipe:${record.tenantId}:personal-retake`,
        tenantId: record.tenantId,
        governanceStatus,
        label: 'resume tenant pessoal',
        summary: 'Use the session/memory plane before opening new automations or changing surface.',
        actions,
      };
    }

    if (record.publicServerMode && (governanceStatus === 'pending_onboarding' || governanceStatus === 'restricted')) {
      return {
        id: `recipe:${record.tenantId}:public-onboarding`,
        tenantId: record.tenantId,
        governanceStatus,
        label: 'Close public tenant onboarding',
        summary: 'Keep the tenant fail-closed until owners, allowlists, and workflows reflect the official runtime.',
        actions,
      };
    }

    if (record.publicServerMode) {
      return {
        id: `recipe:${record.tenantId}:public-audit`,
        tenantId: record.tenantId,
        governanceStatus,
        label: 'Audit public tenant',
        summary: 'Revalidate allowlists, channel mesh, and composed workflows before expanding public usage.',
        actions,
      };
    }

    if (governanceStatus === 'pending_onboarding') {
      return {
        id: `recipe:${record.tenantId}:shared-onboarding`,
        tenantId: record.tenantId,
        governanceStatus,
        label: 'Fechar onboarding compartilhado',
        summary: 'Conclua policy e review de workflows before tratar o tenant como ready.',
        actions,
      };
    }

    return {
      id: `recipe:${record.tenantId}:shared-audit`,
      tenantId: record.tenantId,
      governanceStatus,
      label: 'Auditar tenant compartilhado',
      summary: 'Review workflow surface, sessions, and policy profile before the next operational run.',
      actions,
    };
  }

  private createAction(
    id: string,
    label: string,
    description: string,
    command: string,
    emphasis: 'primary' | 'secondary' = 'secondary',
    actionKind: ZavorthTenantGovernanceAction['actionKind'] = 'guided',
  ): ZavorthTenantGovernanceAction {
    return {
      id,
      label,
      description,
      command,
      actionKind,
      emphasis,
    };
  }

  private compareRecipePriority(
    left: ZavorthTenantGovernanceEntry,
    right: ZavorthTenantGovernanceEntry,
  ): number {
    return this.resolveRecipePriority(left) - this.resolveRecipePriority(right);
  }

  private resolveRecipePriority(entry: ZavorthTenantGovernanceEntry): number {
    if (entry.governanceStatus === 'pending_onboarding') {
      return 0;
    }
    if (entry.governanceStatus === 'restricted') {
      return 1;
    }
    if (entry.governanceStatus === 'ready' && entry.boundary === 'shared') {
      return 2;
    }
    return 3;
  }

  private resolveGovernanceStatus(record: TenantRegistryRecord): ZavorthTenantGovernanceStatus {
    if (record.boundary !== 'shared') {
      return 'personal';
    }

    if (record.onboardingStatus === 'pending_onboarding') {
      return 'pending_onboarding';
    }

    if (record.publicServerMode && record.allowedChannelIds.length === 0) {
      return 'restricted';
    }

    return 'ready';
  }

  private buildScopeLabel(record: TenantRegistryRecord): string {
    if (record.channelId) {
      return `channel:${record.channelId}`;
    }
    if (record.guildId) {
      return `guild:${record.guildId}`;
    }
    if (record.sessionId) {
      return `session:${record.sessionId}`;
    }
    if (record.scopeId) {
      return `scope:${record.scopeId}`;
    }
    return record.boundary === 'shared' ? 'shared-boundary' : 'personal-boundary';
  }

  private buildEntrySummary(
    record: TenantRegistryRecord,
    governanceStatus: ZavorthTenantGovernanceStatus,
  ): string {
    if (governanceStatus === 'personal') {
      return `Personal tenant on ${record.platform}, isolated by ${record.isolationMode}.`;
    }

    if (governanceStatus === 'pending_onboarding') {
      return record.publicServerMode ? `Public tenant on ${record.platform} still awaits onboarding and explicit allowlist.`
        : `Tenant compartilhado de ${record.platform} ainda pede onboarding formal.`;
    }

    if (governanceStatus === 'restricted') {
      return `Public tenant on ${record.platform} is fail-closed: no allowed channel was defined.`;
    }

    if (record.publicServerMode) {
      return `Public tenant on ${record.platform} ready with ${record.allowedChannelIds.length} allowed channel(s) and ${record.ownerUserIds.length} owner(s).`;
    }

    return `Tenant compartilhado de ${record.platform} ready com policy ${record.policyProfile}.`;
  }

  private buildEntryNextAction(
    record: TenantRegistryRecord,
    governanceStatus: ZavorthTenantGovernanceStatus,
  ): string | null {
    if (governanceStatus === 'pending_onboarding' || governanceStatus === 'restricted') {
      if (record.publicServerMode) {
        return 'Configure owners and allowed channels before enabling the public surface.';
      }
      return 'Fechar onboarding e policy before tratar este tenant como ready.';
    }

    if (governanceStatus === 'ready' && record.publicServerMode && record.allowedChannelIds.length > 0) {
      return 'validate que a allowlist continua refletindo os channels oficiais do runtime.';
    }

    return null;
  }

  private buildOperatorSummary(input: {
    summary: ReturnType<TenantRegistryLike['summarize']>;
    readyShared: number;
    restrictedShared: number;
  }): string {
    const parts = [
      `${input.summary.sharedCount} compartilhado(s)`,
      `${input.readyShared} ready`,
      input.summary.pendingOnboardingCount ? `${input.summary.pendingOnboardingCount} pending(s) de onboarding`
        : 'nenhum onboarding pending',
      input.restrictedShared ? `${input.restrictedShared} fail-closed por missing de allowlist`
        : 'without tenants compartilhados restritos',
    ];
    if (input.summary.publicServerCount) {
      parts.push(`${input.summary.publicServerCount} in public server mode`);
    }
    return parts.join(' | ');
  }

  private buildNextAction(input: {
    summary: ReturnType<TenantRegistryLike['summarize']>;
    restrictedShared: number;
  }): string {
    if (input.summary.pendingOnboardingCount > 0 || input.restrictedShared > 0) {
      return 'Use this plan to close onboarding, owner scope, and allowlists before opening new surfaces.';
    }
    if (input.summary.sharedCount > 0) {
      return 'review periodicamente owners, channels allowed e policy profiles dos tenants compartilhados.';
    }
    return 'when new surfaces nascerem, observe os tenants aqui before enable automations.';
  }
}
