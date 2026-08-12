import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  GatewaySessionLedgerService,
} from '../../src/services/GatewaySessionLedgerService.js';

describe('GatewaySessionLedgerService', () => {
  it('persists transcript entries and the latest minimal snapshot per session', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-session-ledger-'));
    const service = new GatewaySessionLedgerService({
      rootDir: tempDir,
      now: () => new Date('2026-04-12T15:00:00.000Z'),
    });

    service.appendMessage(
      {
        platform: 'web',
        chatId: 'web:session-1',
        sessionId: 'session-1',
        runtimeUserId: 'runtime-user-1',
        sourceUserId: 'session-1',
      },
      {
        id: 'msg-1',
        role: 'user',
        content: 'abrir runtime',
        createdAt: '2026-04-12T15:00:00.000Z',
        taskId: 'task-1',
        kind: 'input',
        surface: 'web',
      },
    );

    service.saveSnapshot(
      {
        platform: 'web',
        chatId: 'web:session-1',
        sessionId: 'session-1',
        runtimeUserId: 'runtime-user-1',
        sourceUserId: 'session-1',
      },
      {
        generatedAt: '2026-04-12T15:01:00.000Z',
        sessionId: 'session-1',
        chatId: 'web:session-1',
        platform: 'web',
        runtimeUserId: 'runtime-user-1',
        sourceUserId: 'session-1',
        headline: 'Runtime pronto.',
        operatorSummary: 'Sessao pronta para retomar.',
        latestTaskId: 'task-1',
        workflowRunIds: ['wf-1'],
        filesTouched: ['C:/repo/src/runtime.ts'],
        toolRunCount: 1,
        artifactCount: 1,
        pendingPermissions: 0,
        transcriptCount: 1,
      },
    );

    expect(
      service.readTranscriptSync({
        platform: 'web',
        chatId: 'web:session-1',
        sessionId: 'session-1',
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'msg-1',
          content: 'abrir runtime',
        }),
      ]),
    );
    expect(
      service.readSnapshotSync({
        platform: 'web',
        chatId: 'web:session-1',
        sessionId: 'session-1',
      }),
    ).toEqual(
      expect.objectContaining({
        headline: 'Runtime pronto.',
        latestTaskId: 'task-1',
        filesTouched: ['C:/repo/src/runtime.ts'],
      }),
    );

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('preserves explicit session metadata across later snapshot writes', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-session-ledger-meta-'));
    const service = new GatewaySessionLedgerService({
      rootDir: tempDir,
      now: () => new Date('2026-04-12T16:00:00.000Z'),
    });

    const target = {
      platform: 'web',
      chatId: 'web:session-2',
      sessionId: 'session-2',
      runtimeUserId: 'runtime-user-2',
      sourceUserId: 'session-2',
    };

    service.saveSessionMetadata(target, {
      label: 'Gateway principal',
      workspaceHint: 'C:/repo',
      pinned: true,
      modelProfile: 'gpt-5.4',
    });
    service.saveSnapshot(target, {
      generatedAt: '2026-04-12T16:01:00.000Z',
      sessionId: 'session-2',
      chatId: 'web:session-2',
      platform: 'web',
      runtimeUserId: 'runtime-user-2',
      sourceUserId: 'session-2',
      headline: 'Gateway ready.',
      operatorSummary: null,
      latestTaskId: 'task-2',
      workflowRunIds: [],
      filesTouched: [],
      toolRunCount: 0,
      artifactCount: 0,
      pendingPermissions: 0,
      transcriptCount: 0,
    });

    expect(service.readSessionMetadataSync(target)).toEqual(
      expect.objectContaining({
        label: 'Gateway principal',
        workspaceHint: 'C:/repo',
        pinned: true,
        modelProfile: 'gpt-5.4',
      }),
    );
    expect(service.readSnapshotSync(target)).toEqual(
      expect.objectContaining({
        label: 'Gateway principal',
        workspaceHint: 'C:/repo',
        pinned: true,
        modelProfile: 'gpt-5.4',
      }),
    );

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
