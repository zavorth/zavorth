import { spawn } from 'child_process';
import * as path from 'path';
import {
  firstArg,
  readFlag,
  readNumberFlag,
  stateDir,
  readJson,
  readArray,
  writeJson,
  idWithTime,
  render,
  splitList,
  appendJsonArray,
  type JsonObject,
} from './ZavorthCliSharedHelpers.js';
import { spawnCommandLine } from '../security/SafeProcessExec.js';

export async function runMcp(root: string, args: string[]) {
  const file = path.join(stateDir(root), 'mcp.json');
  const action = firstArg(args, 'list');
  const servers = await readArray(file);
  if (action === 'add') {
    const name = args[1];
    const command = args.slice(2).join(' ');
    if (!name || !command) return render(args, 'Zavorth mcp', ['Usage: zavorth mcp add <name> <command>'], { ok: false });
    servers.push({
      id: name,
      command,
      status: 'configured',
      allowTools: splitList(readFlag(args, 'allow-tools') || ''),
      allowResources: splitList(readFlag(args, 'allow-resources') || ''),
      channelBridge: readFlag(args, 'channel') || null,
      createdAt: new Date().toISOString(),
    });
    await writeJson(file, servers);
    return render(args, 'Zavorth mcp', [`Added MCP server: ${name}`], { servers });
  }
  if (action === 'allowlist') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = findById(servers, id);
    if (!selected) return render(args, 'Zavorth mcp', [`No MCP server found for id: ${id || '<missing>'}`], { ok: false });
    selected.allowTools = splitList(readFlag(args, 'tools') || readFlag(args, 'allow-tools') || String((selected.allowTools as string[] | undefined)?.join(',') || ''));
    selected.allowResources = splitList(readFlag(args, 'resources') || readFlag(args, 'allow-resources') || String((selected.allowResources as string[] | undefined)?.join(',') || ''));
    selected.updatedAt = new Date().toISOString();
    await writeJson(file, servers);
    await writeMcpRuntimeState(root, servers);
    return render(
      args,
      'Zavorth mcp allowlist',
      [`Updated allowlist: ${String(selected.id)}`, `tools: ${((selected.allowTools as string[]) || []).join(', ') || 'none'}`, `resources: ${((selected.allowResources as string[]) || []).join(', ') || 'none'}`],
      { server: sanitizeMcpServer(selected) },
    );
  }
  if (action === 'bridge') {
    const id = args[1] || readFlag(args, 'id') || '';
    const channel = readFlag(args, 'channel') || args[2] || '';
    const selected = findById(servers, id);
    if (!selected) return render(args, 'Zavorth mcp', [`No MCP server found for id: ${id || '<missing>'}`], { ok: false });
    selected.channelBridge = channel || null;
    selected.updatedAt = new Date().toISOString();
    await writeJson(file, servers);
    await writeMcpRuntimeState(root, servers);
    return render(args, 'Zavorth mcp bridge', [`Bridge ${channel ? 'set' : 'cleared'} for ${id}`], { server: sanitizeMcpServer(selected) });
  }
  if (action === 'tools' || action === 'resources' || action === 'handshake' || action === 'doctor' || action === 'run') {
    const id = args[1];
    const selected = id ? (servers.find((server) => String((server as JsonObject).id) === id) as JsonObject | undefined) : (servers[0] as JsonObject | undefined);
    if (!selected) return render(args, 'Zavorth mcp', ['No MCP server configured. Run: zavorth mcp add <name> <command>'], { ok: false });
    if (action === 'doctor' && !args.includes('--run') && !args.includes('--yes')) {
      return render(args, 'Zavorth mcp', [`Configured: ${String(selected.id)}`, `Command: ${String(selected.command || '')}`, 'Dry run only. Add --run --yes to execute a short live probe.'], { ok: true, dryRun: true, selected });
    }
    if (!args.includes('--yes')) return render(args, 'Zavorth mcp', ['Live MCP probe/run requires --yes.'], { ok: false });
    const snapshot = await probeMcpServer(root, selected, action, args);
    selected.status = snapshot.ok ? 'available' : 'degraded';
    selected.lastHealthAt = new Date().toISOString();
    selected.lastSnapshot = snapshot;
    await writeJson(file, servers);
    await writeMcpRuntimeState(root, servers);
    await appendJsonArray(path.join(stateDir(root), 'logs', 'mcp.json'), { id: idWithTime('mcp-log'), serverId: selected.id, action, snapshot, createdAt: new Date().toISOString() });
    return render(args, 'Zavorth mcp', renderMcpSnapshotLines(snapshot), { server: sanitizeMcpServer(selected), snapshot });
  }
  if (action === 'reload') {
    await writeMcpRuntimeState(root, servers);
    return render(args, 'Zavorth mcp reload', [`Reloaded runtime MCP state for ${servers.length} server(s).`], { servers: servers.map(sanitizeMcpServer) });
  }
  if (action === 'logs') {
    const logs = await readArray(path.join(stateDir(root), 'logs', 'mcp.json'));
    return render(
      args,
      'Zavorth mcp logs',
      logs.length ? logs.slice(-20).map((entry) => `- ${String((entry as JsonObject).createdAt)} | ${String((entry as JsonObject).serverId)} | ${String((entry as JsonObject).action)}`) : ['No MCP logs recorded yet.'],
      { logs },
    );
  }
  if (action === 'health') {
    const runtime = (await readJson(path.join(stateDir(root), 'mcp-runtime.json'), { servers: [] })) as JsonObject;
    const runtimeServers = Array.isArray(runtime.servers) ? runtime.servers : [];
    return render(
      args,
      'Zavorth mcp health',
      runtimeServers.length
        ? runtimeServers.map(
            (server) => `- ${String((server as JsonObject).id)} | ${String((server as JsonObject).status)} | tools ${String((server as JsonObject).toolsCount || 0)} | resources ${String((server as JsonObject).resourcesCount || 0)}`,
          )
        : ['No MCP runtime health yet. Run: zavorth mcp doctor <id> --run --yes'],
      { runtime },
    );
  }
  return render(args, 'Zavorth mcp', servers.length ? servers.map((server) => `- ${String((server as JsonObject).id)} | ${String((server as JsonObject).status || 'configured')}`) : ['No MCP servers configured yet.'], { servers });
}

export async function probeMcpServer(root: string, server: JsonObject, action: string, args: string[]): Promise<JsonObject> {
  const command = String(server.command || '');
  const methods = ['initialize'];
  if (action === 'tools' || action === 'doctor' || action === 'run') methods.push('tools/list');
  if (action === 'resources' || action === 'doctor' || action === 'run') methods.push('resources/list');
  const result = await runMcpJsonRpcSequence(command, methods, root, readNumberFlag(args, 'timeout-ms') || 5000);
  const tools = filterMcpTools(extractMcpTools(result.responses), (server.allowTools as string[] | undefined) || []);
  const resources = filterMcpResources(extractMcpResources(result.responses), (server.allowResources as string[] | undefined) || []);
  return {
    ok: result.ok,
    serverId: server.id,
    command: redactCommand(command),
    initialized: Boolean(result.responses.find((response) => Number((response as JsonObject).id) === 1 && !(response as JsonObject).error)),
    tools,
    resources,
    toolsCount: tools.length,
    resourcesCount: resources.length,
    allowTools: server.allowTools || [],
    allowResources: server.allowResources || [],
    channelBridge: server.channelBridge || null,
    durationMs: result.durationMs,
    error: result.error || null,
  };
}

export async function runMcpJsonRpcSequence(command: string, methods: string[], cwd: string, timeoutMs: number): Promise<{ ok: boolean; responses: JsonObject[]; durationMs: number; error?: string }> {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    // S3: argv-only MCP spawn (no shell:true).
    let child: ReturnType<typeof spawn>;
    try {
      child = spawnCommandLine(command, { cwd, windowsHide: true, stdio: 'pipe' });
    } catch (error: unknown) {
      resolve({
        ok: false,
        responses: [],
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let stderr = '';
    const responses: JsonObject[] = [];
    let nextId = 1;
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, responses, durationMs: Date.now() - startedAt, error: 'mcp-timeout' });
    }, timeoutMs);
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += String(chunk);
    });
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = Buffer.concat([stdout, Buffer.from(chunk)]);
      const parsed = parseMcpFrames(stdout);
      stdout = parsed.remaining;
      responses.push(...parsed.messages);
      if (responses.length >= methods.length) {
        clearTimeout(timer);
        child.kill();
        resolve({ ok: responses.every((response) => !(response as JsonObject).error), responses, durationMs: Date.now() - startedAt });
      }
    });
    child.on('error', (error: Error) => {
      clearTimeout(timer);
      resolve({ ok: false, responses, durationMs: Date.now() - startedAt, error: error.message });
    });
    child.on('exit', () => {
      clearTimeout(timer);
      resolve({
        ok: responses.length > 0 && responses.every((response) => !(response as JsonObject).error),
        responses,
        durationMs: Date.now() - startedAt,
        error: responses.length ? undefined : stderr.slice(0, 500) || 'mcp-process-exited-without-response',
      });
    });
    for (const method of methods) {
      const payload =
        method === 'initialize' ? { jsonrpc: '2.0', id: nextId, method, params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'zavorth-cli', version: '1' } } } : { jsonrpc: '2.0', id: nextId, method, params: {} };
      nextId += 1;
      child.stdin?.write(encodeMcpFrame(payload));
    }
  });
}

export function encodeMcpFrame(payload: JsonObject): string {
  const body = JSON.stringify(payload);
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}

export function parseMcpFrames(buffer: Buffer<ArrayBufferLike>): { messages: JsonObject[]; remaining: Buffer<ArrayBufferLike> } {
  const messages: JsonObject[] = [];
  let remaining = buffer;
  while (remaining.length > 0) {
    const headerEnd = remaining.indexOf('\r\n\r\n');
    if (headerEnd < 0) break;
    const header = remaining.slice(0, headerEnd).toString('utf8');
    const match = header.match(/content-length:\s*(\d+)/iu);
    if (!match) break;
    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (remaining.length < bodyEnd) break;
    const body = remaining.slice(bodyStart, bodyEnd).toString('utf8');
    try {
      messages.push(JSON.parse(body));
    } catch (error: unknown) {
      messages.push({ error: { message: 'invalid-json-rpc-response' } });
    }
    remaining = remaining.slice(bodyEnd);
  }
  return { messages, remaining };
}

export function extractMcpTools(responses: JsonObject[]): JsonObject[] {
  const found = responses.find((response) => {
    const result = (response.result || {}) as JsonObject;
    return Array.isArray(result.tools);
  });
  const result = (found?.result || {}) as JsonObject;
  return Array.isArray(result.tools) ? (result.tools as JsonObject[]) : [];
}

export function extractMcpResources(responses: JsonObject[]): JsonObject[] {
  const found = responses.find((response) => {
    const result = (response.result || {}) as JsonObject;
    return Array.isArray(result.resources);
  });
  const result = (found?.result || {}) as JsonObject;
  return Array.isArray(result.resources) ? (result.resources as JsonObject[]) : [];
}

export function filterMcpTools(tools: JsonObject[], allowlist: string[]): JsonObject[] {
  if (!allowlist.length) return tools;
  const allowed = new Set(allowlist.map((entry) => entry.toLowerCase()));
  return tools.filter((tool) => allowed.has(String(tool.name || '').toLowerCase()));
}

export function filterMcpResources(resources: JsonObject[], allowlist: string[]): JsonObject[] {
  if (!allowlist.length) return resources;
  const allowed = new Set(allowlist.map((entry) => entry.toLowerCase()));
  return resources.filter((resource) => allowed.has(String(resource.uri || resource.name || '').toLowerCase()));
}

export function renderMcpSnapshotLines(snapshot: JsonObject): string[] {
  return [
    `Handshake: ${snapshot.initialized ? 'passed' : 'failed'}`,
    `Tools: ${String(snapshot.toolsCount || 0)}`,
    `Resources: ${String(snapshot.resourcesCount || 0)}`,
    `Duration: ${String(snapshot.durationMs || 0)}ms`,
    snapshot.error ? `Error: ${String(snapshot.error)}` : 'Health snapshot recorded.',
  ];
}

export async function writeMcpRuntimeState(root: string, servers: unknown[]): Promise<void> {
  const runtime = {
    version: 1,
    updatedAt: new Date().toISOString(),
    servers: servers.map((server) => {
      const item = server as JsonObject;
      const snapshot = (item.lastSnapshot || {}) as JsonObject;
      return {
        id: item.id,
        status: item.status || 'configured',
        command: redactCommand(String(item.command || '')),
        allowTools: item.allowTools || [],
        allowResources: item.allowResources || [],
        channelBridge: item.channelBridge || null,
        toolsCount: snapshot.toolsCount || 0,
        resourcesCount: snapshot.resourcesCount || 0,
        lastHealthAt: item.lastHealthAt || null,
      };
    }),
  };
  await writeJson(path.join(stateDir(root), 'mcp-runtime.json'), runtime);
}

export function sanitizeMcpServer(value: unknown): JsonObject {
  const item = { ...((value || {}) as JsonObject) };
  if (item.command) item.command = redactCommand(String(item.command));
  return item;
}

export function redactCommand(command: string): string {
  return command.replace(/(token|key|secret|password)=("[^"]+"|'[^']+'|\S+)/giu, '$1=***');
}

export function findById(items: unknown[], id: string): JsonObject | undefined {
  return items.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
}
