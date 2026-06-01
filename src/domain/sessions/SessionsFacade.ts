import { DomainFacadeBase, type DomainSnapshot } from '../DomainFacadeBase.js';
import { SessionPlaneUseCases } from './application/SessionPlaneUseCases.js';
import type { SessionPlanePort } from './domain/SessionDomainTypes.js';
import { SessionsDomainPresenter } from './presentation/SessionsDomainPresenter.js';

type SessionsFacadeRuntime = {
  now?: () => Date;
  sessionPlaneService?: Pick<SessionPlanePort, 'buildStatusSummaryFast'>;
  defaultUserId?: string | null;
  defaultPlatform?: string | null;
  defaultSessionId?: string | null;
  defaultChatId?: string | null;
};

export type SessionsDomainSnapshot = DomainSnapshot & {
  metrics: {
    sessions: number;
    historyItems: number;
    sendReady: boolean;
    spawnReady: boolean;
  };
};

export class SessionsFacade extends DomainFacadeBase<SessionsDomainSnapshot> {
  private readonly useCases: SessionPlaneUseCases;
  private readonly presenter = new SessionsDomainPresenter();
  private readonly defaultUserId: string;
  private readonly defaultPlatform: string | null;
  private readonly defaultSessionId: string | null;
  private readonly defaultChatId: string | null;

  constructor(runtime: SessionsFacadeRuntime = {}) {
    super('sessions', 'Sessions', runtime.now);
    this.useCases = new SessionPlaneUseCases({
      now: runtime.now,
      sessionPlane: runtime.sessionPlaneService || null,
    });
    this.defaultUserId = String(runtime.defaultUserId || 'gateway-core').trim() || 'gateway-core';
    this.defaultPlatform = String(runtime.defaultPlatform || 'web').trim() || 'web';
    this.defaultSessionId = String(runtime.defaultSessionId || 'gateway-core').trim() || null;
    this.defaultChatId = String(runtime.defaultChatId || 'web:gateway-core').trim() || null;
  }

  public buildSnapshot(): SessionsDomainSnapshot {
    const readModel = this.useCases.buildStatusReadModel({
      userId: this.defaultUserId,
      platform: this.defaultPlatform,
      sessionId: this.defaultSessionId,
      chatId: this.defaultChatId,
    });

    return this.composeSnapshot(this.presenter.presentStatus(readModel)) as SessionsDomainSnapshot;
  }
}
