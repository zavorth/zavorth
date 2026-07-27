import fs from 'fs';
import path from 'path';
import { config } from '../../src/config/index.js';
import { ZavorthMutationPlaneService } from '../../src/services/ZavorthMutationPlaneService.js';
import { CompanionWorkspaceOptimizerService } from '../../src/services/CompanionWorkspaceOptimizerService.js';

describe('CompanionWorkspaceOptimizerService', () => {
  let testRoot = '';

  beforeEach(() => {
    fs.mkdirSync(path.join(config.projectRoot, 'tmp'), { recursive: true });
    testRoot = fs.mkdtempSync(path.join(config.projectRoot, 'tmp', 'jest-workspace-optimizer-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(testRoot, { recursive: true, force: true });
    } catch {
      // Windows can briefly hold handles on fresh settings files during Jest shutdown.
    }
  });

  it('builds a workspace load profile and applies an approved preset exactly as planned', async () => {
    const workspaceRoot = path.join(testRoot, 'workspace-a');
    fs.mkdirSync(path.join(workspaceRoot, 'data', 'runtime'), { recursive: true });
    fs.mkdirSync(path.join(workspaceRoot, 'dist'), { recursive: true });
    fs.mkdirSync(path.join(workspaceRoot, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, 'package.json'), JSON.stringify({
      name: 'workspace-a',
      scripts: { build: 'npm run build' },
    }, null, 2));

    const mutationPlane = new ZavorthMutationPlaneService({
      plansDir: path.join(testRoot, 'mutation-plans'),
    });
    const trustDecision = {
      evaluate: jest.fn()
        .mockResolvedValueOnce({
          generatedAt: '2026-04-14T20:00:00.000Z',
          decision: 'requires_approval',
          ok: false,
          reason: 'Workspace settings exigem approval.',
          permission: {
            permission_id: 'perm-workspace-1',
          },
          profile: 'core',
          capabilityId: null,
          recommendedScope: 'host',
        })
        .mockResolvedValueOnce({
          generatedAt: '2026-04-14T20:01:00.000Z',
          decision: 'allowed',
          ok: true,
          reason: 'Approval host found for the plan.',
          permission: {
            permission_id: 'perm-workspace-1',
          },
          profile: 'core',
          capabilityId: null,
          recommendedScope: 'host',
        }),
    };
    const service = new CompanionWorkspaceOptimizerService({
      stateFilePath: path.join(testRoot, 'workspace-load-profiles.json'),
      mutationPlane,
      trustDecision: trustDecision as any,
      workspaceProfileService: {
        getProfile: jest.fn(async () => ({
          workspace: workspaceRoot,
          workspace_name: 'workspace-a',
          slug: 'workspace-a',
          detected_stacks: ['nodejs'],
          frameworks: ['react'],
          languages: ['typescript'],
          package_manager: 'npm',
          scripts: { build: 'npm run build' },
          important_paths: [],
          instruction_file: null,
          instruction_sources: ['ZAVORTH.md'],
          instruction_summary: 'Workspace focado no runtime Zavorth.',
          instruction_notes: ['Avoid watchers in data/runtime.'],
          skill_directories: ['skills'],
          workspace_hooks: [],
          workspace_commands: [],
          preferred_executors: {
            code_editing: 'codex',
            code_review: 'external_executor',
            research: 'aistudio',
            design: 'stitch',
            automation: 'zavorthBridge',
          },
          summary: 'Workspace Zavorth.',
          last_refreshed: '2026-04-14T20:00:00.000Z',
        })),
      } as any,
    });

    const profile = await service.buildLoadProfile({ workspaceHint: workspaceRoot });
    expect(profile.pressure).toBe('moderate');
    expect(profile.noisyPaths).toEqual(expect.arrayContaining([
      'data/runtime',
      'dist',
      'node_modules',
    ]));

    const preview = await service.previewOptimization({
      presetId: 'zavorthBridge',
      workspaceHint: workspaceRoot,
      requestedBy: 'tester',
      sourceSurface: 'telegram',
    });
    expect(preview.waitingApproval).toBe(true);
    expect(preview.mutationPlan.approval.permissionId).toBe('perm-workspace-1');
    expect(preview.changedKeys).toEqual(expect.arrayContaining([
      'git.autoRepositoryDetection',
      'files.watcherExclude',
      'search.exclude',
    ]));

    const applied = await service.applyOptimization({
      planId: preview.mutationPlan.id,
      requestedBy: 'tester',
      sourceSurface: 'telegram',
    });
    const settingsFilePath = path.join(workspaceRoot, '.vscode', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8')) as Record<string, unknown>;

    expect(applied.applied).toBe(true);
    expect(applied.mutationPlan.status).toBe('applied');
    expect(settings['git.autoRepositoryDetection']).toBe('openEditors');
    expect(settings['git.autorefresh']).toBe(false);
    expect(settings['files.watcherExclude']).toEqual(expect.objectContaining({
      '**/data/runtime/**': true,
      '**/node_modules/**': true,
    }));
    expect(trustDecision.evaluate).toHaveBeenCalledTimes(2);
  });
});
