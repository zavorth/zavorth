/**
 * Cron/schedule drain visibility on shutdown.
 *
 * Surfaces in-progress processDue work and due routines so operators can see
 * what would be interrupted. Waits briefly for in-flight materialization.
 */

import path from 'node:path';
import {
  AutonomySchedulePlane,
  bindAutonomySchedulePlane,
  type AutonomyRoutine,
} from './AutonomySchedulePlane.js';

export type CronDrainSnapshot = {
  generatedAt: string;
  killSwitchActive: boolean;
  processDueInFlight: number;
  dueRoutines: Array<{ id: string; name: string; nextRunAt: string | null; enabled: boolean }>;
  dueCount: number;
  enabledCount: number;
  totalRoutines: number;
  reason: string;
};

export type CronDrainResult = {
  ok: boolean;
  waitedMs: number;
  timedOut: boolean;
  snapshotBefore: CronDrainSnapshot;
  snapshotAfter: CronDrainSnapshot;
  summary: string;
};

type Runtime = {
  plane?: AutonomySchedulePlane | null;
  runtimeDir?: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
};

export class CronDrainService {
  private readonly plane: AutonomySchedulePlane;
  private readonly now: () => Date;
  private readonly sleep: (ms: number) => Promise<void>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sleep = runtime.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.plane = runtime.plane
      || bindAutonomySchedulePlane({
        runtimeDir: runtime.runtimeDir || path.join(process.cwd(), 'data', 'runtime'),
      });
  }

  public buildSnapshot(): CronDrainSnapshot {
    const status = this.plane.getDrainStatus();
    return {
      generatedAt: this.now().toISOString(),
      killSwitchActive: status.killSwitchActive,
      processDueInFlight: status.processDueInFlight,
      dueRoutines: status.dueRoutines.map((routine) => ({
        id: routine.id,
        name: routine.name,
        nextRunAt: routine.nextRunAt,
        enabled: routine.enabled,
      })),
      dueCount: status.dueRoutines.length,
      enabledCount: status.enabledCount,
      totalRoutines: status.totalRoutines,
      reason: status.processDueInFlight > 0
        ? `${status.processDueInFlight} processDue operation(s) in flight; ${status.dueRoutines.length} due routine(s) visible.`
        : status.dueRoutines.length > 0
          ? `${status.dueRoutines.length} due routine(s) pending; no processDue in flight.`
          : 'No due routines and no processDue in flight.',
    };
  }

  /**
   * Wait up to timeoutMs for in-flight processDue to finish; log-friendly summary.
   * Does not cancel work — only visibility + cooperative wait.
   */
  public async drainForShutdown(input: { timeoutMs?: number } = {}): Promise<CronDrainResult> {
    const timeoutMs = Math.max(0, Math.min(Number(input.timeoutMs ?? 5_000) || 5_000, 60_000));
    const snapshotBefore = this.buildSnapshot();
    const started = Date.now();
    let timedOut = false;

    while (this.plane.getDrainStatus().processDueInFlight > 0) {
      if (Date.now() - started >= timeoutMs) {
        timedOut = true;
        break;
      }
      await this.sleep(100);
    }

    const waitedMs = Date.now() - started;
    const snapshotAfter = this.buildSnapshot();
    const summary = timedOut
      ? `Cron drain timed out after ${waitedMs}ms with ${snapshotAfter.processDueInFlight} still in flight; ${snapshotAfter.dueCount} due routine(s).`
      : snapshotAfter.processDueInFlight === 0
        ? `Cron drain clear in ${waitedMs}ms (${snapshotAfter.dueCount} due routine(s) remaining for next boot).`
        : `Cron drain finished wait with activity remaining.`;

    return {
      ok: !timedOut || snapshotAfter.processDueInFlight === 0,
      waitedMs,
      timedOut,
      snapshotBefore,
      snapshotAfter,
      summary,
    };
  }
}

export function formatCronDrainForLog(snapshot: CronDrainSnapshot): string {
  const duePreview = snapshot.dueRoutines
    .slice(0, 8)
    .map((r) => `${r.id}:${r.name}`)
    .join(', ');
  return [
    `cron.drain inFlight=${snapshot.processDueInFlight}`,
    `due=${snapshot.dueCount}`,
    `enabled=${snapshot.enabledCount}/${snapshot.totalRoutines}`,
    `killSwitch=${snapshot.killSwitchActive ? 'on' : 'off'}`,
    duePreview ? `dueList=[${duePreview}]` : 'dueList=[]',
  ].join(' ');
}

// re-export type for tests
export type { AutonomyRoutine };
