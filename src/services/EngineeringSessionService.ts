import type {
  EngineeringReplaySnapshot,
  EngineeringSessionSnapshot,
  EngineeringRunSnapshot,
} from '../contracts/EngineeringCoreContract.js';
import { SessionV2Service } from './SessionV2Service.js';

type EngineeringSessionServiceOptions = {
  sessionV2?: Pick<
    SessionV2Service,
    'createSession' | 'getSession' | 'listRecordings'
  >;
  experimentalSessionV2?: Pick<
    SessionV2Service,
    'createSession' | 'getSession' | 'listRecordings'
  >;
};

export class EngineeringSessionService {
  private readonly sessionV2: Pick<
    SessionV2Service,
    'createSession' | 'getSession' | 'listRecordings'
  >;

  constructor(options: EngineeringSessionServiceOptions = {}) {
    this.sessionV2 = options.sessionV2 || options.experimentalSessionV2 || new SessionV2Service();
  }

  public ensureSession(runId: string, cwd?: string | null): EngineeringSessionSnapshot {
    const sessionId = this.toSessionId(runId);
    const snapshot = this.sessionV2.createSession({
      sessionId,
      cwd,
      record: true,
    });

    return {
      sessionId: snapshot.sessionId,
      live: snapshot.state.status === 'PROCESSING' || snapshot.state.status === 'IDLE',
      recordingEnabled: snapshot.recording.enabled,
      recordingPath: snapshot.recording.lastSavedPath,
    };
  }

  public getReplay(run: EngineeringRunSnapshot): EngineeringReplaySnapshot {
    const sessionId = this.toSessionId(run.runId);
    const session = this.sessionV2.getSession(sessionId);
    const recordings = this.sessionV2.listRecordings(sessionId);
    return {
      run,
      session,
      recordings,
    };
  }

  public toSessionId(runId: string): string {
    return `engineering-${String(runId || '').trim()}`;
  }
}
