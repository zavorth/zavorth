import { McpRuntimeService } from '../../src/mcp/McpRuntimeService';
import { ToolRegistry } from '../../src/tools/ToolRegistry';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('McpRuntimeService', () => {
  it('connects enabled servers, writes runtime state and disconnects them on shutdown', async () => {
    const connectCalls: string[] = [];
    const disconnectCalls: string[] = [];
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mcp-runtime-'));
    const stateFile = path.join(root, 'mcp-runtime-state.json');
    const loader = {
      load: jest.fn().mockReturnValue([
        {
          id: 'filesystem',
          enabled: true,
          command: 'npx.cmd',
          args: ['-y', '@modelcontextprotocol/server-filesystem', 'C:/workspace-root'],
          env: {},
          capability: 'filesystem',
        },
        {
          id: 'sequential-thinking',
          enabled: true,
          command: 'npx.cmd',
          args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
          env: {},
          capability: 'reasoning',
        },
        {
          id: 'disabled-server',
          enabled: false,
          command: 'npx.cmd',
          args: ['-y', '@modelcontextprotocol/server-disabled'],
          env: {},
          capability: 'disabled',
        },
      ]),
    } as any;
    const logRepo = {
      log: jest.fn(),
    } as any;
    const runtime = new McpRuntimeService(
      new ToolRegistry(),
      logRepo,
      loader,
      (entry) => ({
        name: entry.id,
        connect: jest.fn().mockImplementation(async (registry: ToolRegistry) => {
          const tool = { name: `mcp_${entry.id}`, getDefinition: jest.fn() } as any;
          registry.register(tool);
          connectCalls.push(entry.id);
        }),
        disconnect: jest.fn().mockImplementation(async () => {
          disconnectCalls.push(entry.id);
        }),
      }),
      stateFile,
    );

    await runtime.start();

    const startedSnapshot = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    await runtime.stop();
    const stoppedSnapshot = JSON.parse(fs.readFileSync(stateFile, 'utf8'));

    expect(loader.load).toHaveBeenCalled();
    expect(connectCalls).toEqual(['filesystem', 'sequential-thinking']);
    expect(disconnectCalls).toEqual(['sequential-thinking', 'filesystem']);
    expect(startedSnapshot.summary).toEqual(
      expect.objectContaining({
        total: 3,
        enabled: 2,
        connected: 2,
        disabled: 1,
        toolCount: 2,
      }),
    );
    expect(startedSnapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'filesystem',
          status: 'connected',
          toolCount: 1,
          toolNames: ['mcp_filesystem'],
        }),
        expect.objectContaining({
          id: 'disabled-server',
          status: 'disabled',
        }),
      ]),
    );
    expect(stoppedSnapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'filesystem',
          status: 'stopped',
        }),
      ]),
    );
  });
});
