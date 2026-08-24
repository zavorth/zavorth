import fs from 'fs';
import os from 'os';
import path from 'path';
import { SkillCuratorPlaneService } from '../../src/skills/SkillCuratorPlaneService.js';
import { buildRuntimePathConfig } from '../../src/config/sections/runtimePathConfig.js';

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

describe('14-day skill decay tuning', () => {
  let tempDir: string;
  let db: FakeDatabase;
  let archiveCalls: string[];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-decay-'));
    db = new FakeDatabase();
    archiveCalls = [];
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('exposes a 14-day archive default and a 7-day stale default in runtime config', () => {
    const config = buildRuntimePathConfig(process.cwd(), path.join(os.tmpdir(), 'tunnel-fallback.json'));
    expect(config.skillsCurationArchiveAfterDays).toBe(14);
    expect(config.skillsCuratorArchiveAfterDays).toBe(14);
    expect(config.skillsCuratorStaleAfterDays).toBe(7);
  });

  it('proposes archiving a 15-day idle temporary skill via the dry-run report without mutating anything', async () => {
    db.rows.set('temp-report-gen', {
      skill_id: 'temp-report-gen',
      use_count: 0,
      last_executed_at: '2026-05-10T00:00:00.000Z',
      status: 'active',
      pinned: 0,
    });
    const service = createService({
      now: '2026-05-25T10:00:00.000Z',
      skills: [managedSkill('temp-report-gen')],
    });

    const report = await service.runCuratorReview({ dryRun: true, reason: 'fourteen-day-decay-review' });
    const state = JSON.parse(fs.readFileSync(path.join(tempDir, 'state.json'), 'utf8')) as {
      skillStates: Record<string, unknown>;
      lastReportPath: string;
    };

    expect(report.config.archiveAfterDays).toBe(14);
    expect(report.dryRun).toBe(true);
    expect(report.transitions).toEqual([
      expect.objectContaining({ skillId: 'temp-report-gen', to: 'archived', dryRun: true }),
    ]);
    expect(archiveCalls).toEqual([]);
    expect(state.skillStates).toEqual({});
    expect(fs.existsSync(state.lastReportPath)).toBe(true);
  });

  it('keeps pinned and native skills outside the 14-day decay window', async () => {
    db.rows.set('operator-pinned', {
      skill_id: 'operator-pinned',
      use_count: 0,
      last_executed_at: '2025-11-01T00:00:00.000Z',
      status: 'active',
      pinned: 1,
    });
    db.rows.set('zavorth-native-core', {
      skill_id: 'zavorth-native-core',
      use_count: 0,
      last_executed_at: '2025-11-01T00:00:00.000Z',
      status: 'active',
      pinned: 0,
    });
    const service = createService({
      now: '2026-05-25T10:00:00.000Z',
      skills: [
        managedSkill('operator-pinned'),
        {
          id: 'skill:zavorth-native-core',
          name: 'zavorth-native-core',
          description: 'native core skill',
          sourceId: 'zavorth-native',
          imported: false,
          dirPath: path.join(tempDir, 'zavorth-native-core'),
        },
      ],
    });

    const report = await service.runCuratorReview({ dryRun: true, reason: 'fourteen-day-decay-review' });

    expect(report.transitions).toEqual([]);
    expect(archiveCalls).toEqual([]);
  });

  function createService(options: {
    now: string;
    skills: Array<Record<string, unknown>>;
  }): SkillCuratorPlaneService {
    return new SkillCuratorPlaneService({
      database: db as never,
      stateFilePath: path.join(tempDir, 'state.json'),
      reportsDir: path.join(tempDir, 'reports'),
      now: () => new Date(options.now),
      intervalHours: 168,
      minIdleHours: 2,
      llmRuntime: null,
      llmReviewEnabled: false,
      proposalReviewer: null,
      catalogService: {
        listEntries: () => options.skills as never[],
      },
      curationService: {
        archiveSkill: async (skillId: string) => {
          archiveCalls.push(skillId);
          const row = db.rows.get(skillId);
          if (row) row.status = 'archived';
        },
        restoreSkill: async () => undefined,
        togglePin: async () => undefined,
        listArchivedSkills: async () => [],
      },
    });
  }

  function managedSkill(name: string): Record<string, unknown> {
    return {
      id: `skill:${name}`,
      name,
      description: `${name} skill`,
      sourceId: 'agent-created',
      imported: true,
      dirPath: path.join(tempDir, name),
    };
  }
});
