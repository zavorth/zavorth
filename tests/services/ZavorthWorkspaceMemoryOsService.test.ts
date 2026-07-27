import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { MemoryEntry } from '../../src/services/MemoryService';
import { ZavorthWorkspaceMemoryOsService } from '../../src/services/ZavorthWorkspaceMemoryOsService';

function createWorkspace(): string {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-checkpoint-29-'));
  fs.mkdirSync(path.join(workspace, 'src'));
  fs.mkdirSync(path.join(workspace, 'tests'));
  fs.writeFileSync(
    path.join(workspace, 'package.json'),
    JSON.stringify({
      type: 'module',
      scripts: {
        build: 'tsc',
        test: 'jest --runInBand',
        'runtime:check': 'tsc --noEmit',
      },
      dependencies: {
        react: '^19.0.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
        jest: '^30.0.0',
      },
    }),
    'utf8',
  );
  fs.writeFileSync(path.join(workspace, 'tsconfig.json'), '{}', 'utf8');
  return workspace;
}

function memoryEntry(input: Partial<MemoryEntry>): MemoryEntry {
  return {
    id: input.id || 1,
    user_id: input.user_id || 'alice',
    key: input.key || 'preferred_language',
    value: input.value || 'English',
    category: input.category || 'preference',
    embedding: null,
    created_at: input.created_at || '2026-04-24T12:00:00.000Z',
    updated_at: input.updated_at || '2026-04-24T12:30:00.000Z',
  };
}

describe('ZavorthWorkspaceMemoryOsService', () => {
  function createService(workspace = createWorkspace()) {
    const preferences = [
      memoryEntry({ key: 'preferred_language', value: 'direct English', category: 'preference' }),
      memoryEntry({ key: 'deploy_token', value: 'token=sk-secret123456789', category: 'preference' }),
    ];
    const memoryService = {
      listAll: jest.fn(async () => preferences),
      forget: jest.fn(async (userId: string, key: string) => key === 'preferred_language'),
      remember: jest.fn(async () => undefined),
    };
    const service = new ZavorthWorkspaceMemoryOsService({
      now: () => new Date('2026-04-24T15:00:00.000Z'),
      memoryService,
      memoryPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          generatedAt: '2026-04-24T15:00:00.000Z',
          summary: {
            persistedMemories: 2,
            relevantMemories: 1,
            replayTasks: 1,
            workflowRuns: 1,
            artifacts: 1,
            workspaceSignals: 1,
            timelineEvents: 1,
            historicalEvents: 0,
            changedFacts: 0,
          },
          memory: { recent: [], relevant: [], categories: [], vectorRecall: true },
          timeline: {
            recent: [
              {
                id: 'timeline-1',
                label: 'Previous task',
                kind: 'memory',
                status: 'current',
                happenedAt: '2026-04-24T14:30:00.000Z',
                category: 'task',
                source: 'task',
                summary: 'Fixed build error.',
              },
            ],
            conflicts: [],
            latestHistoricalAt: null,
          },
          replay: null,
          artifacts: {
            recent: [
              {
                label: 'report.md',
                name: 'report.md',
                kind: 'report',
                summary: 'Final report',
                path: 'artifacts/report.md',
              },
            ],
            kinds: ['report'],
            latestLabel: 'report.md',
            reusableCount: 1,
          },
          workspace: {
            workspace,
            summary: 'Test workspace',
            recentArtifacts: [],
            recentWorkflowRuns: [],
            continuityRecommendations: [],
            workflowRecommendations: [
              { workflow: 'ship', rationale: 'Run runtime:check before build.' },
            ],
          },
          suggestedActions: [],
          narrative: {
            headline: 'Memory ready.',
            operatorSummary: 'Summary.',
          },
        } as any)),
      },
      layeredMemoryService: {
        buildStatus: jest.fn(),
        search: jest.fn(),
        readProcedures: jest.fn(async () => ({
          generatedAt: '2026-04-24T15:00:00.000Z',
          total: 1,
          data: [
            {
              id: 'candidate:wf-1',
              label: 'Build recovery',
              summary: 'When build fails, run runtime:check first.',
              steps: ['npm run runtime:check', 'npm run build'],
              memoryLayer: 'procedural',
              source: 'learning-plane',
              confidence: 0.88,
              lastValidatedAt: '2026-04-24T14:00:00.000Z',
            },
          ],
        })),
      },
      learningPlaneService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-24T15:00:00.000Z',
          summary: {
            total: 1,
            pending: 1,
            approved: 0,
            rejected: 0,
            promoted: 0,
            published: 0,
            quarantined: 0,
            highConfidence: 1,
          },
          candidates: [],
          narrative: { headline: 'Learning.', operatorSummary: '1 candidate.' },
        })),
      },
      taskOperatingSystemService: {
        buildSnapshot: jest.fn(async () => ({
          generatedAt: '2026-04-24T15:00:00.000Z',
          stage: '27',
          surface: 'task-os',
          taskLedger: {
            generatedAt: '2026-04-24T15:00:00.000Z',
            stage: '27',
            surface: 'task-ledger',
            summary: { total: 1 },
            selected: null,
            tasks: [
              {
                taskId: 'task-29',
                shortId: 'task-29',
                workspace,
                executor: 'codex',
                state: { state: 'completed' },
                resume: { available: false, command: 'zavorth tasks resume task-29' },
                retry: { available: true, command: 'zavorth tasks retry task-29' },
                relation: { artifacts: ['artifact://report'] },
                artifacts: { total: 1, command: 'zavorth artifacts task task-29' },
                summary: 'Task completed.',
              },
            ],
          },
          permissionLedger: { entries: [] },
          summary: {},
          contracts: {},
          commands: {},
          narrative: {},
        } as any)),
      },
    });
    return { service, workspace, memoryService };
  }

  it('builds a reviewable workspace memory snapshot with commands, preferences and redaction', async () => {
    const { service } = createService();

    const snapshot = await service.buildReview({ userId: 'alice' });

    expect(snapshot.phase).toBe('workspace-memory-os');
    expect(snapshot.surface).toBe('workspace-memory-os');
    expect(snapshot.workspaceProfile.stack).toEqual(expect.arrayContaining(['typescript', 'react', 'jest']));
    expect(snapshot.workspaceProfile.buildCommands).toContain('npm run build');
    expect(snapshot.workspaceProfile.testCommands).toEqual(expect.arrayContaining(['npm run test', 'npm run runtime:check']));
    expect(snapshot.preferenceLedger.total).toBe(2);
    expect(JSON.stringify(snapshot.review.entries)).not.toContain('sk-secret123456789');
    expect(snapshot.contracts.secretsRedactedByDefault).toBe(true);
    expect(snapshot.contracts.followUpsResolveReferences).toBe(true);
  });

  it('resolves short follow-ups to the right task, artifact and workspace', async () => {
    const { service, workspace } = createService();

    const resume = await service.resolveFollowUp('continue', { userId: 'alice' });
    const resend = await service.resolveFollowUp('send it again', { userId: 'alice' });
    const sameFolder = await service.resolveFollowUp('do it in the same folder', { userId: 'alice' });

    expect(resume.intent).toBe('continue_task');
    expect(resume.target.taskId).toBe('task-29');
    expect(resume.target.nextCommand).toBe('zavorth tasks retry task-29');
    expect(resend.intent).toBe('redeliver_artifact');
    expect(resend.target.nextCommand).toBe('zavorth artifacts task latest');
    expect(sameFolder.intent).toBe('same_workspace');
    expect(sameFolder.target.workspace).toBe(workspace);
  });

  it('lets the user forget or correct long-term memories', async () => {
    const { service, memoryService } = createService();

    const forgot = await service.executeAction({
      action: 'forget',
      key: 'preferred_language',
      userId: 'alice',
    });
    const corrected = await service.executeAction({
      action: 'correct',
      key: 'preferred_language',
      value: 'reply in direct English',
      userId: 'alice',
    });
    const blocked = await service.executeAction({
      action: 'correct',
      key: 'api_key',
      value: 'token=sk-secret123456789',
      userId: 'alice',
    });

    expect(forgot.ok).toBe(true);
    expect(memoryService.forget).toHaveBeenCalledWith('alice', 'preferred_language');
    expect(corrected.ok).toBe(true);
    expect(memoryService.remember).toHaveBeenCalledWith('alice', 'preferred_language', 'reply in direct English', 'preference');
    expect(blocked.ok).toBe(false);
    expect(blocked.summary).toContain('secret');
  });
});
