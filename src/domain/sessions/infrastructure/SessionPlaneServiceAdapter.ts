import type { SessionPlanePort, SessionPlaneStatusInput } from '../domain/SessionDomainTypes.js';

export class SessionPlaneServiceAdapter implements SessionPlanePort {
  constructor(private readonly service: SessionPlanePort) {}

  public buildStatusSummaryFast(input: SessionPlaneStatusInput): ReturnType<SessionPlanePort['buildStatusSummaryFast']> {
    return this.service.buildStatusSummaryFast(input);
  }

  public buildSnapshot(input: SessionPlaneStatusInput): Promise<unknown> {
    if (!this.service.buildSnapshot) {
      return Promise.resolve(null);
    }
    return this.service.buildSnapshot(input);
  }

  public sendToSession(input: unknown): Promise<unknown> {
    if (!this.service.sendToSession) {
      return Promise.reject(new Error('Session send use case is not available in this domain adapter.'));
    }
    return this.service.sendToSession(input);
  }

  public spawnSession(input: unknown): Promise<unknown> {
    if (!this.service.spawnSession) {
      return Promise.reject(new Error('Session spawn use case is not available in this domain adapter.'));
    }
    return this.service.spawnSession(input);
  }
}
