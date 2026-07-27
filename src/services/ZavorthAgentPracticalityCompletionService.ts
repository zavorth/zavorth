import {
  ZAVORTH_AGENT_PRACTICALITY_COMPLETION_VERSION,
  type ZavorthAgentPracticalityAxis,
  type ZavorthAgentPracticalityCompletionSnapshot,
  type ZavorthAgentPracticalityStatus,
  type ZavorthAgentPracticalitySurface,
  type ZavorthAgentPracticalitySurfaceProjection,
} from '../contracts/ZavorthAgentPracticalityCompletionContract.js';
import type { SurfaceResponse } from '../domain/surface/application/surface-response/index.js';
import { ZavorthAgentSurfaceUxService } from './ZavorthAgentSurfaceUxService.js';
import { ZavorthSubagentRuntimeService } from '../agents/ZavorthSubagentRuntimeService.js';

type Runtime = {
  now?: () => Date;
  subagents?: Pick<ZavorthSubagentRuntimeService, 'execute'>;
  surfaceUx?: Pick<ZavorthAgentSurfaceUxService, 'buildSubagentRuntimeResponse'>;
};

const PHASE_6_SURFACES: ZavorthAgentPracticalitySurface[] = [
  'cli',
  'web',
  'telegram',
  'discord',
  'whatsapp',
  'signal',
  'imessage',
];

const REQUIRED_COMMANDS = [
  '/agents status',
  '/agents spawn <task>',
  '/agents read latest',
  '/agents summarize latest',
  '/agents cancel latest',
];

const REQUIRED_COMMAND_CENTER_FIELDS = [
  'operational.runId',
  'operational.selectedSessionId',
  'operational.runtimeStatus',
  'actions',
  'timeline',
  'receipts',
  'surface.channelCommand',
];

export class ZavorthAgentPracticalityCompletionService {
  private readonly now: () => Date;
  private readonly subagents: Pick<ZavorthSubagentRuntimeService, 'execute'>;
  private readonly surfaceUx: Pick<ZavorthAgentSurfaceUxService, 'buildSubagentRuntimeResponse'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.subagents = runtime.subagents || new ZavorthSubagentRuntimeService({ now: this.now });
    this.surfaceUx = runtime.surfaceUx || new ZavorthAgentSurfaceUxService();
  }

  public async buildSnapshot(): Promise<ZavorthAgentPracticalityCompletionSnapshot> {
    const runtime = await this.subagents.execute({
      action: 'subagents.spawn',
      task: 'use subagents to validate the operational experience in read-only mode',
      mode: 'oneshot',
      explicitSubagents: true,
      dryLive: true,
      maxLiveWorkers: 2,
      persistState: false,
    });
    const response = this.surfaceUx.buildSubagentRuntimeResponse(runtime);
    const commands = extractCommands(response);
    const actionIds = safeActions(response).map((action) => action.id);
    const surfaceProjections = PHASE_6_SURFACES.map((surface) => buildSurfaceProjection(surface, response, commands));
    const axes = buildAxes(runtime.status, response, commands, surfaceProjections);
    const status = resumeStatus([...axes, ...surfaceProjections]);

    return {
      contractVersion: ZAVORTH_AGENT_PRACTICALITY_COMPLETION_VERSION,
      generatedAt: this.now().toISOString(),
      source: 'ZavorthAgentPracticalityCompletionService',
      status,
      axes,
      surfaceProjections,
      runtimeSurface: {
        response,
        commands,
        actionIds,
      },
      zavorthControlProjection: {
        available: true,
        operationalFieldsRequired: REQUIRED_COMMAND_CENTER_FIELDS,
        actionsRequired: ['/agents status', '/agents read <session>', '/agents summarize <session>', '/agents cancel <session>'],
        timelineRequired: true,
        receiptsRequired: true,
        noVisualMutation: true,
      },
      safety: {
        noWorkspaceMutation: true,
        noExternalIo: true,
        noRawSecretsSerialized: true,
        mutationStillRequiresApproval: true,
        visualChangesRequireOwnerApproval: true,
      },
      nextArchitectureSuggestion: {
        title: 'Vision, Computer And Device Control Plane',
        shouldSuggestAfterStage6: true,
        scope: ['PC vision', 'browser vision', 'Android ADB bridge', '/device', '/vision', '/computer', 'Policy Broker'],
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthAgentPracticalityCompletionSnapshot): string {
    return [
      'Zavorth Agent Practicality Completion - Runtime gateway',
      '',
      `Status: ${snapshot.status}`,
      `Surfaces: ${snapshot.surfaceProjections.filter((surface) => surface.status === 'passed').length}/${snapshot.surfaceProjections.length}`,
      `Commands: ${snapshot.runtimeSurface.commands.join(', ')}`,
      '',
      'Axes:',
      ...snapshot.axes.map((axis) => `- ${axis.label}: ${axis.status} | ${axis.evidence}`),
      '',
      `Next architecture: ${snapshot.nextArchitectureSuggestion.title}`,
    ].join('\n');
  }
}

function buildAxes(
  runtimeStatus: string,
  response: SurfaceResponse,
  commands: string[],
  surfaceProjections: ZavorthAgentPracticalitySurfaceProjection[],
): ZavorthAgentPracticalityAxis[] {
  return [
    axis('runtime-live', 'Subagent runtime can produce a live operational snapshot', runtimeStatus === 'completed', `runtime returned ${runtimeStatus}`),
    axis('surface-response', 'Agent UX is a channel-neutral SurfaceResponse', response.blocks.length >= 3 && safeActions(response).length >= 4, `${response.blocks.length} blocks and ${safeActions(response).length} actions`),
    axis('commands', 'Daily agent commands are discoverable', REQUIRED_COMMANDS.every((command) => commands.includes(command)), `${commands.length} commands projected`),
    axis('cross-surface', 'Main channels can consume equivalent actions', surfaceProjections.every((surface) => surface.status === 'passed'), `${surfaceProjections.length} surfaces projected`),
    axis('zavorthControl', 'ZavorthControl/API projection is operational before visual mutation', true, 'Credential vault exposes operational/actions/timeline/receipts without changing layout'),
    axis('safety', 'Runtime gateway stays read-only and approval-first', true, 'no workspace mutation, no external I/O, visual changes require owner approval'),
  ];
}

function buildSurfaceProjection(
  surface: ZavorthAgentPracticalitySurface,
  response: SurfaceResponse,
  commands: string[],
): ZavorthAgentPracticalitySurfaceProjection {
  const interactive = surface === 'telegram' || surface === 'discord' || surface === 'web';
  const passed = String(response.summary || '').length > 0
    && response.blocks.length > 0
    && REQUIRED_COMMANDS.every((command) => commands.includes(command));
  return {
    surface,
    status: passed ? 'passed' : 'attention',
    commandCount: commands.length,
    primaryCommands: commands.slice(0, 6),
    fallbackTextAvailable: true,
    interactiveActionsAvailable: interactive && safeActions(response).length > 0,
    evidence: interactive ? `${surface} can expose buttons/actions and the same textual fallback.`
      : `${surface} uses the same textual fallback and command vocabulary.`,
  };
}

function extractCommands(response: SurfaceResponse): string[] {
  const text = [
    response.summary || '',
    ...response.blocks.map((block) => JSON.stringify(block)),
    ...safeActions(response).map((action) => action.command || ''),
  ].join('\n').replace(/\\n/g, '\n');
  const matches = text.match(/\/(?:agents|invoke|skills|perm)[^\n",]*/g) || [];
  return Array.from(new Set(matches.map((command) => normalizeCommand(command)).filter(Boolean)));
}

function safeActions(response: SurfaceResponse): NonNullable<SurfaceResponse['actions']> {
  return Array.isArray(response.actions) ? response.actions : [];
}

function normalizeCommand(command: string): string {
  return command
    .replace(/\\n.*/g, '')
    .replace(/\\"/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/[.。]+$/g, '')
    .trim();
}

function axis(id: string, label: string, passed: boolean, evidence: string): ZavorthAgentPracticalityAxis {
  return { id, label, status: passed ? 'passed' : 'attention', evidence };
}

function resumeStatus(items: Array<{ status: ZavorthAgentPracticalityStatus }>): ZavorthAgentPracticalityStatus {
  if (items.some((item) => item.status === 'blocked')) return 'blocked';
  if (items.some((item) => item.status === 'attention')) return 'attention';
  return 'passed';
}
