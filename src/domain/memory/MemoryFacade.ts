import { DomainFacadeBase, type DomainSnapshot } from '../DomainFacadeBase.js';
import { MemoryUseCases } from './application/MemoryUseCases.js';
import type { MemoryPlaneSnapshotPort } from './domain/MemoryDomainTypes.js';
import { MemoryPlaneServiceAdapter } from './infrastructure/MemoryPlaneServiceAdapter.js';
import { MemoryDomainPresenter } from './presentation/MemoryDomainPresenter.js';

type MemoryFacadeRuntime = {
  now?: () => Date;
  memoryPlaneService?: MemoryPlaneSnapshotPort;
  defaultUserId?: string | null;
  defaultPlatform?: string | null;
  defaultSessionId?: string | null;
  defaultChatId?: string | null;
};

export type MemoryDomainSnapshot = DomainSnapshot & {
  metrics: {
    persistedMemories: number;
    relevantMemories: number;
    artifacts: number;
    workflowRuns: number;
    timelineEvents: number;
  };
};

export class MemoryFacade extends DomainFacadeBase<MemoryDomainSnapshot> {
  private readonly useCases: MemoryUseCases;
  private readonly presenter = new MemoryDomainPresenter();
  private readonly defaultUserId: string;
  private readonly defaultPlatform: string | null;
  private readonly defaultSessionId: string | null;
  private readonly defaultChatId: string | null;

  constructor(runtime: MemoryFacadeRuntime = {}) {
    super('memory', 'Memory', runtime.now);
    this.useCases = new MemoryUseCases({
      now: runtime.now,
      memory: new MemoryPlaneServiceAdapter({
        now: runtime.now,
        memoryPlaneService: runtime.memoryPlaneService || null,
      }),
    });
    this.defaultUserId = String(runtime.defaultUserId || 'gateway-core').trim() || 'gateway-core';
    this.defaultPlatform = String(runtime.defaultPlatform || 'web').trim() || 'web';
    this.defaultSessionId = String(runtime.defaultSessionId || 'gateway-core').trim() || null;
    this.defaultChatId = String(runtime.defaultChatId || 'web:gateway-core').trim() || null;
  }

  public buildSnapshot(): MemoryDomainSnapshot {
    return this.composeSnapshot(this.presenter.presentReadiness(this.useCases.buildReadiness({
      userId: this.defaultUserId,
      platform: this.defaultPlatform,
      sessionId: this.defaultSessionId,
      chatId: this.defaultChatId,
    }))) as MemoryDomainSnapshot;
  }
}
