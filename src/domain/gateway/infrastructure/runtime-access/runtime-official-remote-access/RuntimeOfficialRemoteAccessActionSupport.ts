import type { RuntimeOfficialAccessReport } from '../RuntimeOfficialAccessService.js';
import { RuntimeOfficialRemoteAccessStateStore } from './RuntimeOfficialRemoteAccessStateStore.js';
import { RuntimeOfficialRemoteAccessReportBuilder } from './RuntimeOfficialRemoteAccessReportBuilder.js';
import type {
  RuntimeOfficialRemoteAccessAction,
  RuntimeOfficialRemoteActionOptions,
  RuntimeOfficialRemotePersistedState,
  RuntimeOfficialRemoteRolloutCandidate,
} from './RuntimeOfficialRemoteAccessTypes.js';

type RuntimeOfficialRemoteAccessActionContext = {
  official: RuntimeOfficialAccessReport;
  candidates: RuntimeOfficialRemoteRolloutCandidate[];
  persistedState: RuntimeOfficialRemotePersistedState;
  options: RuntimeOfficialRemoteActionOptions;
};

type RuntimeOfficialRemoteAccessActionSupportDeps = {
  now: () => Date;
  stateStore: RuntimeOfficialRemoteAccessStateStore;
  reportBuilder: RuntimeOfficialRemoteAccessReportBuilder;
};

export class RuntimeOfficialRemoteAccessActionSupport {
  private readonly now: () => Date;
  private readonly stateStore: RuntimeOfficialRemoteAccessStateStore;
  private readonly reportBuilder: RuntimeOfficialRemoteAccessReportBuilder;

  constructor(deps: RuntimeOfficialRemoteAccessActionSupportDeps) {
    this.now = deps.now;
    this.stateStore = deps.stateStore;
    this.reportBuilder = deps.reportBuilder;
  }

  public runAction(
    action: RuntimeOfficialRemoteAccessAction,
    context: RuntimeOfficialRemoteAccessActionContext,
  ): RuntimeOfficialRemotePersistedState {
    if (action === 'apply') {
      return this.apply(context);
    }
    if (action === 'verify') {
      return this.verify(context);
    }
    if (action === 'go') {
      return this.go(context);
    }
    return this.rollback(context);
  }

  private apply(context: RuntimeOfficialRemoteAccessActionContext): RuntimeOfficialRemotePersistedState {
    const { official, candidates, persistedState, options } = context;
    const recommendedId = official.remote.ready ? null : (candidates[0]?.id || null);
    const selectedId = options.provider || persistedState.provider || recommendedId;
    const selectedCandidate = this.findCandidate(candidates, selectedId);
    const now = this.now().toISOString();
    const nextState = this.stateStore.normalize({
      provider: selectedId,
      lastAction: 'apply',
      lastActionAt: now,
      lastVerifiedAt: official.remote.ready ? now : persistedState.lastVerifiedAt,
      status: this.reportBuilder.resolveStateStatus(official, selectedCandidate, 'apply'),
      appUrl: official.remote.appUrl || official.manifest?.remote?.appUrl || null,
      baseUrl: official.manifest?.remote?.baseUrl || null,
      issues: this.reportBuilder.getOfficialRemoteIssues(official),
      summary: selectedCandidate
        ? `Caminho remoto oficial selecionado: ${selectedCandidate.label}.`
        : 'Caminho remoto oficial selecionado.',
    });

    this.persist(nextState, options);
    return nextState;
  }

  private verify(context: RuntimeOfficialRemoteAccessActionContext): RuntimeOfficialRemotePersistedState {
    const { official, candidates, persistedState, options } = context;
    const selectedId = options.provider || persistedState.provider || null;
    const selectedCandidate = this.findCandidate(candidates, selectedId);
    const now = this.now().toISOString();
    const nextState = this.stateStore.normalize({
      provider: selectedId,
      lastAction: 'verify',
      lastActionAt: now,
      lastVerifiedAt: now,
      status: this.reportBuilder.resolveStateStatus(official, selectedCandidate, 'verify'),
      appUrl: official.remote.appUrl || official.manifest?.remote?.appUrl || null,
      baseUrl: official.manifest?.remote?.baseUrl || null,
      issues: this.reportBuilder.getOfficialRemoteIssues(official),
      summary: official.remote.ready
        ? 'Acesso remoto oficial validado com sucesso.'
        : 'A validacao do acesso remoto oficial ainda encontrou pendencias.',
    });

    this.persist(nextState, options);
    return nextState;
  }

  private rollback(context: RuntimeOfficialRemoteAccessActionContext): RuntimeOfficialRemotePersistedState {
    const { official, options } = context;
    const nextState = this.stateStore.normalize({
      provider: null,
      lastAction: 'rollback',
      lastActionAt: this.now().toISOString(),
      lastVerifiedAt: null,
      status: this.reportBuilder.resolveStateStatus(official, null, 'rollback'),
      appUrl: official.remote.appUrl || official.manifest?.remote?.appUrl || null,
      baseUrl: official.manifest?.remote?.baseUrl || null,
      issues: this.reportBuilder.getOfficialRemoteIssues(official),
      summary: 'A configuracao guiada do acesso remoto oficial foi limpa.',
    });

    this.persist(nextState, options);
    return nextState;
  }

  private go(context: RuntimeOfficialRemoteAccessActionContext): RuntimeOfficialRemotePersistedState {
    const { official, candidates, persistedState, options } = context;
    const selectedId =
      options.provider
      || persistedState.provider
      || (official.remote.ready ? null : (candidates[0]?.id || null));
    const selectedCandidate = this.findCandidate(candidates, selectedId);
    const now = this.now().toISOString();
    const nextState = this.stateStore.normalize({
      provider: selectedId,
      lastAction: 'go',
      lastActionAt: now,
      lastVerifiedAt: official.remote.ready ? now : persistedState.lastVerifiedAt,
      status: this.reportBuilder.resolveStateStatus(official, selectedCandidate, 'go'),
      appUrl: official.remote.appUrl || official.manifest?.remote?.appUrl || null,
      baseUrl: official.manifest?.remote?.baseUrl || null,
      issues: this.reportBuilder.getOfficialRemoteIssues(official),
      summary: official.remote.ready
        ? 'Caminho remoto oficial fechado em um comando.'
        : (selectedCandidate
          ? `Caminho remoto oficial iniciado em um comando com ${selectedCandidate.label}.`
          : 'Caminho remoto oficial iniciado em um comando.'),
    });

    this.persist(nextState, options);
    return nextState;
  }

  private persist(
    nextState: RuntimeOfficialRemotePersistedState,
    options: RuntimeOfficialRemoteActionOptions,
  ): void {
    if (!options.dryRun) {
      this.stateStore.writeState(nextState);
    }
  }

  private findCandidate(
    candidates: RuntimeOfficialRemoteRolloutCandidate[],
    id: RuntimeOfficialRemotePersistedState['provider'],
  ): RuntimeOfficialRemoteRolloutCandidate | null {
    if (!id) {
      return null;
    }

    return candidates.find((candidate) => candidate.id === id) || null;
  }
}
