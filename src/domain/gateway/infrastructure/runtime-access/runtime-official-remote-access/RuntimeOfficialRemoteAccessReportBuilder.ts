import type { RuntimeOfficialAccessReport } from '../RuntimeOfficialAccessService.js';
import type {
  RuntimeOfficialRemoteAccessAction,
  RuntimeOfficialRemoteAccessReport,
  RuntimeOfficialRemotePersistedState,
  RuntimeOfficialRemoteRolloutCandidate,
  RuntimeOfficialRemoteRolloutCandidateId,
  RuntimeOfficialRemoteRolloutState,
  RuntimeOfficialRemoteRolloutStateStatus,
} from './RuntimeOfficialRemoteAccessTypes.js';

type RuntimeOfficialRemoteAccessReportBuilderDeps = {
  now: () => Date;
};

type RuntimeOfficialRemoteAccessReportInput = {
  official: RuntimeOfficialAccessReport;
  candidates: RuntimeOfficialRemoteRolloutCandidate[];
  persistedState: RuntimeOfficialRemotePersistedState;
};

export class RuntimeOfficialRemoteAccessReportBuilder {
  private readonly now: () => Date;

  constructor(deps: RuntimeOfficialRemoteAccessReportBuilderDeps) {
    this.now = deps.now;
  }

  public buildReport(input: RuntimeOfficialRemoteAccessReportInput): RuntimeOfficialRemoteAccessReport {
    const { official, candidates, persistedState } = input;
    const recommendedId = official.remote.ready ? null : (candidates[0]?.id || null);
    const activeId = persistedState.provider || null;
    const activeCandidate = activeId
      ? candidates.find((candidate) => candidate.id === activeId) || null
      : null;
    const state = this.buildPublicState(official, activeCandidate, persistedState);
    const nextSteps = this.buildNextSteps(official, candidates, recommendedId, state);
    const recommendedPathReason = this.buildRecommendedPathReason(official, state, candidates, recommendedId);

    return {
      generatedAt: this.now().toISOString(),
      summary: this.buildSummary(official, candidates, recommendedId, state),
      official,
      recommendedPathId: official.remote.ready ? 'official' : (state.provider || recommendedId),
      recommendedPathReason,
      paths: this.buildCompatibilityPaths(official, candidates, state),
      remote: {
        configured: official.remote.configured,
        baseUrl: official.manifest?.remote?.baseUrl || null,
        appUrl: official.remote.appUrl,
        shareUrl: official.remote.appUrl || official.manifest?.remote?.baseUrl || null,
        ready: official.remote.ready,
        issues: this.getOfficialRemoteIssues(official),
      },
      rollout: {
        activeId,
        recommendedId,
        candidates,
      },
      state,
      actions: this.buildActions(official, state, candidates, recommendedId, recommendedPathReason),
      nextSteps,
    };
  }

  public getOfficialRemoteIssues(official: RuntimeOfficialAccessReport): string[] {
    return Array.isArray(official?.remote?.issues) ? official.remote.issues : [];
  }

  public resolveStateStatus(
    official: RuntimeOfficialAccessReport,
    candidate: RuntimeOfficialRemoteRolloutCandidate | null,
    action: RuntimeOfficialRemoteAccessAction | null,
    fallbackStatus: RuntimeOfficialRemoteRolloutStateStatus | null = null,
  ): RuntimeOfficialRemoteRolloutStateStatus {
    if (official.remote.ready) {
      return 'ready';
    }

    if (
      (action === 'verify' || action === 'apply' || action === 'go')
      && (official.remote.configured || candidate?.ready)
      && this.getOfficialRemoteIssues(official).length > 0
    ) {
      return 'failed';
    }

    if (candidate?.ready || official.remote.configured) {
      return 'provisioning';
    }

    return fallbackStatus || 'pending';
  }

  private buildPublicState(
    official: RuntimeOfficialAccessReport,
    activeCandidate: RuntimeOfficialRemoteRolloutCandidate | null,
    persistedState: RuntimeOfficialRemotePersistedState,
  ): RuntimeOfficialRemoteRolloutState {
    const officialIssues = this.getOfficialRemoteIssues(official);
    const status = this.resolveStateStatus(
      official,
      activeCandidate,
      persistedState.lastAction || null,
      persistedState.status,
    );
    return {
      provider: persistedState.provider,
      status,
      lastAction: persistedState.lastAction,
      lastActionAt: persistedState.lastActionAt,
      lastVerifiedAt: persistedState.lastVerifiedAt,
      appUrl: official.remote.appUrl || persistedState.appUrl || null,
      baseUrl: official.manifest?.remote?.baseUrl || persistedState.baseUrl || null,
      issues: officialIssues.length > 0 ? officialIssues : persistedState.issues,
      summary: persistedState.summary
        || (activeCandidate ? `path remote current: ${activeCandidate.label}.`
          : 'No path remote oficial foi aplicado ainda.'),
    };
  }

  private buildActions(
    official: RuntimeOfficialAccessReport,
    state: RuntimeOfficialRemoteRolloutState,
    candidates: RuntimeOfficialRemoteRolloutCandidate[],
    recommendedId: RuntimeOfficialRemoteRolloutCandidateId | null,
    recommendedPathReason: string,
  ): RuntimeOfficialRemoteAccessReport['actions'] {
    const activeCandidate = state.provider
      ? candidates.find((candidate) => candidate.id === state.provider) || null
      : null;
    const recommendedAction = official.remote.ready ? null : 'go';

    return {
      canGo: Boolean(candidates.length > 0 || official.remote.configured || official.manifest?.remote?.baseUrl),
      canApply: candidates.length > 0,
      canVerify: Boolean(state.provider || official.remote.configured || recommendedId),
      canRollback: Boolean(state.provider || state.lastAction),
      recommendedAction,
      recommendedProvider: state.provider || recommendedId,
      go: {
        id: 'go',
        command: official.manifest?.commands?.remoteGo || 'npm run ops:remote:go',
        baseUrl: official.manifest?.remote?.baseUrl || null,
        appUrl: official.remote.appUrl || official.manifest?.remote?.appUrl || null,
        label: 'Complete remote setup in one command',
        description: recommendedPathReason,
      },
      apply: {
        id: 'apply',
        command: activeCandidate?.command || candidates[0]?.command || official.manifest?.commands?.remote || 'npm run ops:remote',
        baseUrl: official.manifest?.remote?.baseUrl || null,
        appUrl: official.remote.appUrl || official.manifest?.remote?.appUrl || null,
        label: 'Apply official path',
        description: recommendedPathReason,
      },
      verify: {
        id: 'verify',
        command: official.manifest?.commands?.remote || 'npm run ops:remote',
        appUrl: official.remote.appUrl || official.manifest?.remote?.appUrl || null,
        label: 'Verificar agora',
        description: 'Valida again a URL public, o /zavorthControl remote e a auth web.',
      },
      rollback: {
        id: 'rollback',
        command: activeCandidate?.command || candidates[0]?.command || official.manifest?.commands?.remote || 'npm run ops:remote',
        label: 'Limpar wizard',
        description: 'Remove o rollout guiado current e volta o wizard para o estado neutro.',
      },
      open: {
        id: 'open',
        url: official.remote.appUrl || official.manifest?.remote?.appUrl || official.manifest?.remote?.baseUrl || null,
        appUrl: official.remote.appUrl || official.manifest?.remote?.appUrl || null,
        label: 'Abrir app remote',
      },
      copy: {
        id: 'copy',
        command: activeCandidate?.command || candidates[0]?.command || official.manifest?.commands?.remote || 'npm run ops:remote',
        label: 'Copy command',
      },
      connect: {
        id: 'connect',
        url: official.manifest?.remote?.baseUrl || null,
        label: 'Conectar',
      },
      'focus-token': {
        id: 'focus-token',
        label: 'Focar token',
      },
    };
  }

  private buildCompatibilityPaths(
    official: RuntimeOfficialAccessReport,
    candidates: RuntimeOfficialRemoteRolloutCandidate[],
    state: RuntimeOfficialRemoteRolloutState,
  ): RuntimeOfficialRemoteAccessReport['paths'] {
    const officialSteps: RuntimeOfficialRemoteAccessReport['paths'][number]['steps'] = [
      {
        id: 'probe-app',
        title: 'validate remote ZavorthControl',
        status: official.remote.appProbe?.ok ? 'done' : 'pending',
        detail: official.remote.appProbe?.ok ? `GET ${official.remote.appProbe.targetUrl} respondeu ${official.remote.appProbe.statusCode}.`
          : `Validate ${official.remote.appUrl || official.manifest?.remote?.appUrl || official.manifest?.remote?.baseUrl || 'the public URL'} with ${official.manifest?.commands?.remote || 'npm run ops:remote'}.`,
        command: official.remote.ready
          ? (official.manifest?.commands?.remote || 'npm run ops:remote')
          : (official.manifest?.commands?.remoteGo || 'npm run ops:remote:go'),
      },
      {
        id: 'probe-auth',
        title: 'validate a authentication web',
        status: official.remote.authProbe?.ok ? 'done' : 'pending',
        detail: official.remote.authProbe?.ok ? `POST ${official.remote.authProbe.targetUrl} respondeu ${official.remote.authProbe.statusCode}.`
          : 'Check ZAVORTH_WEB_AUTH_TOKEN and public exposure before opening remote ZavorthControl.',
        command: official.remote.ready
          ? (official.manifest?.commands?.remote || 'npm run ops:remote')
          : (official.manifest?.commands?.remoteGo || 'npm run ops:remote:go'),
      },
    ];

    return [
      {
        id: 'official',
        label: 'official remote ZavorthControl path',
        status: official.remote.ready ? ('ready' as const) : ('pending' as const),
        summary: official.remote.ready ? `Remote ZavorthControl validated at ${official.remote.appUrl || official.manifest?.remote?.appUrl || official.manifest?.remote?.baseUrl || 'current public URL'}.`
          : this.buildOfficialPendingSummary(official),
        command: official.remote.ready
          ? (official.manifest?.commands?.remote || 'npm run ops:remote')
          : (official.manifest?.commands?.remoteGo || 'npm run ops:remote:go'),
        steps: officialSteps,
      },
      ...candidates.map((candidate) => ({
        id: candidate.id,
        label: candidate.label,
        status: candidate.ready ? ('rollout-ready' as const) : ('pending' as const),
        summary: candidate.summary,
        command: candidate.command,
        steps: candidate.pendingHighlights.map((highlight, index) => ({
          id: `${candidate.id}-pending-${index + 1}`,
          title: `Pendencia ${index + 1}`,
          status: 'pending' as const,
          detail: highlight,
          command: candidate.command,
        })),
      })),
    ];
  }

  private buildSummary(
    official: RuntimeOfficialAccessReport,
    candidates: RuntimeOfficialRemoteRolloutCandidate[],
    recommendedId: RuntimeOfficialRemoteRolloutCandidateId | null,
    state: RuntimeOfficialRemoteRolloutState,
  ): string {
    if (official.remote.ready) {
      return 'official remote access ready; remote ZavorthControl can already use the Zavorth runtime.';
    }

    if (state.provider) {
      const selected = candidates.find((item) => item.id === state.provider) || null;
      if (selected) {
        return `access remote oficial ainda pending; o rollout selecionado e ${selected.label.toLowerCase()}.`;
      }
    }

    const recommended = recommendedId
      ? candidates.find((item) => item.id === recommendedId) || null
      : null;
    if (recommended) {
      return `access remote oficial ainda pending; o melhor path agora e ${recommended.label.toLowerCase()}.`;
    }

    return 'access remote oficial ainda pending; revise a URL public, o token web e o rollout sugerido.';
  }

  private buildOfficialPendingSummary(official: RuntimeOfficialAccessReport): string {
    const issues = this.getOfficialRemoteIssues(official);
    if (issues.length > 0) {
      return `A URL public oficial ainda tem pending items: ${issues[0]}.`;
    }

    if (official.remote.configured) {
      return 'A URL public oficial already foi configurada, mas ainda missing validate o /zavorthControl remote e a authentication web.';
    }

    return 'The official public URL still needs to be configured and validated.';
  }

  private buildNextSteps(
    official: RuntimeOfficialAccessReport,
    candidates: RuntimeOfficialRemoteRolloutCandidate[],
    recommendedId: RuntimeOfficialRemoteRolloutCandidateId | null,
    state: RuntimeOfficialRemoteRolloutState,
  ): string[] {
    const steps = [...official.nextSteps];
    const activeCandidate = state.provider
      ? candidates.find((item) => item.id === state.provider) || null
      : null;
    const candidate = activeCandidate
      || (recommendedId ? candidates.find((item) => item.id === recommendedId) || null : null);

    if (candidate) {
      steps.push(`Complete official remote setup in one command with ${official.manifest?.commands?.remoteGo || 'npm run ops:remote:go'}.`);
      steps.push(`Revise o rollout recomendado com ${candidate.command}.`);
      steps.push(`Use guide ${candidate.guide} to finish official remote access.`);
      steps.push(...candidate.pendingHighlights);
    }

    return Array.from(new Set(steps.filter(Boolean)));
  }

  private buildRecommendedPathReason(
    official: RuntimeOfficialAccessReport,
    state: RuntimeOfficialRemoteRolloutState,
    candidates: RuntimeOfficialRemoteRolloutCandidate[],
    recommendedId: RuntimeOfficialRemoteRolloutCandidateId | null,
  ): string {
    if (official.remote.ready) {
      return 'O app remote e a authentication web already responderam; esse already e o path oficial active.';
    }

    if (state.provider) {
      const active = candidates.find((candidate) => candidate.id === state.provider) || null;
      if (active) {
        return `O rollout guiado current usa ${active.label.toLowerCase()}.`;
      }
    }

    const recommended = recommendedId
      ? candidates.find((candidate) => candidate.id === recommendedId) || null
      : null;
    if (recommended) {
      return `O melhor next passo agora e ${recommended.label.toLowerCase()}.`;
    }

    return 'O path oficial ainda depende da URL public HTTPS e da validation do token web.';
  }
}
