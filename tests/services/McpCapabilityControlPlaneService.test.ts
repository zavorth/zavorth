import fs from 'fs';
import os from 'os';
import path from 'path';
import { McpCapabilityControlPlaneService } from '../../src/services/McpCapabilityControlPlaneService.js';

describe('McpCapabilityControlPlaneService', () => {
  it('merges manifesto and runtime snapshot into one control-plane view', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mcp-plane-'));
    const runtimeStateFile = path.join(root, 'mcp-runtime-state.json');
    fs.writeFileSync(
      runtimeStateFile,
      JSON.stringify({
        generatedAt: '2026-04-03T20:00:00.000Z',
        manifestPath: 'config/mcp-servers.json',
        summary: {
          total: 2,
          enabled: 2,
          connected: 1,
          failed: 1,
          disabled: 0,
          stopped: 0,
          toolCount: 3,
        },
        capabilities: ['filesystem', 'reasoning'],
        entries: [
          {
            id: 'filesystem',
            capability: 'filesystem',
            enabled: true,
            status: 'connected',
            toolCount: 2,
            toolNames: ['mcp_filesystem_read', 'mcp_filesystem_write'],
            command: 'npx.cmd',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            lastAttemptedAt: '2026-04-03T20:00:00.000Z',
            lastConnectedAt: '2026-04-03T20:00:01.000Z',
            lastError: null,
          },
          {
            id: 'sequential-thinking',
            capability: 'reasoning',
            enabled: true,
            status: 'failed',
            toolCount: 0,
            toolNames: [],
            command: 'npx.cmd',
            args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
            lastAttemptedAt: '2026-04-03T20:00:00.000Z',
            lastConnectedAt: null,
            lastError: 'spawn EPERM',
          },
        ],
      }, null, 2),
      'utf8',
    );

    const service = new McpCapabilityControlPlaneService({
      now: () => new Date('2026-04-03T20:05:00.000Z'),
      runtimeStateFile,
      manifestLoader: {
        load: jest.fn(() => [
          {
            id: 'filesystem',
            enabled: true,
            command: 'npx.cmd',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
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
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        total: 3,
        enabled: 2,
        connected: 1,
        failed: 1,
        disabled: 1,
        toolCount: 2,
        capabilityCount: 3,
      }),
    );
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'filesystem',
          status: 'connected',
          toolCount: 2,
        }),
        expect.objectContaining({
          id: 'sequential-thinking',
          status: 'failed',
          issue: 'spawn EPERM',
        }),
        expect.objectContaining({
          id: 'disabled-server',
          status: 'disabled',
        }),
      ]),
    );
    expect(snapshot.recommendations[0]).toContain('failurendo');
    expect(snapshot.narrative.operatorSummary).toContain('1/2 servidor(es) MCP conectado(s)');
  });

  it('lets a disabled manifest entry override stale failed runtime state', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mcp-plane-'));
    const runtimeStateFile = path.join(root, 'mcp-runtime-state.json');
    fs.writeFileSync(
      runtimeStateFile,
      JSON.stringify({
        generatedAt: '2026-04-03T20:00:00.000Z',
        manifestPath: 'config/mcp-servers.json',
        summary: { total: 1, enabled: 1, connected: 0, failed: 1, disabled: 0, stopped: 0, toolCount: 0 },
        capabilities: ['memory'],
        entries: [
          {
            id: 'mnemos',
            capability: 'memory',
            enabled: true,
            status: 'failed',
            toolCount: 0,
            toolNames: [],
            command: 'node.exe',
            args: ['scripts/start-mnemos-mcp.mjs'],
            lastAttemptedAt: '2026-04-03T20:00:00.000Z',
            lastConnectedAt: null,
            lastError: 'MCP error -32000: Connection closed',
          },
        ],
      }, null, 2),
      'utf8',
    );

    const service = new McpCapabilityControlPlaneService({
      runtimeStateFile,
      manifestLoader: {
        load: jest.fn(() => [
          {
            id: 'mnemos',
            enabled: false,
            command: 'node.exe',
            args: ['scripts/start-mnemos-mcp.mjs'],
            env: {},
            capability: 'memory',
          },
        ]),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary).toEqual(expect.objectContaining({
      enabled: 0,
      connected: 0,
      failed: 0,
      disabled: 1,
      toolCount: 0,
    }));
    expect(snapshot.entries[0]).toEqual(expect.objectContaining({
      id: 'mnemos',
      enabled: false,
      status: 'disabled',
      issue: null,
      toolNames: [],
    }));
    expect(snapshot.recommendations.join('\n')).not.toContain('failurendo');
  });
});
