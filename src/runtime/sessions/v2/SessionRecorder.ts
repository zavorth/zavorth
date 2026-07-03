import fs from 'fs';
import path from 'path';
import type { AgentState, SessionEventMap } from './AgentState.js';

type RecordableSession = {
  getState(): AgentState;
  getEvents(): {
    on<K extends keyof SessionEventMap>(event: K, listener: SessionEventMap[K]): unknown;
  };
};

/**
 * A single frame in an Asciinema v2 recording.
 * Format: [elapsed_seconds, event_type, data]
 */
type AsciiFrame = [number, 'o' | 'i', string];

/**
 * Asciinema v2 header metadata.
 */
interface AsciinemaHeader {
  version: 2;
  width: number;
  height: number;
  timestamp: number;
  title: string;
  env?: Record<string, string>;
}

/**
 * SessionRecorder — Asciinema-compatible DVR for PTY sessions.
 *
 * Every byte of stdout/stdin flowing through a SessionManager is captured
 * with sub-millisecond timestamps and stored in the Asciinema v2 `.cast`
 * format. This enables:
 *
 *  - Full session replay in the ZavorthControl web UI
 *  - Security auditing of agent actions
 *  - Recovery and debugging of failed workflows
 *  - Shareable terminal recordings for team review
 *
 * Architecture decisions:
 *  - Frames are buffered in memory and flushed to disk on stop/interval.
 *  - The `.cast` format is a newline-delimited JSON (header + frames),
 *    directly playable by asciinema-player or any compatible renderer.
 *  - Input events ('i') are recorded separately from output ('o') so
 *    replays can distinguish user commands from agent responses.
 */
export class SessionRecorder {
  private frames: AsciiFrame[] = [];
  private startTime: number = 0;
  private recording = false;
  private readonly sessionId: string;
  private readonly outputDir: string;

  constructor(sessionId: string, outputDir?: string) {
    this.sessionId = sessionId;
    this.outputDir = outputDir || path.join(process.cwd(), 'data', 'recordings');
  }

  /**
   * Attach to a SessionManager and begin recording all PTY streams.
   */
  public startRecording(session: RecordableSession): void {
    if (this.recording) return;

    this.recording = true;
    this.startTime = Date.now();
    this.frames = [];

    session.getEvents().on('pty:data', (data: string) => {
      if (this.recording) {
        this.pushFrame('o', data);
      }
    });

    session.getEvents().on('pty:error', (data: string) => {
      if (this.recording) {
        this.pushFrame('o', data);
      }
    });

    session.getEvents().on('pty:input', (data: string) => {
      if (this.recording) {
        this.pushFrame('i', data);
      }
    });
  }

  /**
   * Record an input event (what the user or agent typed).
   */
  public recordInput(data: string): void {
    if (this.recording) {
      this.pushFrame('i', data);
    }
  }

  /**
   * Stop recording and flush the .cast file to disk.
   * Returns the absolute path to the saved recording.
   */
  public stopRecording(): string | null {
    if (!this.recording) return null;
    this.recording = false;
    return this.flush();
  }

  /**
   * Get the current recording duration in seconds.
   */
  public getElapsedSeconds(): number {
    if (!this.startTime) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  /**
   * Get the raw frame count for observability.
   */
  public getFrameCount(): number {
    return this.frames.length;
  }

  private pushFrame(eventType: 'o' | 'i', data: string): void {
    const elapsed = (Date.now() - this.startTime) / 1000;
    this.frames.push([elapsed, eventType, data]);
  }

  /**
   * Serialize frames to Asciinema v2 format and write to disk.
   */
  private flush(): string | null {
    if (this.frames.length === 0) return null;

    const header: AsciinemaHeader = {
      version: 2,
      width: 120,
      height: 40,
      timestamp: Math.floor(this.startTime / 1000),
      title: `Zavorth Session ${this.sessionId}`,
      env: { SHELL: process.env.SHELL || 'cmd.exe', TERM: 'xterm-256color' },
    };

    const lines: string[] = [JSON.stringify(header)];
    for (const frame of this.frames) {
      lines.push(JSON.stringify(frame));
    }

    fs.mkdirSync(this.outputDir, { recursive: true });
    const filename = `${this.sessionId}-${Date.now()}.cast`;
    const filepath = path.join(this.outputDir, filename);
    fs.writeFileSync(filepath, lines.join('\n') + '\n', 'utf8');

    return filepath;
  }

  /**
   * List all saved recordings on disk.
   */
  public static listRecordings(outputDir?: string): Array<{ filename: string; path: string; sizeBytes: number }> {
    const dir = outputDir || path.join(process.cwd(), 'data', 'recordings');
    if (!fs.existsSync(dir)) return [];

    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.cast'))
      .map((filename) => {
        const filePath = path.join(dir, filename);
        const stat = fs.statSync(filePath);
        return { filename, path: filePath, sizeBytes: stat.size };
      })
      .sort((a, b) => b.filename.localeCompare(a.filename));
  }

  /**
   * Load a recording from disk and parse it back into structured data.
   */
  public static loadRecording(filepath: string): { header: AsciinemaHeader; frames: AsciiFrame[] } | null {
    if (!fs.existsSync(filepath)) return null;

    const raw = fs.readFileSync(filepath, 'utf8').trim().split('\n');
    if (raw.length === 0) return null;

    const header = JSON.parse(raw[0]) as AsciinemaHeader;
    const frames = raw.slice(1).map((line) => JSON.parse(line) as AsciiFrame);
    return { header, frames };
  }
}
