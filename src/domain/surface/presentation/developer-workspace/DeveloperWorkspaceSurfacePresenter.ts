import type {
  DeveloperWorkspaceSurfaceActionResult,
  DeveloperWorkspaceSurfaceSnapshot,
} from '../../application/developer-workspace/index.js';

export class DeveloperWorkspaceSurfacePresenter {
  public toReadPayload(snapshot: DeveloperWorkspaceSurfaceSnapshot): Record<string, unknown> {
    const logWatch = snapshot.logWatch || {
      generatedAt: snapshot.generatedAt,
      summary: {
        events: 0,
        suggestions: 0,
        blocked: 0,
        manualRequired: 0,
        rateLimited: 0,
        lastEventAt: null,
      },
      events: [],
    };
    return {
      ...snapshot,
      processes: snapshot.processes.map((process) => ({
        ...process,
        logs: process.logs.slice(-20),
      })),
      logWatch: {
        ...logWatch,
        events: logWatch.events.slice(-20),
      },
    };
  }

  public toActionPayload(result: DeveloperWorkspaceSurfaceActionResult): Record<string, unknown> {
    return {
      ...result,
      snapshot: this.toReadPayload(result.snapshot),
    };
  }
}
