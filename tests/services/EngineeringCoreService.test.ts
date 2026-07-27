import fs from 'fs';
import os from 'os';
import path from 'path';
import { EngineeringCoreService } from '../../src/services/EngineeringCoreService.js';
import { EngineeringContextService } from '../../src/services/EngineeringContextService.js';
import { EngineeringRunLedgerService } from '../../src/services/EngineeringRunLedgerService.js';
import { EngineeringSessionService } from '../../src/services/EngineeringSessionService.js';
import { RequirementGapService } from '../../src/services/RequirementGapService.js';

describe('EngineeringCoreService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('opens a canonical engineering run and dispatches the task when requirements are clear', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-engineering-core-'));
    tempDirs.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf8');

    const dispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-201' },
        parsed: { command_type: '/task' },
        runtimeUserId: 'web-user',
        sourceUserId: 'web-user',
        tenantId: null,
        tenantContext: null,
      })),
    };

    const service = new EngineeringCoreService({
      contextService: new EngineeringContextService({ defaultWorkspace: root }),
      ledgerService: new EngineeringRunLedgerService({
        ledgerDir: path.join(root, 'data', 'engineering-runs'),
      }),
      sessionService: new EngineeringSessionService({
        experimentalSessionV2: {
          createSession: jest.fn(() => ({
            sessionId: 'engineering-eng-1',
            state: { status: 'IDLE' },
            recording: { enabled: true, lastSavedPath: null },
          })),
          getSession: jest.fn(() => null),
          listRecordings: jest.fn(() => []),
        } as any,
      }),
      requirementGapService: new RequirementGapService({
        sandboxExecutionService: {
          isDockerAvailable: () => true,
          getDockerImageForLanguage: () => 'node:22-bullseye',
        } as any,
      }),
    });

    const run = await service.startRun({
      rawText: 'crie um servidor Express',
      scope: { platform: 'telegram', chatId: 'telegram:chat-1', userId: 'telegram-user' },
      dispatcher: dispatcher as any,
      dispatchContext: {
        platform: 'telegram',
        userId: 'telegram-user',
        chatId: 'telegram:chat-1',
        isGroup: false,
        rawText: 'crie um servidor Express',
        reply: jest.fn(async () => undefined),
        editMessage: jest.fn(async () => undefined),
      } as any,
      autoDispatch: true,
    });

    expect(run.status).toBe('dispatched');
    expect(run.linkedTaskId).toBe('task-201');
    expect(dispatcher.dispatchTaskMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'crie um servidor Express',
        chatId: 'telegram:chat-1',
      }),
    );
  });

  it('negotiates blockers naturally when protected execution requirements are missing', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-engineering-core-blocked-'));
    tempDirs.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf8');

    const service = new EngineeringCoreService({
      contextService: new EngineeringContextService({ defaultWorkspace: root }),
      ledgerService: new EngineeringRunLedgerService({
        ledgerDir: path.join(root, 'data', 'engineering-runs'),
      }),
      requirementGapService: new RequirementGapService({
        sandboxExecutionService: {
          isDockerAvailable: () => false,
          getDockerImageForLanguage: () => 'node:22-bullseye',
        } as any,
      }),
    });

    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'crie um servidor Express',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const handled = await service.maybeHandleSurfaceRequest(ctx as any, null);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Docker'));
  });

  it('proposes, applies and rolls back patches through the canonical selfmod service', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-engineering-core-patch-'));
    tempDirs.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf8');

    const selfModificationCommandService = {
      createPreview: jest.fn(async () => ({
        success: true,
        mode: 'file',
        previewId: 'preview-1',
        relativePath: 'src/app.ts',
        summary: 'Preview ready.',
        diffSummary: 'diff --git a/src/app.ts b/src/app.ts',
      })),
      applyPreview: jest.fn(async () => ({
        success: true,
        mode: 'file',
        previewId: 'preview-1',
        relativePath: 'src/app.ts',
        changeId: 'change-1',
        summary: 'Patch aplicado.',
        diffSummary: 'diff --git a/src/app.ts b/src/app.ts',
      })),
      rollbackChangeSet: jest.fn(async () => ({
        success: true,
        changeId: 'change-1',
        restoredFiles: 1,
        summary: 'Rollback completed.',
      })),
    };

    const service = new EngineeringCoreService({
      contextService: new EngineeringContextService({ defaultWorkspace: root }),
      ledgerService: new EngineeringRunLedgerService({
        ledgerDir: path.join(root, 'data', 'engineering-runs'),
      }),
      requirementGapService: new RequirementGapService({
        sandboxExecutionService: {
          isDockerAvailable: () => true,
          getDockerImageForLanguage: () => 'node:22-bullseye',
        } as any,
      }),
      selfModificationCommandService: selfModificationCommandService as any,
    });

    const run = await service.startRun({
      rawText: 'fix TypeScript error in src/app.ts',
      scope: { platform: 'web', chatId: 'web:engineering', userId: 'web-user' },
    });
    const previewed = await service.proposePatch({
      runId: run.runId,
      filePath: 'src/app.ts',
      instruction: 'corrija o export principal',
      requestedBy: 'web-user',
    });
    const applied = await service.applyPatch(run.runId);
    const rolledBack = await service.rollbackRun(run.runId);

    expect(selfModificationCommandService.createPreview).toHaveBeenCalledWith(
      'src/app.ts',
      'corrija o export principal',
      'web-user',
    );
    expect(previewed.plan.patchProposal).toEqual(expect.objectContaining({
      previewId: 'preview-1',
      status: 'previewed',
      targetFiles: ['src/app.ts'],
    }));
    expect(selfModificationCommandService.applyPreview).toHaveBeenCalledWith('preview-1', 'web-user');
    expect(applied.plan.patchProposal).toEqual(expect.objectContaining({
      changeId: 'change-1',
      status: 'applied',
    }));
    expect(selfModificationCommandService.rollbackChangeSet).toHaveBeenCalledWith('change-1', 'web-user');
    expect(rolledBack.plan.patchProposal).toEqual(expect.objectContaining({
      changeId: 'change-1',
      status: 'rolled_back',
    }));
  });

  it('runs supervised host commands through the Execution Gateway and stores the audit action', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-engineering-core-overlord-'));
    tempDirs.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf8');
    const executionGatewayService = {
      inferCapabilityFromCommand: jest.fn(() => 'host.shell'),
      listActions: jest.fn(() => []),
      execute: jest.fn(async () => ({
        actionId: 'host-action-1',
        runId: 'eng-1',
        requestedBy: 'web-user',
        surface: 'web',
        createdAt: '2026-04-11T00:00:00.000Z',
        updatedAt: '2026-04-11T00:00:01.000Z',
        status: 'completed',
        request: { capability: 'host.shell', command: 'git status' },
        decision: {
          allowed: true,
          requiresApproval: false,
          reason: 'ok',
          capability: 'host.shell',
          profile: 'trusted',
          requiredProfile: 'trusted',
          autonomyLevel: 3,
          requiredAutonomyLevel: 3,
          runtimeTarget: 'host',
          mutating: false,
          blockedReason: null,
        },
        command: 'git status',
        workspace: root,
        stdout: 'ok',
        stderr: null,
        exitCode: 0,
        errorCode: null,
        errorMessage: null,
        rollbackAvailable: false,
        metadata: {},
      })),
    };
    const service = new EngineeringCoreService({
      contextService: new EngineeringContextService({ defaultWorkspace: root }),
      ledgerService: new EngineeringRunLedgerService({
        ledgerDir: path.join(root, 'data', 'engineering-runs'),
      }),
      requirementGapService: new RequirementGapService({
        sandboxExecutionService: {
          isDockerAvailable: () => true,
          getDockerImageForLanguage: () => 'node:22-bullseye',
        } as any,
      }),
      executionGatewayService: executionGatewayService as any,
    });

    const run = await service.startRun({
      rawText: 'veja por que esse build quebrou',
      scope: { platform: 'web', chatId: 'web:engineering', userId: 'web-user' },
    });
    const updated = await service.runCommand({
      runId: run.runId,
      command: 'git status',
      approved: true,
      requestedBy: 'web-user',
    });

    expect(executionGatewayService.inferCapabilityFromCommand).toHaveBeenCalledWith('git status');
    expect(executionGatewayService.execute).toHaveBeenCalledWith(expect.objectContaining({
      runId: run.runId,
      requestedBy: 'web-user',
      surface: 'web',
      profile: 'safe',
      autonomyLevel: 3,
      capability: 'host.shell',
      command: 'git status',
      workspace: root.replace(/\\/g, '/'),
      approved: true,
    }));
    expect(updated.status).toBe('completed');
    expect(updated.hostActions).toHaveLength(1);
    expect(updated.hostActions?.[0].actionId).toBe('host-action-1');
  });

  it('executes a full supervised run loop and stores loop state', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-engineering-core-loop-'));
    tempDirs.push(root);
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'demo', scripts: { build: 'tsc' } }),
      'utf8',
    );
    const executionGatewayService = {
      inferCapabilityFromCommand: jest.fn(() => 'host.shell'),
      listActions: jest.fn(() => []),
      execute: jest.fn(async ({ command }: any) => ({
        actionId: `host-action-${command}`,
        runId: 'eng-1',
        requestedBy: 'web-user',
        surface: 'web',
        createdAt: '2026-04-11T00:00:00.000Z',
        updatedAt: '2026-04-11T00:00:01.000Z',
        status: 'completed',
        request: { capability: 'host.shell', command },
        decision: {
          allowed: true,
          requiresApproval: false,
          reason: 'ok',
          capability: 'host.shell',
          profile: 'trusted',
          requiredProfile: 'trusted',
          autonomyLevel: 3,
          requiredAutonomyLevel: 3,
          runtimeTarget: 'container',
          mutating: true,
          blockedReason: null,
        },
        command,
        workspace: root,
        stdout: 'ok',
        stderr: null,
        exitCode: 0,
        errorCode: null,
        errorMessage: null,
        rollbackAvailable: false,
        metadata: {},
      })),
    };
    const service = new EngineeringCoreService({
      contextService: new EngineeringContextService({ defaultWorkspace: root }),
      ledgerService: new EngineeringRunLedgerService({
        ledgerDir: path.join(root, 'data', 'engineering-runs'),
      }),
      requirementGapService: new RequirementGapService({
        sandboxExecutionService: {
          isDockerAvailable: () => true,
          getDockerImageForLanguage: () => 'node:22-bullseye',
        } as any,
      }),
      executionGatewayService: executionGatewayService as any,
    });

    const run = await service.startRun({
      rawText: 'veja por que esse build quebrou',
      scope: { platform: 'web', chatId: 'web:engineering', userId: 'web-user' },
    });
    const executed = await service.executeRun({
      runId: run.runId,
      approved: true,
      requestedBy: 'web-user',
    });

    expect(executed.status).toBe('completed');
    expect(executed.loop).toEqual(expect.objectContaining({
      status: 'completed',
      commandsExecuted: ['npm run build'],
    }));
    expect(executed.hostActions).toHaveLength(1);
    expect(executionGatewayService.execute).toHaveBeenCalledWith(expect.objectContaining({
      command: 'npm run build',
      profile: 'trusted',
      approved: true,
    }));
  });

  it('opens a natural-first supervised browser run without forcing the repo docker boundary', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-engineering-core-browser-'));
    tempDirs.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf8');

    const service = new EngineeringCoreService({
      contextService: new EngineeringContextService({ defaultWorkspace: root }),
      ledgerService: new EngineeringRunLedgerService({
        ledgerDir: path.join(root, 'data', 'engineering-runs'),
      }),
      requirementGapService: new RequirementGapService({
        sandboxExecutionService: {
          isDockerAvailable: () => false,
          getDockerImageForLanguage: () => 'node:22-bullseye',
        } as any,
      }),
    });

    const run = await service.startRun({
      rawText: 'open the browser at https://example.com',
      scope: { platform: 'telegram', chatId: 'telegram:engineering', userId: 'web-user' },
    });

    expect(run.intent.kind).toBe('system_overlord_operation');
    expect(run.intent.preferredCapability).toBe('browser.control');
    expect(run.requirementGaps).toHaveLength(0);
    expect(run.replySummary).toContain('System Overlord');
  });

  it('executes a natural-first tunnel request through the supervised runtime capability', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-engineering-core-tunnel-'));
    tempDirs.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf8');
    const executionGatewayService = {
      inferCapabilityFromCommand: jest.fn(() => 'host.shell'),
      listActions: jest.fn(() => []),
      execute: jest.fn(async ({ capability, command }: any) => ({
        actionId: `host-action-${capability}`,
        runId: 'eng-1',
        requestedBy: 'web-user',
        surface: 'telegram',
        createdAt: '2026-04-11T00:00:00.000Z',
        updatedAt: '2026-04-11T00:00:01.000Z',
        status: 'completed',
        request: { capability, command },
        decision: {
          allowed: true,
          requiresApproval: false,
          reason: 'ok',
          capability,
          profile: 'dangerous',
          requiredProfile: 'dangerous',
          autonomyLevel: 4,
          requiredAutonomyLevel: 4,
          runtimeTarget: 'host',
          mutating: true,
          blockedReason: null,
        },
        command,
        workspace: root,
        stdout: 'ok',
        stderr: null,
        exitCode: 0,
        errorCode: null,
        errorMessage: null,
        rollbackAvailable: false,
        metadata: {},
      })),
    };
    const service = new EngineeringCoreService({
      contextService: new EngineeringContextService({ defaultWorkspace: root }),
      ledgerService: new EngineeringRunLedgerService({
        ledgerDir: path.join(root, 'data', 'engineering-runs'),
      }),
      requirementGapService: new RequirementGapService({
        sandboxExecutionService: {
          isDockerAvailable: () => false,
          getDockerImageForLanguage: () => 'node:22-bullseye',
        } as any,
      }),
      executionGatewayService: executionGatewayService as any,
    });

    const run = await service.startRun({
      rawText: 'start a tunnel to http://127.0.0.1:3004',
      scope: { platform: 'telegram', chatId: 'telegram:engineering', userId: 'web-user' },
    });
    const executed = await service.executeRun({
      runId: run.runId,
      approved: true,
      requestedBy: 'web-user',
    });

    expect(executed.status).toBe('completed');
    expect(executionGatewayService.execute).toHaveBeenCalledWith(expect.objectContaining({
      capability: 'network.tunnel',
      profile: 'dangerous',
      autonomyLevel: 4,
    }));
    expect(executionGatewayService.execute).toHaveBeenCalledWith(expect.objectContaining({
      command: expect.stringContaining('"targetUrl":"http://127.0.0.1:3004"'),
    }));
  });
});
