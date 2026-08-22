import type {
  ZavorthActionDefinition,
  ZavorthActionHandlerInput,
  ZavorthActionModule,
  ZavorthActionResult,
  ZavorthActionSchema,
} from '../ZavorthActionContracts.js';
import {
  ZavorthPersonalOpsRuntimeService,
  type ZavorthPersonalOpsOperation,
} from '../../../services/ZavorthPersonalOpsRuntimeService.js';
import { ZavorthWorkspaceMemoryOsService, type ZavorthMemoryReviewAction } from '../../../services/ZavorthWorkspaceMemoryOsService.js';


import { MemoryService } from '../../../services/MemoryService.js';
import { ZavorthNativePowerPackService } from '../../../services/ZavorthNativePowerPackService.js';
import { SystemScreenshotTool } from '../../../tool-runtime/tools/os/SystemScreenshotTool.js';
import { SystemVisionAnalysisTool } from '../../../tool-runtime/tools/os/SystemVisionAnalysisTool.js';
import { SystemMediaTool } from '../../../tool-runtime/tools/os/SystemMediaTool.js';

const SURFACE: ZavorthActionDefinition['surface'] = ['cli', 'zavorthControl', 'tui', 'api', 'channel', 'llm'];
const TEST_REFS = [
  'tests/services/ZavorthNativePowerPackService.test.ts',
  'tests/runtime/actions/ZavorthNativePowerPackActions.test.ts',
];

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

function service(root: string): ZavorthNativePowerPackService {
  return new ZavorthNativePowerPackService({ projectRoot: root });
}

function previewOnly(input: ZavorthActionHandlerInput, summary: string, data: Record<string, unknown>): ZavorthActionResult | null {
  if (input.operation === 'action.preview' || input.operation === 'action.status') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary,
      lines: Object.entries(data).slice(0, 8).map(([key, value]) => `${key}: ${String(value).slice(0, 240)}`),
      data,
    });
  }
  return null;
}

function googleStatus(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const snapshot = service(input.root).googleWorkspaceStatus();
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `Google Workspace native pack is ${snapshot.status}.`,
    lines: snapshot.actions.map((action) => `${action}: approval-gated personal operation`),
    data: { snapshot },
  });
}

function mediaStatus(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const snapshot = service(input.root).mediaStatus();
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `Media native pack is ${snapshot.status}.`,
    lines: snapshot.actions,
    data: { snapshot },
  });
}

function iotStatus(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const snapshot = service(input.root).iotStatus();
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `Device/IoT native pack is ${snapshot.status}.`,
    lines: [`Connectors: ${snapshot.summary.configuredConnectors}`, ...snapshot.actions],
    data: { snapshot },
  });
}

async function personalOps(input: ZavorthActionHandlerInput, operation: ZavorthPersonalOpsOperation, fallbackConnectorId: string): Promise<ZavorthActionResult> {
  const connectorId = text(input.args.connectorId, fallbackConnectorId);
  const preview = previewOnly(input, `Personal operation preview for ${operation}.`, {
    operation,
    connectorId,
    payloadKeys: Object.keys(input.args).filter((key) => !/body|text|token|secret|password/i.test(key)),
    externalPersonalData: true,
  });
  if (preview) return preview;
  if (input.operation !== 'action.apply') return block(input, `Unsupported operation for ${input.actionId}.`);
  const runtime = new ZavorthPersonalOpsRuntimeService();
  const executed = await runtime.executeOperation({
    operation,
    connectorId,
    payload: input.args,
    approved: input.trustedOperatorConfirmation === true,
    approvalId: input.approvalId || 'action-harness-approved',
    profile: 'personal',
  });
  return result({
    ok: executed.ok,
    actionId: input.actionId,
    operation: input.operation,
    status: executed.ok ? 'applied' : 'blocked',
    summary: executed.receipt.summary,
    lines: [
      `Operation: ${operation}`,
      `Connector: ${connectorId}`,
      `Status: ${executed.status}`,
      executed.error ? `Error: ${executed.error}` : 'Personal operation returned a governed receipt.',
    ],
    data: { receipt: executed.receipt, result: executed.result },
  });
}

async function driveSearch(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const query = text(input.args.query || input.args.q);
  const preview = previewOnly(input, 'Google Drive search preview.', { query, personalDataRead: true });
  if (preview) return preview;
  if (input.operation !== 'action.apply') return block(input, `Unsupported operation for ${input.actionId}.`);
  const data = await service(input.root).driveSearch({ query, pageSize: Number(input.args.pageSize || input.args.limit || 10) });
  return result({
    ok: data.ok === true,
    actionId: input.actionId,
    operation: input.operation,
    status: data.ok === true ? 'applied' : 'blocked',
    summary: String(data.summary || 'Google Drive search finished.'),
    lines: Array.isArray(data.files) ? data.files.map((file: any) => `${file.name || file.id}: ${file.mimeType || 'unknown'}`) : [String(data.summary || '')], // eslint-disable-line @typescript-eslint/no-explicit-any
    data,
  });
}

async function driveReadFile(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const fileId = text(input.args.fileId || input.args.id);
  const preview = previewOnly(input, 'Google Drive file metadata preview.', { fileId, personalDataRead: true });
  if (preview) return preview;
  if (input.operation !== 'action.apply') return block(input, `Unsupported operation for ${input.actionId}.`);
  const data = await service(input.root).driveReadFile({ fileId });
  return result({
    ok: data.ok === true,
    actionId: input.actionId,
    operation: input.operation,
    status: data.ok === true ? 'applied' : 'blocked',
    summary: String(data.summary || 'Google Drive file read finished.'),
    lines: [String(data.summary || '')],
    data,
  });
}

async function memoryReview(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const memory = new ZavorthWorkspaceMemoryOsService();
  const snapshot = await memory.buildReview({
    userId: text(input.args.userId || input.actorId, ''),
    sessionId: text(input.args.sessionId, ''),
    workspaceHint: text(input.args.workspaceHint || input.root),
    query: text(input.args.query, ''),
    limit: Number(input.args.limit || 24),
  });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `Deep memory review has ${snapshot.review.total} review entrie(s).`,
    lines: snapshot.review.entries.slice(0, 12).map((entry) => `${entry.key}: ${entry.valuePreview}`),
    data: { snapshot },
  });
}

async function memoryResolve(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const query = text(input.args.query || input.args.text || input.args.input);
  if (!query) return block(input, 'Missing memory follow-up text.', ['Provide args.query.']);
  const memory = new ZavorthWorkspaceMemoryOsService();
  const resolution = await memory.resolveFollowUp(query, {
    userId: text(input.args.userId || input.actorId, ''),
    sessionId: text(input.args.sessionId, ''),
    workspaceHint: text(input.args.workspaceHint || input.root),
  });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: resolution.reason,
    lines: resolution.evidence,
    data: { resolution },
  });
}

async function memoryMutate(input: ZavorthActionHandlerInput, action: ZavorthMemoryReviewAction): Promise<ZavorthActionResult> {
  const key = text(input.args.key);
  if (!key) return block(input, 'Missing memory key.', ['Provide args.key.']);
  const preview = previewOnly(input, `Deep memory ${action} preview.`, { key, action, userId: text(input.args.userId || input.actorId, 'local-user') });
  if (preview) return preview;
  if (input.operation !== 'action.apply') return block(input, `Unsupported operation for ${input.actionId}.`);
  const memory = new ZavorthWorkspaceMemoryOsService({ memoryService: new MemoryService() });
  const applied = await memory.executeAction({
    action,
    key,
    value: text(input.args.value, ''),
    category: text(input.args.category, 'preference'),
    userId: text(input.args.userId || input.actorId, 'local-user'),
    sessionId: text(input.args.sessionId, ''),
    workspaceHint: text(input.args.workspaceHint || input.root),
  });
  return result({
    ok: applied.ok,
    actionId: input.actionId,
    operation: input.operation,
    status: applied.ok ? 'applied' : 'blocked',
    summary: applied.summary,
    lines: [`Action: ${action}`, `Key: ${key}`, `Status: ${applied.status}`],
    data: { result: applied },
  });
}

function documentsExtract(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const extracted = service(input.root).extractDocument({
    filePath: text(input.args.filePath || input.args.path),
    maxChars: Number(input.args.maxChars || 4000),
  });
  return result({
    ok: extracted.ok,
    actionId: input.actionId,
    operation: input.operation,
    status: extracted.ok ? 'ok' : 'blocked',
    summary: extracted.summary,
    lines: [extracted.file, extracted.textPreview.slice(0, 500)].filter(Boolean),
    data: extracted as unknown as Record<string, unknown>,
  });
}

function wikiSearch(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const searched = service(input.root).searchWiki({ query: text(input.args.query || input.args.q), limit: Number(input.args.limit || 8) });
  return result({
    ok: searched.ok,
    actionId: input.actionId,
    operation: input.operation,
    status: searched.ok ? 'ok' : 'blocked',
    summary: searched.summary,
    lines: searched.hits.map((hit) => `${hit.file}: ${hit.snippet}`),
    data: searched as unknown as Record<string, unknown>,
  });
}

function mediaImageGenerate(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const prompt = text(input.args.prompt);
  if (!prompt) return block(input, 'Missing image prompt.', ['Provide args.prompt.']);
  const preview = previewOnly(input, 'Media image generation preview.', { promptPreview: prompt.slice(0, 240), style: text(input.args.style, 'native') });
  if (preview) return preview;
  const artifact = service(input.root).generateImageArtifact({ prompt, style: text(input.args.style, 'native') });
  return artifactResult(input, artifact);
}

function mediaSpeechSynthesize(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const speechText = text(input.args.text || input.args.message);
  if (!speechText) return block(input, 'Missing speech text.', ['Provide args.text.']);
  const preview = previewOnly(input, 'Speech synthesis preview.', { textPreview: speechText.slice(0, 240), voice: text(input.args.voice, 'default') });
  if (preview) return preview;
  const artifact = service(input.root).synthesizeSpeechArtifact({ text: speechText, voice: text(input.args.voice, 'default') });
  return artifactResult(input, artifact);
}

function mediaImageAnalyze(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const filePath = text(input.args.filePath || input.args.path);
  if (!filePath) return block(input, 'Missing image path.', ['Provide args.filePath.']);
  const preview = previewOnly(input, 'Image analysis preview.', { filePath, rawBytesSerialized: false });
  if (preview) return preview;
  const analysis = service(input.root).analyzeImage({ filePath });
  return result({
    ok: analysis.ok,
    actionId: input.actionId,
    operation: input.operation,
    status: analysis.ok ? 'applied' : 'blocked',
    summary: analysis.summary,
    lines: [`File: ${analysis.file}`, `Mime: ${analysis.mimeType}`, `Bytes: ${analysis.bytes}`],
    data: analysis as unknown as Record<string, unknown>,
  });
}

function canvasRender(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const content = text(input.args.content || input.args.markdown || input.args.text);
  if (!content) return block(input, 'Missing canvas content.', ['Provide args.content.']);
  const preview = previewOnly(input, 'Canvas render preview.', { title: text(input.args.title, 'Zavorth Canvas'), contentPreview: content.slice(0, 240) });
  if (preview) return preview;
  return artifactResult(input, service(input.root).renderCanvas({ title: text(input.args.title, 'Zavorth Canvas'), content }));
}

async function computerScreenshot(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const preview = previewOnly(input, 'Computer screenshot preview.', { mode: text(input.args.mode, 'fullscreen'), localScreenCapture: true });
  if (preview) return preview;
  const executed = await new SystemScreenshotTool().execute({
    mode: text(input.args.mode, 'fullscreen') as 'fullscreen' | 'active_window',
    returnBase64: input.args.includeBase64 === true,
    savePath: text(input.args.outputPath, ''),
  });
  return toolResult(input, executed, 'Computer screenshot');
}

async function computerVision(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const preview = previewOnly(input, 'Computer vision preview.', { task: text(input.args.task || input.args.prompt, 'describe screen'), localScreenCapture: true });
  if (preview) return preview;
  const executed = await new SystemVisionAnalysisTool().execute({
    question: text(input.args.task || input.args.prompt, 'describe screen'),
    mode: text(input.args.mode, 'active_window') as 'fullscreen' | 'active_window',
    returnBase64: input.args.includeImage === true,
    savePath: text(input.args.outputPath, ''),
  });
  return toolResult(input, executed, 'Computer vision');
}

async function computerMediaControl(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const actionName = text(input.args.action, 'play_pause');
  const preview = previewOnly(input, 'Computer media control preview.', { action: actionName, value: input.args.value ?? null });
  if (preview) return preview;
  const executed = await new SystemMediaTool().execute({ action: actionName, value: Number(input.args.value || 0) });
  return toolResult(input, executed, 'Computer media control');
}

async function iotMqttPublish(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const topic = text(input.args.topic);
  const message = text(input.args.message || input.args.payload);
  if (!topic || !message) return block(input, 'Missing MQTT topic or message.', ['Provide args.topic and args.message.']);
  const preview = previewOnly(input, 'MQTT publish preview.', { topic, messagePreview: message.slice(0, 240), externalSend: true });
  if (preview) return preview;
  const published = await service(input.root).mqttPublish({ topic, message });
  return result({
    ok: published.ok === true,
    actionId: input.actionId,
    operation: input.operation,
    status: published.ok === true ? 'applied' : 'blocked',
    summary: String(published.summary || 'MQTT publish finished.'),
    lines: [String(published.summary || '')],
    data: published,
  });
}

function artifactResult(input: ZavorthActionHandlerInput, artifact: { ok: boolean; status: string; summary: string; artifactPath: string; bytes: number; format: string }): ZavorthActionResult {
  return result({
    ok: artifact.ok,
    actionId: input.actionId,
    operation: input.operation,
    status: artifact.ok ? 'applied' : 'blocked',
    summary: artifact.summary,
    lines: artifact.ok ? [`Artifact: ${artifact.artifactPath}`, `Format: ${artifact.format}`, `Bytes: ${artifact.bytes}`] : [artifact.summary],
    data: artifact as unknown as Record<string, unknown>,
    ...(artifact.ok ? {
      receipt: {
        id: `native-power-pack-${input.actionId.replace(/[^a-z0-9]+/giu, '-')}-${Date.now()}`,
        actionId: input.actionId,
        operation: input.operation,
        status: 'applied' as const,
        createdAt: new Date().toISOString(),
        sourceSurface: input.sourceSurface || null,
        actorId: input.actorId || null,
        summary: artifact.summary,
        data: {
          artifactPath: artifact.artifactPath,
          bytes: artifact.bytes,
          format: artifact.format,
          rawSecretsSerialized: false,
        },
      },
    } : {}),
  });
}

function toolResult(input: ZavorthActionHandlerInput, executed: { success: boolean; message?: string; data?: unknown; error?: string }, label: string): ZavorthActionResult {
  return result({
    ok: executed.success === true,
    actionId: input.actionId,
    operation: input.operation,
    status: executed.success === true ? 'applied' : 'blocked',
    summary: executed.success === true ? `${label} applied.` : `${label} failed.`,
    lines: [executed.message || executed.error || 'No tool message.'],
    data: { data: executed.data || null, error: executed.error || null },
  });
}

function schema(properties: Record<string, unknown>, required: string[] = []): ZavorthActionSchema {
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
}

function base(
  capabilityId: string,
  input: Omit<ZavorthActionDefinition, 'capabilityId' | 'verificationStatus' | 'surface' | 'testRefs'>,
): ZavorthActionDefinition {
  return {
    ...input,
    capabilityId,
    verificationStatus: 'verified',
    surface: SURFACE,
    testRefs: TEST_REFS,
  };
}

export function createNativePowerPacksActionModule(): ZavorthActionModule {
  const stringProp = { type: 'string' };
  return {
    id: 'native-power-packs',
    manifestId: 'native-power-packs',
    actions: [
      base('native-google-workspace', { id: 'google.workspace.status', title: 'Google Workspace status', description: 'Inspect native Google/Gmail/Drive/Calendar/Tasks readiness without serializing secrets.', aliases: ['google workspace status', 'gmail status', 'google tools'], domains: ['google', 'gmail', 'drive', 'calendar'], risk: 'safe', effects: ['read'], scope: 'google-workspace', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: schema({}), outputSchema, handler: googleStatus }),
      base('native-google-workspace', { id: 'gmail.search', title: 'Gmail search', description: 'Search Gmail through the governed Personal Ops connector.', aliases: ['gmail search', 'search email', 'google mail search'], domains: ['google', 'gmail', 'email'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['read', 'network'], scope: 'gmail', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ query: stringProp, connectorId: stringProp, maxResults: { type: 'number' } }), outputSchema, handler: (input) => personalOps(input, 'email.read', 'email:google') }),
      base('native-google-workspace', { id: 'gmail.draft', title: 'Gmail draft', description: 'Create a Gmail draft through the governed Personal Ops connector.', aliases: ['gmail draft', 'draft email'], domains: ['google', 'gmail', 'email'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['write', 'network'], scope: 'gmail', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ to: stringProp, subject: stringProp, body: stringProp, connectorId: stringProp }, ['to', 'subject']), outputSchema, handler: (input) => personalOps(input, 'email.draft', 'email:google') }),
      base('native-google-workspace', { id: 'gmail.send', title: 'Gmail send', description: 'Send Gmail through the governed Personal Ops connector.', aliases: ['gmail send', 'send email'], domains: ['google', 'gmail', 'email'], risk: 'danger', mutationDomain: 'capability', mutationRisk: 'high', effects: ['external_send', 'network'], scope: 'gmail', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ to: stringProp, subject: stringProp, body: stringProp, connectorId: stringProp }, ['to', 'subject', 'body']), outputSchema, handler: (input) => personalOps(input, 'email.send', 'email:google') }),
      base('native-google-workspace', { id: 'google.drive.search', title: 'Google Drive search', description: 'Search Google Drive metadata with governed approval.', aliases: ['google drive search', 'drive search'], domains: ['google', 'drive'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['read', 'network'], scope: 'google-drive', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ query: stringProp, pageSize: { type: 'number' } }), outputSchema, handler: driveSearch }),
      base('native-google-workspace', { id: 'google.drive.read_file', title: 'Google Drive read file', description: 'Read Google Drive file metadata through the native Google pack.', aliases: ['google drive read', 'drive read file'], domains: ['google', 'drive'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['read', 'network'], scope: 'google-drive', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ fileId: stringProp }, ['fileId']), outputSchema, handler: driveReadFile }),
      base('native-google-workspace', { id: 'google.calendar.list', title: 'Google Calendar list', description: 'List Google Calendar events through Personal Ops.', aliases: ['calendar list', 'google calendar list'], domains: ['google', 'calendar'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['read', 'network'], scope: 'google-calendar', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ calendarId: stringProp, timeMin: stringProp, timeMax: stringProp, connectorId: stringProp }), outputSchema, handler: (input) => personalOps(input, 'calendar.read', 'calendar:google') }),
      base('native-google-workspace', { id: 'google.calendar.create', title: 'Google Calendar create', description: 'Create Google Calendar events through Personal Ops.', aliases: ['calendar create', 'create calendar event'], domains: ['google', 'calendar'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['write', 'network'], scope: 'google-calendar', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ title: stringProp, startsAt: stringProp, endsAt: stringProp, connectorId: stringProp }, ['title', 'startsAt', 'endsAt']), outputSchema, handler: (input) => personalOps(input, 'calendar.create-event', 'calendar:google') }),
      base('native-google-workspace', { id: 'google.calendar.update', title: 'Google Calendar update', description: 'Update Google Calendar events through Personal Ops.', aliases: ['calendar update', 'update calendar event'], domains: ['google', 'calendar'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['write', 'network'], scope: 'google-calendar', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ eventId: stringProp, title: stringProp, connectorId: stringProp }, ['eventId']), outputSchema, handler: (input) => personalOps(input, 'calendar.update-event', 'calendar:google') }),
      base('native-google-workspace', { id: 'google.tasks.list', title: 'Google Tasks list', description: 'List Google Tasks through Personal Ops.', aliases: ['google tasks list', 'tasks list'], domains: ['google', 'tasks'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['read', 'network'], scope: 'google-tasks', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ taskListId: stringProp, connectorId: stringProp }), outputSchema, handler: (input) => personalOps(input, 'task.read', 'task:google') }),
      base('native-google-workspace', { id: 'google.tasks.create', title: 'Google Tasks create', description: 'Create Google Tasks through Personal Ops.', aliases: ['google tasks create', 'create task'], domains: ['google', 'tasks'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['write', 'network'], scope: 'google-tasks', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ title: stringProp, notes: stringProp, connectorId: stringProp }, ['title']), outputSchema, handler: (input) => personalOps(input, 'task.create', 'task:google') }),
      base('native-google-workspace', { id: 'google.tasks.update', title: 'Google Tasks update', description: 'Update Google Tasks through Personal Ops.', aliases: ['google tasks update', 'update task'], domains: ['google', 'tasks'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['write', 'network'], scope: 'google-tasks', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ taskId: stringProp, title: stringProp, connectorId: stringProp }, ['taskId']), outputSchema, handler: (input) => personalOps(input, 'task.update', 'task:google') }),
      base('native-media', { id: 'media.status', title: 'Media status', description: 'Inspect native media generation and understanding readiness.', aliases: ['media status'], domains: ['media'], risk: 'safe', effects: ['read'], scope: 'media', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: schema({}), outputSchema, handler: mediaStatus }),
      base('native-media', { id: 'media.image.generate', title: 'Generate image artifact', description: 'Generate a local governed SVG image artifact from a prompt.', aliases: ['image generate', 'generate image', 'media image'], domains: ['media', 'image'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['write'], scope: 'media', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ prompt: stringProp, style: stringProp }, ['prompt']), outputSchema, handler: mediaImageGenerate }),
      base('native-media', { id: 'media.image.analyze', title: 'Analyze image', description: 'Analyze local image metadata without serializing raw image bytes.', aliases: ['image analyze', 'vision analyze image'], domains: ['media', 'vision'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['read'], scope: 'media', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ filePath: stringProp }, ['filePath']), outputSchema, handler: mediaImageAnalyze }),
      base('native-media', { id: 'media.speech.synthesize', title: 'Synthesize speech artifact', description: 'Create a governed speech synthesis artifact or plan for configured TTS adapters.', aliases: ['text to speech', 'tts synthesize', 'speech synthesize'], domains: ['media', 'speech'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['write'], scope: 'media', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ text: stringProp, voice: stringProp }, ['text']), outputSchema, handler: mediaSpeechSynthesize }),
      base('native-deep-memory', { id: 'memory.deep.review', title: 'Deep memory review', description: 'Review workspace, preference, session and procedural memory surfaces.', aliases: ['deep memory review', 'memory review'], domains: ['memory'], risk: 'safe', effects: ['read'], scope: 'memory', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: schema({ userId: stringProp, query: stringProp, workspaceHint: stringProp, limit: { type: 'number' } }), outputSchema, handler: memoryReview }),
      base('native-deep-memory', { id: 'memory.deep.resolve', title: 'Resolve memory follow-up', description: 'Resolve follow-up references such as continue, same folder or send again.', aliases: ['memory resolve', 'resolve follow up'], domains: ['memory'], risk: 'safe', effects: ['read'], scope: 'memory', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: schema({ query: stringProp, userId: stringProp, workspaceHint: stringProp }, ['query']), outputSchema, handler: memoryResolve }),
      base('native-deep-memory', { id: 'memory.deep.correct', title: 'Correct deep memory', description: 'Correct a memory entry with approval and receipt.', aliases: ['memory correct', 'correct memory'], domains: ['memory'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['write'], scope: 'memory', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ userId: stringProp, key: stringProp, value: stringProp, category: stringProp }, ['key', 'value']), outputSchema, handler: (input) => memoryMutate(input, 'correct') }),
      base('native-deep-memory', { id: 'memory.deep.forget', title: 'Forget deep memory', description: 'Forget a memory entry with approval and receipt.', aliases: ['memory forget deep', 'forget memory'], domains: ['memory'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['write'], scope: 'memory', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ userId: stringProp, key: stringProp }, ['key']), outputSchema, handler: (input) => memoryMutate(input, 'forget') }),
      base('native-knowledge-canvas', { id: 'documents.extract', title: 'Extract document', description: 'Extract text from a local workspace document with path confinement.', aliases: ['document extract', 'extract document'], domains: ['documents', 'knowledge'], risk: 'safe', effects: ['read'], scope: 'documents', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: schema({ filePath: stringProp, maxChars: { type: 'number' } }, ['filePath']), outputSchema, handler: documentsExtract }),
      base('native-knowledge-canvas', { id: 'wiki.search', title: 'Search local wiki', description: 'Search local docs/wiki/readme sources inside the workspace.', aliases: ['wiki search', 'search docs'], domains: ['wiki', 'documents', 'knowledge'], risk: 'safe', effects: ['read'], scope: 'documents', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: schema({ query: stringProp, limit: { type: 'number' } }, ['query']), outputSchema, handler: wikiSearch }),
      base('native-knowledge-canvas', { id: 'canvas.render', title: 'Render canvas', description: 'Render a governed local HTML canvas artifact.', aliases: ['canvas render', 'render canvas'], domains: ['canvas', 'media'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['write'], scope: 'canvas', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ title: stringProp, content: stringProp }, ['content']), outputSchema, handler: canvasRender }),
      base('native-device-computer', { id: 'computer.screenshot', title: 'Computer screenshot', description: 'Capture a local computer screenshot through Echo OS tooling.', aliases: ['computer screenshot', 'screen capture'], domains: ['computer', 'device'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['read'], scope: 'computer', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ mode: stringProp, includeBase64: { type: 'boolean' }, outputPath: stringProp }), outputSchema, handler: computerScreenshot }),
      base('native-device-computer', { id: 'computer.vision', title: 'Computer vision', description: 'Analyze the local screen through Echo vision tooling.', aliases: ['computer vision', 'screen vision'], domains: ['computer', 'vision'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['read'], scope: 'computer', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ task: stringProp, mode: stringProp, includeImage: { type: 'boolean' }, outputPath: stringProp }), outputSchema, handler: computerVision }),
      base('native-device-computer', { id: 'computer.media_control', title: 'Computer media control', description: 'Control local media keys through Echo OS tooling.', aliases: ['computer media control', 'pause music', 'volume control'], domains: ['computer', 'os'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['external_send'], scope: 'computer', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ action: stringProp, value: { type: 'number' } }, ['action']), outputSchema, handler: computerMediaControl }),
      base('native-device-computer', { id: 'devices.iot.status', title: 'Device IoT status', description: 'Inspect IoT bridge readiness without sending device commands.', aliases: ['iot status', 'device status'], domains: ['devices', 'iot'], risk: 'safe', effects: ['read'], scope: 'devices', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: schema({}), outputSchema, handler: iotStatus }),
      base('native-device-computer', { id: 'devices.iot.mqtt_publish', title: 'Publish MQTT message', description: 'Publish an MQTT message through a configured bridge with approval.', aliases: ['mqtt publish', 'iot publish'], domains: ['devices', 'iot'], risk: 'danger', mutationDomain: 'capability', mutationRisk: 'high', effects: ['external_send', 'network'], scope: 'devices', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ topic: stringProp, message: stringProp }, ['topic', 'message']), outputSchema, handler: iotMqttPublish }),
    ],
  };
}
