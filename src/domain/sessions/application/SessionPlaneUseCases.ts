import { SessionPlaneServiceAdapter } from '../infrastructure/SessionPlaneServiceAdapter.js';
import type {
  SessionPlanePort,
  SessionPlaneStatusInput,
  SessionsDomainReadModel,
} from '../domain/SessionDomainTypes.js';

type SessionPlaneUseCasesRuntime = {
  now?: () => Date;
  sessionPlane?: SessionPlanePort | null;
};

export class SessionPlaneUseCases {
  private readonly now: () => Date;
  private readonly sessionPlane: SessionPlanePort | null;

  constructor(runtime: SessionPlaneUseCasesRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sessionPlane = runtime.sessionPlane ? new SessionPlaneServiceAdapter(runtime.sessionPlane) : null;
  }

  public buildStatusReadModel(input: SessionPlaneStatusInput): SessionsDomainReadModel {
    if (!this.sessionPlane) {
      return {
        generatedAt: this.now().toISOString(),
        sessions: 0,
        historyItems: 0,
        sendReady: false,
        spawnReady: false,
        headline: 'Sessions domain waiting for the canonical session plane.',
        operatorSummary: 'Nenhum session plane foi injetado neste contexto.',
        source: 'empty',
      };
    }

    const snapshot = this.sessionPlane.buildStatusSummaryFast(input);
    return {
      generatedAt: snapshot.generatedAt,
      sessions: snapshot.summary.sessions,
      historyItems: snapshot.summary.historyItems,
      sendReady: snapshot.summary.sendReady,
      spawnReady: snapshot.summary.spawnReady,
      headline: snapshot.narrative.headline,
      operatorSummary: snapshot.narrative.operatorSummary,
      source: 'session-plane',
    };
  }

  public buildSnapshot(input: SessionPlaneStatusInput): Promise<unknown> {
    return this.sessionPlane?.buildSnapshot?.(input) || Promise.resolve(null);
  }

  public sendToSession(input: unknown): Promise<unknown> {
    if (!this.sessionPlane?.sendToSession) {
      return Promise.reject(new Error('Session send use case is not available.'));
    }
    return this.sessionPlane.sendToSession(input);
  }

  public spawnSession(input: unknown): Promise<unknown> {
    if (!this.sessionPlane?.spawnSession) {
      return Promise.reject(new Error('Session spawn use case is not available.'));
    }
    return this.sessionPlane.spawnSession(input);
  }
}
