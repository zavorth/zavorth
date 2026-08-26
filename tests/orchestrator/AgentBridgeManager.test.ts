import fs from 'fs';
import os from 'os';
import path from 'path';
import { AgentBridgeManager } from '../../src/orchestrator/AgentBridgeManager';

describe('AgentBridgeManager', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        rmWithRetry(target);
      }
    }
  });

  it('preserves companion targeting metadata when saving a stale session snapshot', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-bridge-'));
    const pendingDir = path.join(root, 'pending');
    tempDirs.push(root);
    fs.mkdirSync(pendingDir, { recursive: true });

    const trackingFile = path.join(pendingDir, 'task-123.json');
    fs.writeFileSync(
      trackingFile,
      JSON.stringify(
        {
          taskId: 'task-123',
          chatId: 'chat-1',
          prompt: 'teste',
          workspace: 'C:/workspace/zavorth',
          handoffFile: 'handoff.md',
          responseFile: 'response.md',
          trackingFile,
          launchedAt: '2026-03-25T05:00:00.000Z',
          brainDir: null,
          deliveredArtifactKeys: ['brain-1:plan'],
          deliveredResponse: false,
          completedAt: null,
          lastDeliveredLogAt: '2026-03-25T05:01:00.000Z',
          automationAttempts: 2,
          lastAutomationAt: '2026-03-25T05:01:30.000Z',
          lastAutomationAction: 'companion-sync-pending-handoffs',
          companionInstanceId: 'bridge-99',
          sessionKind: 'handoff',
          automationEnabled: true,
          lastUiProbeAt: '2026-03-25T05:02:00.000Z',
        },
        null,
        2,
      ),
      'utf8',
    );

    const manager = new AgentBridgeManager() as any;
    const staleSnapshot = {
      taskId: 'task-123',
      chatId: 'chat-1',
      prompt: 'teste',
      workspace: 'C:/workspace/zavorth',
      handoffFile: 'handoff.md',
      responseFile: 'response.md',
      trackingFile,
      launchedAt: '2026-03-25T05:00:00.000Z',
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      completedAt: null,
      lastDeliveredLogAt: null,
      automationAttempts: 0,
      lastAutomationAt: null,
      lastAutomationAction: null,
      companionInstanceId: null,
      sessionKind: 'handoff',
      automationEnabled: true,
      lastUiProbeAt: null,
    };

    await manager.saveSession(staleSnapshot);

    const saved = JSON.parse(fs.readFileSync(trackingFile, 'utf8'));
    expect(saved.companionInstanceId).toBe('bridge-99');
    expect(saved.automationAttempts).toBe(2);
    expect(saved.deliveredArtifactKeys).toEqual(['brain-1:plan']);
    expect(saved.lastUiProbeAt).toBe('2026-03-25T05:02:00.000Z');
  });

  it('writes a final delivery contract that requires the response file', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-bridge-'));
    const promptDir = path.join(root, 'handoffs');
    const pendingDir = path.join(root, 'pending');
    const responseDir = path.join(root, 'responses');
    tempDirs.push(root);
    fs.mkdirSync(promptDir, { recursive: true });
    fs.mkdirSync(pendingDir, { recursive: true });
    fs.mkdirSync(responseDir, { recursive: true });

    const manager = new AgentBridgeManager() as any;
    manager.promptDir = promptDir;
    manager.pendingDir = pendingDir;
    manager.responseDir = responseDir;

    const handoff = await manager.createZavorthBridgeHandoff(
      {
        task_id: 'task-456',
        chat_id: 'chat-1',
      },
      'pesquise as noticias do dia',
      'C:/workspace/zavorth',
    );

    const content = fs.readFileSync(handoff.handoffFile, 'utf8');
    expect(content).toContain('## Final Delivery Contract');
    expect(content).toContain('When the task is complete, always write a UTF-8 markdown report to:');
    expect(content).toContain(handoff.responseFile);
  });
});

function rmWithRetry(targetPath: string): void {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 7) {
        console.warn(`[test-cleanup] could not remove temp dir ${targetPath}`, error);
        return;
      }
      sleepSync(25 * (attempt + 1));
    }
  }
}

function sleepSync(ms: number): void {
  const buffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buffer), 0, 0, ms);
}
