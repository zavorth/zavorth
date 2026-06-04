import fs from 'fs';
import os from 'os';
import path from 'path';
import { SkillCuratorPlaneService } from '../../src/skills/SkillCuratorPlaneService.js';

type FakeTelemetryRow = {
  skill_id: string;
  use_count: number;
  last_executed_at: string | null;
  status: 'active' | 'archived';
  pinned: number;
};

class FakeDatabase {
  public readonly rows = new Map<string, FakeTelemetryRow>();

  public all<T>(): T[] {
    return Array.from(this.rows.values()) as T[];
  }

  public run(_sql: string, params: unknown[] = []): void {
    const skillId = String(params[0] || '');
    if (!skillId || this.rows.has(skillId)) return;
    this.rows.set(skillId, {
      skill_id: skillId,
      use_count: 0,
      last_executed_at: String(params[1] || new Date().toISOString()),
      status: 'active',
      pinned: 0,
    });
  }
}

describe('SkillCuratorPlaneService', () => {
  let tempDir: string;
  let db: FakeDatabase;
  let archiveCalls: string[];
  let restored: string[];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-curator-plane-'));
    db = new FakeDatabase();
    archiveCalls = [];
    restored = [];
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('seeds automatic scheduling before the first background curator run', async () => {
    const service = createService({
      db,
      now: '2026-05-31T10:00:00.000Z',
      skills: [skill('alpha-build')],
      tempDir,
      intervalHours: 1,
      minIdleHours: 0,
    });

    const result = await service.maybeRunCurator({ idleForSeconds: 999 });
    const status = await service.status();

    expect(result).toEqual({ ran: false, reason: 'seeded' });
    expect(status.runCount).toBe(0);
    expect(status.lastRunAt).toBe('2026-05-31T10:00:00.000Z');
    expect(status.nextRunAt).toBe('2026-05-31T11:00:00.000Z');
  });

  it('writes a dry-run report without archiving or mutating lifecycle state', async () => {
    db.rows.set('alpha-old', {
      skill_id: 'alpha-old',
      use_count: 1,
      last_executed_at: '2025-12-01T00:00:00.000Z',
      status: 'active',
      pinned: 0,
    });
    const service = createService({
      db,
      now: '2026-05-31T10:00:00.000Z',
      skills: [skill('alpha-old')],
      tempDir,
      staleAfterDays: 30,
      archiveAfterDays: 90,
    });

    const report = await service.runCuratorReview({ dryRun: true, reason: 'test' });
    const state = JSON.parse(fs.readFileSync(path.join(tempDir, 'state.json'), 'utf8')) as {
      skillStates: Record<string, unknown>;
      lastReportPath: string;
    };

    expect(report.transitions).toEqual([
      expect.objectContaining({ skillId: 'alpha-old', to: 'archived', dryRun: true }),
    ]);
    expect(archiveCalls).toEqual([]);
    expect(state.skillStates).toEqual({});
    expect(fs.existsSync(state.lastReportPath)).toBe(true);
  });

  it('marks stale skills and archives old unpinned managed skills', async () => {
    db.rows.set('alpha-stale', {
      skill_id: 'alpha-stale',
      use_count: 2,
      last_executed_at: '2026-04-01T00:00:00.000Z',
      status: 'active',
      pinned: 0,
    });
    db.rows.set('alpha-archive', {
      skill_id: 'alpha-archive',
      use_count: 2,
      last_executed_at: '2025-12-01T00:00:00.000Z',
      status: 'active',
      pinned: 0,
    });
    db.rows.set('alpha-pinned', {
      skill_id: 'alpha-pinned',
      use_count: 0,
      last_executed_at: '2025-12-01T00:00:00.000Z',
      status: 'active',
      pinned: 1,
    });
    const service = createService({
      db,
      now: '2026-05-31T10:00:00.000Z',
      skills: [skill('alpha-stale'), skill('alpha-archive'), skill('alpha-pinned')],
      tempDir,
      staleAfterDays: 30,
      archiveAfterDays: 90,
    });

    const report = await service.runCuratorReview({ triggeredBy: 'test' });
    const status = await service.status();

    expect(report.transitions).toEqual(expect.arrayContaining([
      expect.objectContaining({ skillId: 'alpha-stale', to: 'stale', dryRun: false }),
      expect.objectContaining({ skillId: 'alpha-archive', to: 'archived', dryRun: false }),
    ]));
    expect(archiveCalls).toEqual(['alpha-archive']);
    expect(status.stats.stale).toBe(1);
    expect(status.stats.archived).toBe(1);
    expect(status.pinned).toEqual(['alpha-pinned']);
  });

  it('keeps scheduled developer curation as a quiet dry-run instead of interrupting for approval', async () => {
    db.rows.set('alpha-archive', {
      skill_id: 'alpha-archive',
      use_count: 2,
      last_executed_at: '2025-12-01T00:00:00.000Z',
      status: 'active',
      pinned: 0,
    });
    const seed = createService({
      db,
      now: '2026-05-31T10:00:00.000Z',
      skills: [skill('alpha-archive')],
      tempDir,
      intervalHours: 1,
      minIdleHours: 0,
      staleAfterDays: 30,
      archiveAfterDays: 90,
      profileId: 'developer',
      improvementPolicy: improvementPolicy({
        mode: 'quiet-staging',
        silent: ['telemetry', 'ranking', 'metadata', 'candidate', 'staging_diff', 'sandbox_validation'],
        notify: ['low_risk_archive'],
      }),
    });
    await seed.maybeRunCurator({ idleForSeconds: 999 });
    const service = createService({
      db,
      now: '2026-05-31T12:00:00.000Z',
      skills: [skill('alpha-archive')],
      tempDir,
      intervalHours: 1,
      minIdleHours: 0,
      staleAfterDays: 30,
      archiveAfterDays: 90,
      profileId: 'developer',
      improvementPolicy: improvementPolicy({
        mode: 'quiet-staging',
        silent: ['telemetry', 'ranking', 'metadata', 'candidate', 'staging_diff', 'sandbox_validation'],
        notify: ['low_risk_archive'],
      }),
    });

    const result = await service.maybeRunCurator({ idleForSeconds: 999 });

    expect(result.ran).toBe(true);
    expect(result.report?.dryRun).toBe(true);
    expect(result.report?.autonomy).toEqual(expect.objectContaining({
      profileId: 'developer',
      scheduledRunMode: 'silent-dry-run',
      lowRiskArchiveAllowed: false,
      approvalInterruptsCreated: 0,
    }));
    expect(archiveCalls).toEqual([]);
  });

  it('lets personal scheduled curation apply reversible low-risk cleanup silently', async () => {
    db.rows.set('alpha-archive', {
      skill_id: 'alpha-archive',
      use_count: 2,
      last_executed_at: '2025-12-01T00:00:00.000Z',
      status: 'active',
      pinned: 0,
    });
    const policy = improvementPolicy({
      mode: 'quiet-curation',
      silent: ['telemetry', 'ranking', 'metadata', 'candidate', 'draft_skill', 'staging_diff', 'sandbox_validation', 'low_risk_archive'],
      notify: ['apply'],
      interruptMode: 'never-for-low-risk',
    });
    const seed = createService({
      db,
      now: '2026-05-31T10:00:00.000Z',
      skills: [skill('alpha-archive')],
      tempDir,
      intervalHours: 1,
      minIdleHours: 0,
      staleAfterDays: 30,
      archiveAfterDays: 90,
      profileId: 'personal',
      improvementPolicy: policy,
    });
    await seed.maybeRunCurator({ idleForSeconds: 999 });
    const service = createService({
      db,
      now: '2026-05-31T12:00:00.000Z',
      skills: [skill('alpha-archive')],
      tempDir,
      intervalHours: 1,
      minIdleHours: 0,
      staleAfterDays: 30,
      archiveAfterDays: 90,
      profileId: 'personal',
      improvementPolicy: policy,
    });

    const result = await service.maybeRunCurator({ idleForSeconds: 999 });

    expect(result.ran).toBe(true);
    expect(result.report?.dryRun).toBe(false);
    expect(result.report?.autonomy).toEqual(expect.objectContaining({
      profileId: 'personal',
      scheduledRunMode: 'silent-apply-reversible',
      lowRiskArchiveAllowed: true,
      approvalInterruptsCreated: 0,
      interruptMode: 'never-for-low-risk',
    }));
    expect(archiveCalls).toEqual(['alpha-archive']);
  });

  it('supports pause, resume, pin and restore operations through the plane', async () => {
    const service = createService({
      db,
      now: '2026-05-31T10:00:00.000Z',
      skills: [skill('alpha-build')],
      tempDir,
    });

    await service.pause();
    expect(await service.maybeRunCurator({ idleForSeconds: 999 })).toEqual({ ran: false, reason: 'paused' });

    await service.resume();
    await service.togglePin('alpha-build', true);
    await service.restoreSkill('alpha-build');
    const status = await service.status();

    expect(restored).toEqual(['alpha-build']);
    expect(status.pinned).toEqual(['alpha-build']);
    expect(status.skills.find((entry) => entry.id === 'alpha-build')?.state).toBe('active');
  });

  it('can add an advisory LLM review on top of deterministic live-loop proposals', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn().mockReturnValue(true),
      chatDetailed: jest.fn().mockResolvedValue({
        providerName: 'fake-llm',
        modelName: 'curator-reviewer',
        response: {
          content: JSON.stringify({
            summary: 'Consolidate alpha skills after checking overlap.',
            recommendations: [
              {
                title: 'Create alpha umbrella',
                rationale: 'Several alpha skills share intent.',
                affectedSkillIds: ['alpha-one', 'alpha-two'],
                priority: 'high',
              },
            ],
            risks: ['Keep archive actions approval-gated.'],
            notes: ['No direct mutation requested.'],
          }),
          toolCalls: [],
          finishReason: 'stop',
        },
        route: {},
      }),
    };
    const service = createService({
      db,
      now: '2026-05-31T10:00:00.000Z',
      skills: [skill('alpha-one'), skill('alpha-two')],
      tempDir,
      llmRuntime,
      llmReviewEnabled: true,
    });

    const report = await service.runCuratorReview({ dryRun: true, llmReview: true });

    expect(llmRuntime.chatDetailed).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ role: 'system' }),
      expect.objectContaining({ role: 'user' }),
    ]), undefined, expect.objectContaining({
      allowFallback: true,
      telemetry: { surface: 'skill-curator-llm-review' },
    }));
    expect(report.llmReview).toEqual(expect.objectContaining({
      status: 'completed',
      providerName: 'fake-llm',
      modelName: 'curator-reviewer',
      summary: 'Consolidate alpha skills after checking overlap.',
    }));
    expect(report.llmReview.recommendations).toEqual([
      expect.objectContaining({
        title: 'Create alpha umbrella',
        priority: 'high',
      }),
    ]);
  });

  function createService(options: {
    db: FakeDatabase;
    now: string;
    skills: Array<Record<string, unknown>>;
    tempDir: string;
    intervalHours?: number;
    minIdleHours?: number;
    staleAfterDays?: number;
    archiveAfterDays?: number;
    llmRuntime?: any;
    llmReviewEnabled?: boolean;
    profileId?: string;
    improvementPolicy?: any;
  }) {
    return new SkillCuratorPlaneService({
      database: options.db as any,
      stateFilePath: path.join(options.tempDir, 'state.json'),
      reportsDir: path.join(options.tempDir, 'reports'),
      now: () => new Date(options.now),
      intervalHours: options.intervalHours ?? 168,
      minIdleHours: options.minIdleHours ?? 2,
      staleAfterDays: options.staleAfterDays ?? 30,
      archiveAfterDays: options.archiveAfterDays ?? 90,
      llmRuntime: options.llmRuntime ?? null,
      llmReviewEnabled: options.llmReviewEnabled ?? false,
      profileId: options.profileId,
      improvementPolicy: options.improvementPolicy,
      catalogService: {
        listEntries: () => options.skills as any,
      },
      curationService: {
        archiveSkill: async (skillId: string) => {
          archiveCalls.push(skillId);
          const row = options.db.rows.get(skillId);
          if (row) row.status = 'archived';
        },
        restoreSkill: async (skillId: string) => {
          restored.push(skillId);
          const row = options.db.rows.get(skillId) || {
            skill_id: skillId,
            use_count: 0,
            last_executed_at: options.now,
            status: 'active' as const,
            pinned: 0,
          };
          row.status = 'active';
          options.db.rows.set(skillId, row);
        },
        togglePin: async (skillId: string, pinned: boolean) => {
          const row = options.db.rows.get(skillId) || {
            skill_id: skillId,
            use_count: 0,
            last_executed_at: options.now,
            status: 'active' as const,
            pinned: 0,
          };
          row.pinned = pinned ? 1 : 0;
          options.db.rows.set(skillId, row);
        },
        listArchivedSkills: async () => Array.from(options.db.rows.values())
          .filter((row) => row.status === 'archived')
          .map((row) => ({
            skillId: row.skill_id,
            archivePath: path.join(options.tempDir, `${row.skill_id}.zip`),
            archivedAt: options.now,
            sizeBytes: 1,
            originalDirPath: null,
            sourceId: 'test',
          })),
      },
    });
  }

  function skill(name: string): Record<string, unknown> {
    return {
      id: `skill:${name}`,
      name,
      description: `${name} skill`,
      sourceId: 'agent-created',
      imported: true,
      dirPath: path.join(tempDir, name),
    };
  }

  function improvementPolicy(overrides: Record<string, unknown> = {}) {
    return {
      mode: 'quiet-staging',
      silent: ['telemetry', 'ranking', 'metadata', 'candidate', 'staging_diff', 'sandbox_validation'],
      notify: ['draft_skill', 'low_risk_archive'],
      requireApproval: ['apply', 'policy', 'provider', 'channel', 'secret', 'external_send', 'host_mutation'],
      maxSilentRisk: 'low',
      interruptMode: 'daily-digest',
      ...overrides,
    };
  }
});
