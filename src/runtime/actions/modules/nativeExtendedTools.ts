import type {
  ZavorthActionDefinition,
  ZavorthActionHandlerInput,
  ZavorthActionModule,
  ZavorthActionResult,
  ZavorthActionSchema,
} from '../ZavorthActionContracts.js';
import { BatchTrajectoryTool } from '../../../tools/BatchTrajectoryTool.js';
import { CalendarTool } from '../../../tools/CalendarTool.js';
import { CodeReviewTool } from '../../../tools/CodeReviewTool.js';
import { DatabaseQueryTool } from '../../../tools/DatabaseQueryTool.js';
import { EmailTool } from '../../../tools/EmailTool.js';
import { KanbanTool } from '../../../tools/KanbanTool.js';
import { MultiBackendTerminalTool } from '../../../tools/MultiBackendTerminalTool.js';
import { SkillFeedbackCollectorTool } from '../../../tools/SkillFeedbackCollectorTool.js';
import { VideoGenerationTool } from '../../../tools/VideoGenerationTool.js';
import type { BaseTool } from '../../../tools/BaseTool.js';

const SURFACE: ZavorthActionDefinition['surface'] = ['cli', 'zavorthControl', 'tui', 'api', 'channel', 'llm'];
const TEST_REFS = [
  'tests/runtime/actions/ZavorthExtendedNativeToolActions.test.ts',
  'tests/tools/ExtendedToolRealExecution.test.ts',
];

const outputSchema: ZavorthActionSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    summary: { type: 'string' },
    output: { type: 'string' },
  },
};

function text(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function schema(properties: Record<string, unknown>, required: string[] = []): ZavorthActionSchema {
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
}

function preview(input: ZavorthActionHandlerInput, summary: string, data: Record<string, unknown>): ZavorthActionResult | null {
  if (input.operation !== 'action.preview' && input.operation !== 'action.status') {
    return null;
  }
  return {
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: input.operation === 'action.preview' ? 'preview' : 'ok',
    summary,
    lines: Object.entries(data).map(([key, value]) => `${key}: ${String(value).slice(0, 240)}`),
    data,
  };
}

async function runTool(input: ZavorthActionHandlerInput, tool: BaseTool, previewSummary: string): Promise<ZavorthActionResult> {
  const previewResult = preview(input, previewSummary, {
    tool: tool.name,
    argKeys: Object.keys(input.args).filter((key) => !/(pass|password|secret|token|api[_-]?key)/iu.test(key)),
    realExecution: input.operation === 'action.apply',
  });
  if (previewResult) return previewResult;

  if (input.operation !== 'action.apply') {
    return {
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: `Unsupported operation for ${input.actionId}.`,
      lines: [`Unsupported operation: ${input.operation}`],
    };
  }

  const output = await tool.execute({
    ...input.args,
    metadata: {
      sourceSurface: input.sourceSurface || 'action-harness',
      actorId: input.actorId || null,
      approvalId: input.approvalId || null,
      trustedOperatorConfirmation: input.trustedOperatorConfirmation === true,
    },
  });
  const failed = /^Erro:/iu.test(output) || /\b(blocked|bloquead|indisponivel|desabilitad)/iu.test(output);
  return {
    ok: !failed,
    actionId: input.actionId,
    operation: input.operation,
    status: failed ? 'blocked' : 'applied',
    summary: failed ? `${input.actionId} did not complete.` : `${input.actionId} completed.`,
    lines: output.split(/\r?\n/u).slice(0, 40),
    data: {
      tool: tool.name,
      output,
      rawSecretsSerialized: false,
    },
  };
}

function base(input: Omit<ZavorthActionDefinition, 'capabilityId' | 'verificationStatus' | 'surface' | 'testRefs'>): ZavorthActionDefinition {
  return {
    ...input,
    capabilityId: 'native-extended-tools',
    verificationStatus: 'verified',
    surface: SURFACE,
    testRefs: TEST_REFS,
  };
}

export function createNativeExtendedToolsActionModule(): ZavorthActionModule {
  const stringProp = { type: 'string' };
  return {
    id: 'native-extended-tools',
    manifestId: 'native-extended-tools',
    actions: [
      base({
        id: 'video.generate',
        title: 'Generate video',
        description: 'Generate video through a configured real video backend.',
        aliases: ['generate video', 'video generation', 'media video'],
        domains: ['video', 'media'],
        risk: 'attention',
        mutationDomain: 'capability',
        mutationRisk: 'medium',
        effects: ['network', 'external_send'],
        scope: 'media',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: schema({ prompt: stringProp, duration: { type: 'number' }, resolution: stringProp, fps: { type: 'number' }, style: stringProp, reference_image: stringProp }, ['prompt']),
        outputSchema,
        handler: (input) => runTool(input, new VideoGenerationTool(), `Video generation preview for "${text(input.args.prompt).slice(0, 80)}".`),
      }),
      base({
        id: 'kanban.board',
        title: 'Kanban board',
        description: 'Manage local Kanban boards through the native task board tool.',
        aliases: ['kanban board', 'task board', 'move card'],
        domains: ['kanban', 'tasks'],
        risk: 'attention',
        mutationDomain: 'capability',
        mutationRisk: 'medium',
        effects: ['write'],
        scope: 'tasks',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: schema({ action: stringProp, board_id: stringProp, card_id: stringProp, title: stringProp, description: stringProp, column: stringProp, assignee: stringProp, priority: stringProp }, ['action']),
        outputSchema,
        handler: (input) => runTool(input, new KanbanTool(), 'Kanban board operation preview.'),
      }),
      base({
        id: 'skills.feedback',
        title: 'Skill feedback',
        description: 'Record, review or optimize local skill feedback metrics.',
        aliases: ['skill feedback', 'skills metrics', 'optimize skill'],
        domains: ['skills', 'feedback'],
        risk: 'attention',
        mutationDomain: 'capability',
        mutationRisk: 'medium',
        effects: ['write'],
        scope: 'skills',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: schema({ skill_name: stringProp, action: stringProp, rating: { type: 'number' }, notes: stringProp, execution_time_ms: { type: 'number' } }, ['skill_name', 'action']),
        outputSchema,
        handler: (input) => runTool(input, new SkillFeedbackCollectorTool(), 'Skill feedback operation preview.'),
      }),
      base({
        id: 'trajectories.batch',
        title: 'Batch trajectories',
        description: 'Run multiple real LLM trajectories and compare their outputs.',
        aliases: ['batch trajectories', 'compare llm trajectories', 'multi provider compare'],
        domains: ['trajectories', 'providers', 'llm'],
        risk: 'attention',
        mutationDomain: 'capability',
        mutationRisk: 'medium',
        effects: ['network', 'external_send'],
        scope: 'providers',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: schema({ trajectories: { type: 'array' }, comparison_metric: stringProp, max_concurrent: { type: 'number' } }, ['trajectories']),
        outputSchema,
        handler: (input) => runTool(input, new BatchTrajectoryTool(), 'Batch trajectory execution preview.'),
      }),
      base({
        id: 'terminal.backend',
        title: 'Terminal backend',
        description: 'Execute an approved command through a selected terminal backend.',
        aliases: ['terminal backend', 'multi backend terminal', 'run powershell'],
        domains: ['terminal', 'shell'],
        risk: 'danger',
        mutationDomain: 'capability',
        mutationRisk: 'high',
        effects: ['shell'],
        scope: 'workspace',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: schema({ command: stringProp, backend: stringProp, working_directory: stringProp, timeout_ms: { type: 'number' } }, ['command']),
        outputSchema,
        handler: (input) => runTool(input, new MultiBackendTerminalTool(), 'Terminal backend command preview.'),
      }),
      base({
        id: 'email.smtp.send',
        title: 'Send SMTP email',
        description: 'Send email through a configured real SMTP transport.',
        aliases: ['send smtp email', 'send email', 'smtp mail'],
        domains: ['email', 'smtp'],
        risk: 'danger',
        mutationDomain: 'capability',
        mutationRisk: 'high',
        effects: ['external_send', 'network'],
        scope: 'email',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: schema({ to: stringProp, subject: stringProp, body: stringProp, cc: stringProp, bcc: stringProp, html: { type: 'boolean' }, attachments: stringProp }, ['to', 'subject', 'body']),
        outputSchema,
        handler: (input) => runTool(input, new EmailTool(), `SMTP email preview to ${text(input.args.to, '<missing>')}.`),
      }),
      base({
        id: 'calendar.local.event',
        title: 'Local calendar event',
        description: 'Manage local calendar events and iCal artifacts.',
        aliases: ['calendar event', 'local calendar', 'create event'],
        domains: ['calendar', 'tasks'],
        risk: 'attention',
        mutationDomain: 'capability',
        mutationRisk: 'medium',
        effects: ['write'],
        scope: 'calendar',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: schema({ action: stringProp, title: stringProp, start_time: stringProp, end_time: stringProp, event_id: stringProp, description: stringProp, location: stringProp, attendees: stringProp, reminder_minutes: { type: 'number' } }, ['action']),
        outputSchema,
        handler: (input) => runTool(input, new CalendarTool(), 'Local calendar operation preview.'),
      }),
      base({
        id: 'code.review',
        title: 'Code review',
        description: 'Run local static code review against a file or diff target.',
        aliases: ['code review', 'review code', 'static review'],
        domains: ['code', 'review'],
        risk: 'safe',
        effects: ['read'],
        scope: 'workspace',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: schema({ target: stringProp, focus: stringProp, severity_threshold: stringProp }, ['target']),
        outputSchema,
        handler: (input) => runTool(input, new CodeReviewTool(), 'Code review preview.'),
      }),
      base({
        id: 'database.sqlite.query',
        title: 'SQLite database query',
        description: 'Execute a governed local SQLite query with explicit approval.',
        aliases: ['sqlite query', 'database query', 'query database'],
        domains: ['database', 'sqlite'],
        risk: 'danger',
        mutationDomain: 'capability',
        mutationRisk: 'high',
        effects: ['read', 'write'],
        scope: 'database',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: schema({ query: stringProp, database_path: stringProp, mode: stringProp, max_rows: { type: 'number' } }, ['query']),
        outputSchema,
        handler: (input) => runTool(input, new DatabaseQueryTool(), 'SQLite query preview.'),
      }),
    ],
  };
}
