import { PassThrough } from 'stream';

import { ZavorthAcpServer } from '../../src/acp/ZavorthAcpServer.js';
import { buildDefaultManifest, ZAVORTH_ACP_SERVER_CONTRACT_VERSION } from '../../src/acp/AcpServerManifest.js';

function createServerPair() {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();

  const outputLines: string[] = [];
  stdout.on('data', (chunk: Buffer) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    outputLines.push(...lines);
  });

  const server = new ZavorthAcpServer({ stdin, stdout, stderr });
  return { server, stdin, stdout, stderr, outputLines };
}

function sendAndCollect(server: ZavorthAcpServer, stdin: PassThrough, outputLines: string[], request: Record<string, unknown>, ms = 100): Promise<void> {
  server.start();
  stdin.write(JSON.stringify(request) + '\n');
  return new Promise((r) => setTimeout(r, ms));
}

function parseResponse(line: string): Record<string, unknown> {
  return JSON.parse(line);
}

describe('ZavorthAcpServer', () => {
  describe('manifest', () => {
    it('should build default manifest', () => {
      const manifest = buildDefaultManifest();
      expect(manifest.contractVersion).toBe(ZAVORTH_ACP_SERVER_CONTRACT_VERSION);
      expect(manifest.serverName).toBe('Zavorth ACP Server');
      expect(manifest.entries).toHaveLength(1);
      expect(manifest.entries[0].tools.length).toBeGreaterThan(0);
    });

    it('should include core tools', () => {
      const manifest = buildDefaultManifest();
      const toolNames = manifest.entries[0].tools.map((t) => t.name);
      expect(toolNames).toContain('Read');
      expect(toolNames).toContain('Write');
      expect(toolNames).toContain('Bash');
      expect(toolNames).toContain('Glob');
      expect(toolNames).toContain('Grep');
    });
  });

  describe('server lifecycle', () => {
    it('should create server with default manifest', () => {
      const { server, stdin } = createServerPair();
      const snapshot = server.getSnapshot();
      expect(snapshot.status).toBe('starting');
      expect(snapshot.serverId).toBe('zavorth-acp');
      server.stop();
      stdin.destroy();
    });

    it('should report tools registered', () => {
      const { server, stdin } = createServerPair();
      const snapshot = server.getSnapshot();
      expect(snapshot.toolsRegistered).toContain('Read');
      expect(snapshot.toolsRegistered).toContain('Bash');
      server.stop();
      stdin.destroy();
    });

    it('should stop cleanly', () => {
      const { server, stdin } = createServerPair();
      server.stop();
      const snapshot = server.getSnapshot();
      expect(snapshot.status).toBe('stopped');
      stdin.destroy();
    });
  });

  describe('JSON-RPC protocol', () => {
    it('should handle initialize', async () => {
      const { server, stdin, stdout, stderr, outputLines } = createServerPair();

      server.start();
      stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name: 'vscode' } } }) + '\n');

      await new Promise((r) => setTimeout(r, 100));
      server.stop();
      stdin.destroy();

      const initResponse = outputLines.find((line) => {
        try { return (JSON.parse(line) as Record<string, unknown>).id === 1; } catch { return false; }
      });

      expect(initResponse).toBeDefined();
      const parsed = parseResponse(initResponse!);
      const result = parsed.result as Record<string, unknown>;
      expect((result.serverInfo as Record<string, unknown>).name).toBe('Zavorth ACP Server');
    });

    it('should handle tools/list', async () => {
      const { server, stdin, outputLines } = createServerPair();

      server.start();
      stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n');

      await new Promise((r) => setTimeout(r, 100));
      server.stop();
      stdin.destroy();

      const toolsResponse = outputLines.find((line) => {
        try { return (JSON.parse(line) as Record<string, unknown>).id === 1; } catch { return false; }
      });

      expect(toolsResponse).toBeDefined();
      const parsed = parseResponse(toolsResponse!);
      const result = parsed.result as Record<string, unknown>;
      expect(Array.isArray(result.tools)).toBe(true);
      expect((result.tools as unknown[]).length).toBeGreaterThan(0);
    });

    it('should handle session/start', async () => {
      const { server, stdin, outputLines } = createServerPair();

      server.start();
      stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'session/start', params: { sessionId: 'test-123', cwd: '/tmp' } }) + '\n');

      await new Promise((r) => setTimeout(r, 100));
      server.stop();
      stdin.destroy();

      const sessionResponse = outputLines.find((line) => {
        try { return (JSON.parse(line) as Record<string, unknown>).id === 1; } catch { return false; }
      });

      expect(sessionResponse).toBeDefined();
      const parsed = parseResponse(sessionResponse!);
      expect((parsed.result as Record<string, unknown>).sessionId).toBe('test-123');
      expect((parsed.result as Record<string, unknown>).status).toBe('started');
    });

    it('should handle ping', async () => {
      const { server, stdin, outputLines } = createServerPair();

      server.start();
      stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) + '\n');

      await new Promise((r) => setTimeout(r, 100));
      server.stop();
      stdin.destroy();

      const pingResponse = outputLines.find((line) => {
        try { return (JSON.parse(line) as Record<string, unknown>).id === 1; } catch { return false; }
      });

      expect(pingResponse).toBeDefined();
      expect((parseResponse(pingResponse!).result as Record<string, unknown>).pong).toBe(true);
    });

    it('should return error for unknown method', async () => {
      const { server, stdin, outputLines } = createServerPair();

      server.start();
      stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'unknown/method' }) + '\n');

      await new Promise((r) => setTimeout(r, 100));
      server.stop();
      stdin.destroy();

      const errorResponse = outputLines.find((line) => {
        try { return (JSON.parse(line) as Record<string, unknown>).id === 1; } catch { return false; }
      });

      expect(errorResponse).toBeDefined();
      expect(parseResponse(errorResponse!).error).toBeDefined();
    });

    it('should handle message/send in active session', async () => {
      const { server, stdin, outputLines } = createServerPair();

      server.start();
      stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'session/start', params: { sessionId: 'msg-test' } }) + '\n');
      stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'message/send', params: { sessionId: 'msg-test', content: 'hello' } }) + '\n');

      await new Promise((r) => setTimeout(r, 200));
      server.stop();
      stdin.destroy();

      const msgResponse = outputLines.find((line) => {
        try { return (JSON.parse(line) as Record<string, unknown>).id === 2; } catch { return false; }
      });

      expect(msgResponse).toBeDefined();
      const parsed = parseResponse(msgResponse!);
      expect((parsed.result as Record<string, unknown>).status).toBe('completed');
    });

    it('should report snapshot correctly', () => {
      const { server, stdin } = createServerPair();
      const snapshot = server.getSnapshot();
      expect(snapshot.contractVersion).toBe(ZAVORTH_ACP_SERVER_CONTRACT_VERSION);
      expect(snapshot.toolsRegistered.length).toBeGreaterThan(0);
      expect(snapshot.capabilities.length).toBeGreaterThan(0);
      server.stop();
      stdin.destroy();
    });
  });
});
