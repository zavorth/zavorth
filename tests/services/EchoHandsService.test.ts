import fs from 'fs';
import os from 'os';
import path from 'path';
import { EchoHandsService } from '../../src/services/EchoHandsService';

function createBrowserTool() {
  return {
    calls: [] as Array<{ name: string; args: Record<string, unknown> }>,
    async handleToolCall(name: string, args: Record<string, unknown>) {
      this.calls.push({ name, args });
      return {
        isError: false,
        content: [{ type: 'text', text: JSON.stringify({ ok: true, name, args }) }],
      };
    },
  };
}

describe('EchoHandsService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('opens low-risk allowlisted apps without approval', async () => {
    const launcher = jest.fn().mockResolvedValue('started:notepad.exe');
    const service = new EchoHandsService({
      processLauncher: launcher,
      browserTool: createBrowserTool(),
    });

    const result = await service.execute({
      action: 'open_app',
      args: { app: 'notepad' },
      risk: 'low',
    });

    expect(result.ok).toBe(true);
    expect(result.approvalRequired).toBe(false);
    expect(launcher).toHaveBeenCalledWith('notepad.exe', []);
  });

  it('requires approval for medium-risk apps outside trusted mode', async () => {
    const service = new EchoHandsService({
      processLauncher: jest.fn(),
      browserTool: createBrowserTool(),
    });

    const result = await service.execute({
      action: 'open_app',
      args: { app: 'vscode' },
      risk: 'low',
    });

    expect(result.ok).toBe(false);
    expect(result.approvalRequired).toBe(true);
  });

  it('blocks high-risk or unknown apps in V1', async () => {
    const service = new EchoHandsService({
      processLauncher: jest.fn(),
      browserTool: createBrowserTool(),
    });

    const result = await service.execute({
      action: 'open_app',
      args: { app: 'powershell' },
      risk: 'low',
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('high risk');
  });

  it('runs browser searches through the browser adapter', async () => {
    const browserTool = createBrowserTool();
    const service = new EchoHandsService({
      processLauncher: jest.fn(),
      browserTool,
    });

    const result = await service.execute({
      action: 'browser_search',
      args: { engine: 'youtube', query: 'artificial intelligence' },
    });

    expect(result.ok).toBe(true);
    expect(browserTool.calls[0]).toEqual({
      name: 'browser_search',
      args: { engine: 'youtube', query: 'artificial intelligence' },
    });
  });

  it('requires approval before running multi-step protocols', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-echo-protocols-'));
    tempDirs.push(root);
    const protocolsPath = path.join(root, 'echo-protocols.json');
    fs.writeFileSync(protocolsPath, JSON.stringify([{
      name: 'coding_focus',
      description: 'Focus',
      risk: 'medium',
      actions: [
        { action: 'open_app', args: { app: 'notepad' } },
        { action: 'browser_search', args: { engine: 'github', query: 'agents' } },
      ],
    }]), 'utf8');
    const service = new EchoHandsService({
      protocolsPath,
      processLauncher: jest.fn(),
      browserTool: createBrowserTool(),
    });

    const result = await service.execute({
      action: 'protocol_run',
      args: { name: 'coding_focus' },
    });

    expect(result.ok).toBe(false);
    expect(result.approvalRequired).toBe(true);
  });

  it('executes approved protocols in trusted mode', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-echo-protocols-trusted-'));
    tempDirs.push(root);
    const protocolsPath = path.join(root, 'echo-protocols.json');
    fs.writeFileSync(protocolsPath, JSON.stringify([{
      name: 'quick_focus',
      description: 'Focus',
      risk: 'medium',
      actions: [
        { action: 'open_app', args: { app: 'notepad' } },
        { action: 'browser_search', args: { engine: 'github', query: 'agents' } },
      ],
    }]), 'utf8');
    const launcher = jest.fn().mockResolvedValue('started:notepad.exe');
    const browserTool = createBrowserTool();
    const service = new EchoHandsService({
      protocolsPath,
      processLauncher: launcher,
      browserTool,
      trustedMode: true,
    });

    const result = await service.execute({
      action: 'protocol_run',
      args: { name: 'quick_focus' },
    });

    expect(result.ok).toBe(true);
    expect(launcher).toHaveBeenCalled();
    expect(browserTool.calls).toHaveLength(1);
  });
});
