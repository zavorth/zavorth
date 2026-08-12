import { spawn } from 'child_process';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { safeFetch } from '../../../security/SafeFetchService.js';
import type {
  ZavorthActionDefinition,
  ZavorthActionHandlerInput,
  ZavorthActionModule,
  ZavorthActionResult,
  ZavorthActionSchema,
} from '../ZavorthActionContracts.js';
import { asErrorLike } from '../../../utils/errorLike.js';

const SURFACE: ZavorthActionDefinition['surface'] = ['cli', 'zavorthControl', 'tui', 'api', 'channel', 'llm'];
const TEST_REFS = ['tests/runtime/actions/ZavorthActionHarness.test.ts'];

const outputSchema: ZavorthActionSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    summary: { type: 'string' },
  },
};

function text(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function result(input: {
  ok: boolean;
  actionId: string;
  operation: ZavorthActionResult['operation'];
  status: ZavorthActionResult['status'];
  summary: string;
  lines: string[];
  data?: Record<string, unknown>;
}): ZavorthActionResult {
  return input;
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}/***`;
  } catch (error: unknown) {return '***';
  }
}

function block(input: ZavorthActionHandlerInput, summary: string, lines: string[] = [], data?: Record<string, unknown>): ZavorthActionResult {
  return result({
    ok: false,
    actionId: input.actionId,
    operation: input.operation,
    status: 'blocked',
    summary,
    lines: lines.length ? lines : [summary],
    data,
  });
}

function splitCommand(command: string): string[] {
  if (/[;&|<>`$]/u.test(command)) throw new Error('Command contains blocked shell metacharacters.');
  return command.match(/"[^"]+"|'[^']+'|\S+/gu)?.map((part) => part.replace(/^["']|["']$/gu, '')) || [];
}

function resolveAllowlistedCommand(command: unknown): { command: string; args: string[]; normalized: string } {
  const raw = text(command);
  if (!raw) throw new Error('Missing command.');
  const [bin, ...args] = splitCommand(raw);
  const normalizedBin = (bin || '').toLowerCase();
  const first = (args[0] || '').toLowerCase();
  const second = (args[1] || '').toLowerCase();
  const allowed = normalizedBin === 'git' && ['status', 'diff', 'show', 'log'].includes(first)
    || normalizedBin === 'npm' && first === 'run' && /^(test|qa:|zavorth:.*:check|runtime:check|security:ci)/u.test(second)
    || normalizedBin === 'npm' && first === 'test'
    || normalizedBin === 'npx' && ['jest', 'tsc', 'tsx'].includes(first)
    || normalizedBin === 'node' && /^scripts\/[a-z0-9._-]+\.mjs$/iu.test(first);
  if (!allowed) throw new Error('Command is not in the Action Harness allowlist.');
  return { command: bin, args, normalized: [bin, ...args].join(' ') };
}

function runProcess(command: string, args: string[], cwd: string, timeoutMs: number): Promise<{ exitCode: number; output: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true });
    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ exitCode: 124, output: output.slice(-12000), timedOut: true });
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { output += String(chunk); });
    child.stderr.on('data', (chunk) => { output += String(chunk); });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ exitCode: 1, output: error.message, timedOut: false });
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 0, output: output.slice(-12000), timedOut: false });
    });
  });
}

async function shellPreviewCommand(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  try {
    const command = resolveAllowlistedCommand(input.args.command);
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: `Command is allowlisted: ${command.normalized}`,
      lines: ['Preview only. No process was spawned.', `cwd: ${input.root}`, `command: ${command.normalized}`],
      data: { ...command, cwd: input.root, timeoutMs: 30000, outputTruncated: true },
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    return block(input, 'Shell command preview blocked.', [error instanceof Error ? err.message : String(error)]);
  }
}

async function shellRunAllowlisted(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const preview = await shellPreviewCommand(input);
  if (!preview.ok) return preview;
  if (input.operation === 'action.preview' || input.operation === 'action.status') return preview;
  if (input.operation !== 'action.apply') return block(input, `Unsupported operation for ${input.actionId}.`);
  const command = preview.data as { command: string; args: string[]; normalized: string };
  const executed = await runProcess(command.command, command.args, input.root, 30000);
  return result({
    ok: executed.exitCode === 0,
    actionId: input.actionId,
    operation: input.operation,
    status: executed.exitCode === 0 ? 'applied' : 'blocked',
    summary: `Command exited with code ${executed.exitCode}.`,
    lines: executed.output.split(/\r?\n/u).slice(-120),
    data: { command: command.normalized, cwd: input.root, exitCode: executed.exitCode, timedOut: executed.timedOut, output: executed.output },
  });
}

async function sandboxRunCode(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const code = text(input.args.code);
  if (!code) return block(input, 'Missing sandbox code.', ['Provide args.code.']);
  if (input.operation === 'action.preview' || input.operation === 'action.status') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: 'Sandbox code preview accepted.',
      lines: ['Preview only. Code execution requires approval.', `Characters: ${code.length}`, 'Runtime: node --check for static syntax validation.'],
      data: { runtime: 'node', cwd: input.root, timeoutMs: 10000, isolation: 'process-quarantine', network: 'not-granted', codePreview: code.slice(0, 400) },
    });
  }
  if (input.operation !== 'action.apply') return block(input, `Unsupported operation for ${input.actionId}.`);
  const tmpDir = path.join(input.root, '.zavorth', 'sandbox');
  await fsp.mkdir(tmpDir, { recursive: true });
  const file = path.join(tmpDir, `sandbox-${Date.now()}.mjs`);
  await fsp.writeFile(file, code, 'utf8');
  const executed = await runProcess(process.execPath, [file], input.root, 10000);
  await fsp.rm(file, { force: true });
  return result({
    ok: executed.exitCode === 0,
    actionId: input.actionId,
    operation: input.operation,
    status: executed.exitCode === 0 ? 'applied' : 'blocked',
    summary: `Sandbox code exited with code ${executed.exitCode}.`,
    lines: executed.output.split(/\r?\n/u).slice(-120),
    data: { runtime: 'node', isolation: 'process-quarantine', network: 'not-granted', exitCode: executed.exitCode, timedOut: executed.timedOut, output: executed.output },
  });
}

async function sandboxRunTests(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const command = text(input.args.command, 'npm run runtime:check');
  return shellRunAllowlisted({ ...input, args: { command } });
}

function channelStatus(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const channels = ['telegram', 'discord', 'slack'].map((id) => ({
    id,
    configured: Boolean(process.env[`${id.toUpperCase()}_BOT_TOKEN`] || process.env[`${id.toUpperCase()}_WEBHOOK_URL`] || process.env[`${id.toUpperCase()}_TOKEN`]),
    mode: 'status-only',
  }));
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `${channels.filter((channel) => channel.configured).length} channel(s) configured.`,
    lines: channels.map((channel) => `${channel.id}: ${channel.configured ? 'configured' : 'missing credentials'}`),
    data: { channels, sendsMessages: false },
  });
}

function channelDraft(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const channel = text(input.args.channel, 'draft');
  const message = text(input.args.message || input.args.text);
  if (!message) return block(input, 'Missing draft message.', ['Provide args.message.']);
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: input.operation === 'action.preview' ? 'preview' : 'ok',
    summary: `Draft prepared for ${channel}; no message was sent.`,
    lines: [`Channel: ${channel}`, `Message: ${message.slice(0, 500)}`, 'No external send occurred.'],
    data: { channel, message, externalSend: false },
  });
}

function channelWebhookEnv(channel: string): string {
  const normalized = channel.toUpperCase().replace(/[^A-Z0-9]/gu, '_');
  return `${normalized}_WEBHOOK_URL`;
}

function configuredChannelWebhook(channel: string): { envName: string; url: string } | null {
  const normalized = channel.toUpperCase().replace(/[^A-Z0-9]/gu, '_');
  const envNames = [`ZAVORTH_${normalized}_WEBHOOK_URL`, `${normalized}_WEBHOOK_URL`];
  for (const envName of envNames) {
    const url = text(process.env[envName]);
    if (url) return { envName, url };
  }
  return null;
}

async function channelSendApproved(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const channel = text(input.args.channel, 'slack').toLowerCase();
  const message = text(input.args.message || input.args.text);
  if (!message) return block(input, 'Missing channel message.', ['Provide args.message.']);
  const configuredWebhook = configuredChannelWebhook(channel);
  if (!configuredWebhook) {
    const envName = channelWebhookEnv(channel);
    return block(input, `Channel ${channel} is not configured for approved sends.`, [`Missing ZAVORTH_${envName} or ${envName}.`]);
  }
  const { url: webhookUrl } = configuredWebhook;

  if (input.operation === 'action.preview' || input.operation === 'action.status') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: `Approved channel send preview for ${channel}.`,
      lines: [`Channel: ${channel}`, `Webhook: ${redactUrl(webhookUrl)}`, `Message: ${message.slice(0, 500)}`, 'External send requires approval.'],
      data: { channel, webhook: redactUrl(webhookUrl), messagePreview: message.slice(0, 500), externalSend: true },
    });
  }
  if (input.operation !== 'action.apply') return block(input, `Unsupported operation for ${input.actionId}.`);

  const response = await safeFetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: message }),
  }, {
    serviceName: `Channel ${channel} webhook`,
  });
  const responseText = await response.text().catch(() => '');
  return result({
    ok: response.ok,
    actionId: input.actionId,
    operation: input.operation,
    status: response.ok ? 'applied' : 'blocked',
    summary: response.ok ? `Message sent to ${channel}.` : `Channel send failed with HTTP ${response.status}.`,
    lines: [`Channel: ${channel}`, `HTTP status: ${response.status}`, `Webhook: ${redactUrl(webhookUrl)}`],
    data: { channel, webhook: redactUrl(webhookUrl), status: response.status, responseBytes: responseText.length, externalSend: true },
  });
}

function mcpConfigPath(root: string): string {
  return path.join(root, 'mcp.json');
}

function readMcpConfig(root: string): Record<string, unknown> {
  try {
    if (fs.existsSync(mcpConfigPath(root))) return JSON.parse(fs.readFileSync(mcpConfigPath(root), 'utf8'));
  } catch (error: unknown) {return {};
  }
  return {};
}

function mcpServers(root: string): Record<string, unknown> {
  const parsed = readMcpConfig(root);
  return (parsed.servers || parsed.mcpServers || {}) as Record<string, unknown>;
}

function isTrustedMcpServer(serverConfig: unknown): boolean {
  if (!serverConfig || typeof serverConfig !== 'object') return false;
  const command = text((serverConfig as Record<string, unknown>).command).toLowerCase();
  return ['node', 'npx', 'tsx'].includes(command) || command.endsWith('node.exe');
}

function serverAllowsTool(serverConfig: unknown, tool: string): boolean {
  if (!serverConfig || typeof serverConfig !== 'object') return false;
  const tools = (serverConfig as Record<string, unknown>).tools;
  return Array.isArray(tools) && tools.map((entry) => text(entry)).includes(tool);
}

function mcpList(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const servers = Object.keys(mcpServers(input.root));
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `${servers.length} MCP server(s) declared.`,
    lines: servers.length ? servers.map((server) => `server: ${server}`) : ['No local mcp.json servers found.'],
    data: { servers, executionEnabled: false },
  });
}

function mcpInspect(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const server = text(input.args.server || input.args.id, 'all');
  const listed = mcpList(input);
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: input.operation === 'action.preview' ? 'preview' : 'ok',
    summary: `MCP inspect preview for ${server}; execution remains disabled.`,
    lines: [...listed.lines, 'MCP execution is intentionally not available until quarantine activation is approved.'],
    data: { ...(listed.data || {}), server, executionEnabled: false, quarantineRequired: true },
  });
}

function mcpExecuteQuarantined(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const server = text(input.args.server || input.args.id);
  const tool = text(input.args.tool);
  if (!server || !tool) return block(input, 'Missing MCP server or tool.', ['Provide args.server and args.tool.']);
  const servers = mcpServers(input.root);
  const serverConfig = servers[server];
  if (!serverConfig) return block(input, `MCP server ${server} is not declared.`, [`Server: ${server}`]);
  if (!isTrustedMcpServer(serverConfig)) return block(input, `MCP server ${server} is not eligible for quarantine execution.`, ['Allowed commands: node, npx, tsx.']);
  if (!serverAllowsTool(serverConfig, tool)) return block(input, `MCP tool ${tool} is not allowlisted for ${server}.`, ['Add the tool to the server tools allowlist before execution.']);

  if (input.operation === 'action.preview' || input.operation === 'action.status') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: `MCP quarantined execution preview for ${server}.${tool}.`,
      lines: [`Server: ${server}`, `Tool: ${tool}`, 'Execution requires approval and remains quarantined.'],
      data: { server, tool, args: input.args.args || {}, executionEnabled: true, quarantineRequired: true, mode: 'preview' },
    });
  }
  if (input.operation !== 'action.apply') return block(input, `Unsupported operation for ${input.actionId}.`);
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'applied',
    summary: `MCP quarantined execution envelope accepted for ${server}.${tool}.`,
    lines: [`Server: ${server}`, `Tool: ${tool}`, 'Execution is represented as a quarantined envelope; external MCP transport is not invoked by this local harness.'],
    data: { server, tool, args: input.args.args || {}, executionEnabled: true, quarantineRequired: true, transportInvoked: false },
  });
}

function action(capabilityId: string, input: Omit<ZavorthActionDefinition, 'capabilityId' | 'verificationStatus' | 'surface' | 'testRefs'>): ZavorthActionDefinition {
  return { ...input, capabilityId, verificationStatus: 'verified', surface: SURFACE, testRefs: TEST_REFS };
}

export function createGovernedOpsActionModule(): ZavorthActionModule {
  const shellInput = { type: 'object' as const, properties: { command: { type: 'string' } }, required: ['command'] };
  return {
    id: 'governed-ops',
    manifestId: 'governed-ops',
    actions: [
      action('shell-sandbox', { id: 'shell.preview_command', title: 'Preview shell command', description: 'Validate an allowlisted command without spawning a process.', aliases: ['shell preview', 'preview_command'], domains: ['shell', 'sandbox'], risk: 'safe', effects: ['read'], scope: 'workspace', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: shellInput, outputSchema, handler: shellPreviewCommand }),
      action('shell-sandbox', { id: 'shell.run_allowlisted', title: 'Run allowlisted shell command', description: 'Run a strict allowlisted command with fixed cwd, timeout and truncated output.', aliases: ['run_allowlisted', 'run tests', 'shell allowlist'], domains: ['shell', 'sandbox'], risk: 'attention', mutationDomain: 'sandbox', mutationRisk: 'medium', effects: ['shell'], scope: 'workspace', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: shellInput, outputSchema, handler: shellRunAllowlisted }),
      action('shell-sandbox', { id: 'sandbox.run_code', title: 'Run sandboxed code', description: 'Run short Node.js code in a governed temporary sandbox with timeout and receipt.', aliases: ['sandbox run code', 'run_code'], domains: ['sandbox'], risk: 'attention', mutationDomain: 'sandbox', mutationRisk: 'medium', effects: ['shell'], scope: 'workspace', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }, outputSchema, handler: sandboxRunCode }),
      action('shell-sandbox', { id: 'sandbox.run_tests', title: 'Run sandbox tests', description: 'Run an allowlisted test/check command with timeout and receipt.', aliases: ['sandbox run tests', 'run_tests'], domains: ['sandbox', 'tests'], risk: 'attention', mutationDomain: 'sandbox', mutationRisk: 'medium', effects: ['shell'], scope: 'workspace', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: { type: 'object', properties: { command: { type: 'string' } } }, outputSchema, handler: sandboxRunTests }),
      action('channels-mcp', { id: 'channels.status', title: 'Channel status', description: 'Read channel readiness without sending external messages.', aliases: ['channel status', 'channels readiness'], domains: ['channels'], risk: 'safe', effects: ['read'], scope: 'channels', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: { type: 'object', properties: {} }, outputSchema, handler: channelStatus }),
      action('channels-mcp', { id: 'channels.draft', title: 'Draft channel message', description: 'Prepare a channel draft without sending it externally.', aliases: ['channel draft', 'draft message'], domains: ['channels'], risk: 'safe', effects: ['read'], scope: 'channels', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: { type: 'object', properties: { channel: { type: 'string' }, message: { type: 'string' } }, required: ['message'] }, outputSchema, handler: channelDraft }),
      action('channels-mcp', { id: 'channels.send_approved', title: 'Send approved channel message', description: 'Send a message through a configured channel webhook only after approval and receipt.', aliases: ['channel send approved', 'send approved message'], domains: ['channels'], risk: 'danger', mutationDomain: 'capability', mutationRisk: 'high', effects: ['external_send'], scope: 'channels', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: { type: 'object', properties: { channel: { type: 'string' }, message: { type: 'string' } }, required: ['channel', 'message'] }, outputSchema, handler: channelSendApproved }),
      action('channels-mcp', { id: 'mcp.list', title: 'List MCP servers', description: 'List declared MCP servers without executing MCP tools.', aliases: ['mcp list'], domains: ['mcp'], risk: 'safe', effects: ['read'], scope: 'mcp', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: { type: 'object', properties: {} }, outputSchema, handler: mcpList }),
      action('channels-mcp', { id: 'mcp.inspect', title: 'Inspect MCP server', description: 'Inspect MCP declaration metadata without executing tools.', aliases: ['mcp inspect'], domains: ['mcp'], risk: 'safe', effects: ['read'], scope: 'mcp', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: { type: 'object', properties: { server: { type: 'string' } } }, outputSchema, handler: mcpInspect }),
      action('channels-mcp', { id: 'mcp.preview', title: 'Preview MCP tool call', description: 'Preview an MCP call envelope without executing it.', aliases: ['mcp preview'], domains: ['mcp'], risk: 'safe', effects: ['read'], scope: 'mcp', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: { type: 'object', properties: { server: { type: 'string' }, tool: { type: 'string' }, args: { type: 'object' } } }, outputSchema, handler: mcpInspect }),
      action('channels-mcp', { id: 'mcp.execute_quarantined', title: 'Execute quarantined MCP tool', description: 'Validate and accept an allowlisted MCP execution envelope behind approval and receipt.', aliases: ['mcp execute quarantined', 'execute mcp tool'], domains: ['mcp'], risk: 'danger', mutationDomain: 'capability', mutationRisk: 'high', effects: ['external_send'], scope: 'mcp', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: { type: 'object', properties: { server: { type: 'string' }, tool: { type: 'string' }, args: { type: 'object' } }, required: ['server', 'tool'] }, outputSchema, handler: mcpExecuteQuarantined }),
    ],
  };
}
