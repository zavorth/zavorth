import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthHandoffPreviewEngine } from '../../src/services/ZavorthHandoffPreviewEngine';
import { ZavorthMnemosCompilerService } from '../../src/services/ZavorthMnemosCompilerService';
import type { WebRealtimeEvent } from '../../src/services/WebRealtimeService';

describe('ZavorthHandoffPreviewEngine', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('correctly compiles markdown handoff envelope consolidating event logs and wiki baselines', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-handoff-engine-'));
    tempDirs.push(tempDir);

    // Setup active events using the compiler
    const compiler = new ZavorthMnemosCompilerService();
    const sessionId = 'session-123';

    // 1. Tool execution event
    const toolEvent: WebRealtimeEvent = {
      id: 'tool-evt-1',
      type: 'tool',
      createdAt: '2026-05-31T12:00:00.000Z',
      payload: {
        runId: 'tool-run-1',
        taskId: 'task-1',
        toolName: 'WorkspaceEditTool',
        status: 'completed',
        filesTouched: ['src/services/UserService.ts', 'tests/UserService.test.ts'],
      },
    };
    compiler.ingestEvent(tempDir, sessionId, toolEvent);

    // 2. Failed tool run
    const failedToolEvent: WebRealtimeEvent = {
      id: 'tool-evt-2',
      type: 'tool',
      createdAt: '2026-05-31T12:01:00.000Z',
      payload: {
        runId: 'tool-run-2',
        taskId: 'task-1',
        toolName: 'TerminalCommandTool',
        status: 'failed',
        filesTouched: [],
      },
    };
    compiler.ingestEvent(tempDir, sessionId, failedToolEvent);

    // 3. Approved permission event
    const permEvent: WebRealtimeEvent = {
      id: 'perm-evt-1',
      type: 'permission',
      createdAt: '2026-05-31T12:02:00.000Z',
      payload: {
        permission_id: 'perm-1',
        task_id: 'task-1',
        kind: 'write_file',
        scope: 'src/services/',
        status: 'approved',
      },
    };
    compiler.ingestEvent(tempDir, sessionId, permEvent);

    // 4. Verbatim User message
    const userMessage: WebRealtimeEvent = {
      id: 'msg-evt-1',
      type: 'message',
      createdAt: '2026-05-31T12:03:00.000Z',
      payload: {
        id: 'msg-1',
        role: 'user',
        content: 'Compile the latest changes and use api_key: sk-topsecret123',
      },
    };
    compiler.ingestEvent(tempDir, sessionId, userMessage);

    // Setup active architecture baseline decisions
    const wikiDir = path.join(tempDir, '.zavorth', 'wiki');
    fs.mkdirSync(wikiDir, { recursive: true });
    fs.writeFileSync(
      path.join(wikiDir, 'architecture.md'),
      `---
title: Architecture
---
## Purpose
Decisions purpose
## Decisions
? Keep identity, governance, memory, and approval logic Zavorth-native.
? Treat external providers, channels, sandboxes, and agents as capabilities.
## Open Questions
? None
`,
      'utf8',
    );

    const engine = new ZavorthHandoffPreviewEngine({
      now: () => new Date('2026-05-31T12:05:00.000Z'),
      projectRoot: tempDir,
    });

    const snapshot = engine.buildSnapshot({
      sessionId,
      workspace: tempDir,
      activeMandate: 'Refactor UserService logic',
      nextPrescribedAction: 'Run UserService unit tests',
    });

    expect(snapshot).toBeDefined();
    expect(snapshot.status).toBe('preview-ready');
    expect(snapshot.sessionId).toBe(sessionId);

    // Verify sections mapping
    const mandateSec = snapshot.sections.find((s) => s.id === 'active-mandate');
    expect(mandateSec?.items[0]).toBe('Refactor UserService logic');

    const decisionsSec = snapshot.sections.find((s) => s.id === 'current-architecture-decisions');
    expect(decisionsSec?.items).toContain('Keep identity, governance, memory, and approval logic Zavorth-native.');

    const modifiedSec = snapshot.sections.find((s) => s.id === 'modified-paths');
    expect(modifiedSec?.items).toContain('src/services/UserService.ts');
    expect(modifiedSec?.items).toContain('tests/UserService.test.ts');

    const failedSec = snapshot.sections.find((s) => s.id === 'tool-failure-log');
    expect(failedSec?.items[0]).toContain('TerminalCommandTool');

    const approvalsSec = snapshot.sections.find((s) => s.id === 'security-approvals-granted');
    expect(approvalsSec?.items[0]).toContain('src/services/');

    const userSec = snapshot.sections.find((s) => s.id === 'verbatim-user-directives');
    // Verify secret redaction in directives
    expect(userSec?.items[0]).toContain('api_key=[redacted-secret]');

    // Verify Markdown generation
    expect(snapshot.markdown).toContain('# Zavorth Handoff Envelope');
    expect(snapshot.markdown).toContain('## Active Mandate');
    expect(snapshot.markdown).toContain('## Modified Paths');
    expect(snapshot.markdown).toContain('api_key=[redacted-secret]');

    // Persist and verify disk write
    const persistedPath = engine.persistHandoff(tempDir, snapshot);
    expect(persistedPath).toContain('handoff-envelope.md');
    expect(fs.existsSync(persistedPath)).toBe(true);

    const persistedContent = fs.readFileSync(persistedPath, 'utf8');
    expect(persistedContent).toContain('# Zavorth Handoff Envelope');
    expect(persistedContent).toContain('api_key=[redacted-secret]');
  });
});
