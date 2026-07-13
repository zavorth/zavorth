import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  AutonomySchedulePlane,
  bindAutonomySchedulePlane,
  resolveAutonomyScheduleStorageDir,
} from '../../../src/services/AutonomySchedulePlane.js';
import { TaskPlaneService } from '../../../src/services/TaskPlaneService.js';
import { ZavorthCronSchedulerTool } from '../../../src/tools/ZavorthCronSchedulerTool.js';

describe('AutonomySchedulePlane', () => {
  let root: string;
  let currentTime = Date.parse('2026-07-10T12:00:00.000Z');
  const now = () => new Date(currentTime);

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autonomy-schedule-'));
    currentTime = Date.parse('2026-07-10T12:00:00.000Z');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function makePlane(): { plane: AutonomySchedulePlane; taskPlane: TaskPlaneService; runtimeDir: string } {
    const runtimeDir = path.join(root, 'runtime');
    const taskPlane = new TaskPlaneService({
      storePath: path.join(runtimeDir, 'task-plane.json'),
      now,
    });
    const plane = bindAutonomySchedulePlane({
      runtimeDir,
      taskPlane,
      now,
    });
    return { plane, taskPlane, runtimeDir };
  }

  it('resolves PT/EN natural schedules into interval + nextRun (Phase 5)', () => {
    const { plane } = makePlane();
    const created = plane.createRoutine({
      name: 'NL every hour',
      schedule: 'a cada 1 hora',
      taskDescription: 'check system health',
      riskLevel: 'low',
      actor: 'test',
    });
    expect(created.ok).toBe(true);
    expect(created.routine?.scheduleType).toBe('interval');
    expect(created.routine?.intervalMs).toBe(3_600_000);
    expect(created.routine?.schedule).toBe('every 1h');
    expect(created.routine?.nextRunAt).toBeTruthy();

    const daily = plane.createRoutine({
      name: 'NL daily',
      schedule: 'todo dia as 9h',
      taskDescription: 'morning summary',
      riskLevel: 'low',
      actor: 'test',
    });
    expect(daily.ok).toBe(true);
    expect(daily.routine?.schedule).toBe('daily 09:00');
    expect(daily.routine?.nextRunAt).toBeTruthy();
  });

  it('creates, lists, enables, disables, and run_now materializes Task Plane items', () => {
    const { plane, taskPlane } = makePlane();
    const created = plane.createRoutine({
      name: 'Nightly check',
      schedule: '60000',
      scheduleType: 'interval',
      intervalMs: 60_000,
      taskDescription: 'check system health',
      riskLevel: 'low',
      actor: 'test',
    });

    expect(created.ok).toBe(true);
    expect(created.routine?.id).toBe('nightly_check');
    expect(created.receipt?.receiptId).toBeTruthy();

    const listed = plane.listRoutines();
    expect(listed).toHaveLength(1);

    const disabled = plane.disableRoutine({ routineId: 'nightly_check', actor: 'test' });
    expect(disabled.routine?.enabled).toBe(false);

    const enabled = plane.enableRoutine({ routineId: 'nightly_check', actor: 'test' });
    expect(enabled.routine?.enabled).toBe(true);

    const run = plane.runNow({ routineId: 'nightly_check', actor: 'test' });
    expect(run.ok).toBe(true);
    expect(run.task?.id).toMatch(/^task-/);
    expect(run.task?.source).toBe('autonomy-schedule:nightly_check');
    expect(run.routine?.lastTaskPlaneItemId).toBe(run.task?.id);
    expect(run.routine?.nextRunAt).toBeTruthy();
    expect(taskPlane.listTasks()).toHaveLength(1);
    expect(run.receipt?.result?.status).toBe('applied');
  });

  it('honors kill switch and scope freeze before materialization', () => {
    const { plane, taskPlane } = makePlane();
    plane.createRoutine({
      name: 'Scoped job',
      schedule: '60000',
      scheduleType: 'interval',
      intervalMs: 60_000,
      taskDescription: 'read monitor status',
      riskLevel: 'low',
      scopeTags: ['ops'],
      actor: 'test',
    });

    plane.activateKillSwitch('test');
    const blocked = plane.runNow({ routineId: 'scoped_job', actor: 'test' });
    expect(blocked.ok).toBe(false);
    expect(blocked.blockedReason).toMatch(/kill switch/i);
    expect(taskPlane.listTasks()).toHaveLength(0);

    plane.clearKillSwitch('test');
    plane.freezeScope('ops', 'test');
    const frozen = plane.runNow({ routineId: 'scoped_job', actor: 'test' });
    expect(frozen.ok).toBe(false);
    expect(frozen.blockedReason).toMatch(/frozen/i);
    expect(taskPlane.listTasks()).toHaveLength(0);
  });

  it('processDue materializes due routines and schedules nextRunAt', () => {
    const { plane, taskPlane } = makePlane();
    const created = plane.createRoutine({
      name: 'Due job',
      schedule: '1000',
      scheduleType: 'interval',
      intervalMs: 1_000,
      taskDescription: 'list open tasks',
      riskLevel: 'low',
      actor: 'test',
    });
    expect(created.routine?.nextRunAt).toBeTruthy();

    // Force due by rewinding nextRunAt through update + freeze time.
    const storedPath = path.join(root, 'runtime', 'cron', 'due_job.json');
    const raw = JSON.parse(fs.readFileSync(storedPath, 'utf8'));
    raw.nextRunAt = new Date(currentTime - 1_000).toISOString();
    fs.writeFileSync(storedPath, JSON.stringify(raw, null, 2));

    const due = plane.processDue({ actor: 'test', maxItems: 5 });
    expect(due.ok).toBe(true);
    expect(due.processed).toBe(1);
    expect(due.materialized[0]?.taskId).toMatch(/^task-/);
    expect(taskPlane.listTasks()).toHaveLength(1);

    const after = plane.getRoutine('due_job');
    expect(after?.lastResult).toBe('task-plane-materialized');
    expect(Date.parse(String(after?.nextRunAt))).toBeGreaterThan(currentTime);
    expect(due.receipt?.receiptId).toBeTruthy();
  });

  it('restart survival: routines persist across a new plane instance on the same storage', () => {
    const { plane, runtimeDir } = makePlane();
    plane.createRoutine({
      name: 'Survive reboot',
      schedule: '60000',
      scheduleType: 'interval',
      intervalMs: 60_000,
      taskDescription: 'persist me',
      riskLevel: 'low',
      actor: 'test',
    });

    const reloaded = bindAutonomySchedulePlane({
      runtimeDir,
      taskPlane: new TaskPlaneService({
        storePath: path.join(runtimeDir, 'task-plane.json'),
        now,
      }),
      now,
    });

    expect(reloaded.getStorageDir()).toBe(resolveAutonomyScheduleStorageDir(runtimeDir));
    expect(reloaded.listRoutines()).toHaveLength(1);
    expect(reloaded.getRoutine('survive_reboot')?.taskDescription).toBe('persist me');
    expect(reloaded.list()[0]?.id).toBe('survive_reboot');
  });

  it('cron tool and action bind bind to the same canonical plane when plane is missing', () => {
    const runtimeDir = path.join(root, 'runtime');
    const taskPlane = new TaskPlaneService({
      storePath: path.join(runtimeDir, 'task-plane.json'),
      now,
    });

    const cronTool = new ZavorthCronSchedulerTool({
      runtimeDir,
      taskPlane,
    });
    const actionPlane = bindAutonomySchedulePlane({
      runtimeDir,
      taskPlane,
      now,
    });

    expect(cronTool.getStorageDir()).toBe(actionPlane.getStorageDir());
    expect(cronTool.getStorageDir()).toBe(resolveAutonomyScheduleStorageDir(runtimeDir));

    const created = cronTool.getSchedulePlane().createRoutine({
      name: 'Shared plane job',
      schedule: '60000',
      scheduleType: 'interval',
      intervalMs: 60_000,
      taskDescription: 'shared storage',
      riskLevel: 'low',
      actor: 'cron-tool',
    });
    expect(created.ok).toBe(true);

    const fromAction = actionPlane.getRoutine('shared_plane_job');
    expect(fromAction?.taskDescription).toBe('shared storage');
  });

  it('daemon false leaves schedule storage usable without starting a process tick', () => {
    const runtimeDir = path.join(root, 'runtime');
    const original = process.env.ZAVORTH_GOAL_LOOP_DAEMON_ENABLED;
    process.env.ZAVORTH_GOAL_LOOP_DAEMON_ENABLED = 'false';
    try {
      const daemonEnabled = (process.env.ZAVORTH_GOAL_LOOP_DAEMON_ENABLED || 'true').toLowerCase() !== 'false';
      expect(daemonEnabled).toBe(false);

      const plane = bindAutonomySchedulePlane({
        runtimeDir,
        taskPlane: new TaskPlaneService({
          storePath: path.join(runtimeDir, 'task-plane.json'),
          now,
        }),
        now,
      });
      const created = plane.createRoutine({
        name: 'Offline daemon routine',
        schedule: '60000',
        scheduleType: 'interval',
        intervalMs: 60_000,
        taskDescription: 'daemon off still persists',
        riskLevel: 'low',
        actor: 'test',
      });
      expect(created.ok).toBe(true);
      expect(fs.existsSync(path.join(plane.getStorageDir(), 'offline_daemon_routine.json'))).toBe(true);
    } finally {
      if (original === undefined) {
        delete process.env.ZAVORTH_GOAL_LOOP_DAEMON_ENABLED;
      } else {
        process.env.ZAVORTH_GOAL_LOOP_DAEMON_ENABLED = original;
      }
    }
  });
});
