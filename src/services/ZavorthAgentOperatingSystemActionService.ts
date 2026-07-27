import {
  ZavorthAgentOperatingSystemService,
  type ZavorthAgentOperatingSystemSnapshot,
} from './ZavorthAgentOperatingSystemService.js';
import type {
  ZavorthCapabilityCatalogService,
  ZavorthCapabilityCatalogSnapshot,
} from './ZavorthCapabilityCatalogService.js';
import {
  ZavorthTeamCatalogService,
  type ZavorthTeamCatalogSnapshot,
} from './ZavorthTeamCatalogService.js';

type WorkflowControllerLike = {
  handleWorkflow: (ctx: any, args: string) => Promise<void>;
};

type AgentOperatingSystemLike = Pick<ZavorthAgentOperatingSystemService, 'buildSnapshot'>;
type TeamCatalogLike = Pick<ZavorthTeamCatalogService, 'buildSnapshot'>;
type CapabilityCatalogLike = Pick<ZavorthCapabilityCatalogService, 'buildSnapshot'>;

export type ZavorthAgentOperatingSystemActionInput = {
  actionId: 'start_loop' | 'resume_loop';
  teamId?: string | null;
  objective?: string | null;
  featureId?: string | null;
  workflowRunId?: string | null;
  resumeStageId?: string | null;
  workspace?: string | null;
  runtimeUserId?: string | null;
};

export type ZavorthAgentOperatingSystemActionResult = {
  status: 'started';
  actionId: 'start_loop' | 'resume_loop';
  teamId: string | null;
  workflowRunId: string | null;
  command: string;
  note: string;
  replies: string[];
};

type ZavorthAgentOperatingSystemActionRuntime = {
  workflowController: WorkflowControllerLike | null;
  agentOperatingSystemService?: AgentOperatingSystemLike;
  teamCatalogService?: TeamCatalogLike;
  capabilityCatalogService?: CapabilityCatalogLike | null;
};

export class ZavorthAgentOperatingSystemActionService {
  private readonly workflowController: WorkflowControllerLike | null;
  private readonly agentOperatingSystemService: AgentOperatingSystemLike;
  private readonly teamCatalogService: TeamCatalogLike;
  private readonly capabilityCatalogService: CapabilityCatalogLike | null;

  constructor(runtime: ZavorthAgentOperatingSystemActionRuntime) {
    this.workflowController = runtime.workflowController || null;
    this.teamCatalogService = runtime.teamCatalogService || new ZavorthTeamCatalogService();
    this.agentOperatingSystemService =
      runtime.agentOperatingSystemService ||
      new ZavorthAgentOperatingSystemService({
        teamCatalogService: this.teamCatalogService,
      });
    this.capabilityCatalogService = runtime.capabilityCatalogService || null;
  }

  public execute(input: ZavorthAgentOperatingSystemActionInput): Promise<{
    action: ZavorthAgentOperatingSystemActionResult;
    agentOs: ZavorthAgentOperatingSystemSnapshot;
    teams: ZavorthTeamCatalogSnapshot;
    capabilities: ZavorthCapabilityCatalogSnapshot | null;
  }> {
    if (!this.workflowController) {
      throw new Error('Workflow controller is unavailable for Agent OS.');
    }

    const actionId = input.actionId;
    if (actionId === 'resume_loop') {
      return this.resumeLoop(input);
    }

    return this.startLoop(input);
  }

  private async startLoop(input: ZavorthAgentOperatingSystemActionInput): Promise<{
    action: ZavorthAgentOperatingSystemActionResult;
    agentOs: ZavorthAgentOperatingSystemSnapshot;
    teams: ZavorthTeamCatalogSnapshot;
    capabilities: ZavorthCapabilityCatalogSnapshot | null;
  }> {
    const teamId = String(input.teamId || '').trim().toLowerCase();
    if (!teamId) {
      throw new Error('teamId is required to start a loop.');
    }

    const knownTeam = this.findTeam(teamId, input.workspace || null);
    if (!knownTeam) {
      throw new Error(`Team ${teamId} does not exist in the limited Agent OS yet.`);
    }

    const objective = String(input.objective || '').trim();
    const featureId = String(input.featureId || '').trim();
    const loopTarget = teamId === 'sdd' ? (featureId || objective) : objective;
    if (!loopTarget) {
      throw new Error(teamId === 'sdd'
        ? 'featureId is required to start the SDD loop.'
        : `Objective is required to start the ${teamId} loop.`);
    }

    const args = `${teamId} ${loopTarget}`.trim();
    const replies = await this.runWorkflowCommand(args, input.runtimeUserId || null);
    const note = teamId === 'sdd'
      ? `SDD loop started for ${loopTarget}.`
      : `${teamId} loop started with the provided objective.`;

    return this.buildResponse({
      status: 'started',
      actionId: 'start_loop',
      teamId,
      workflowRunId: null,
      command: `/workflow ${args}`,
      note,
      replies,
    }, input.workspace || null);
  }

  private async resumeLoop(input: ZavorthAgentOperatingSystemActionInput): Promise<{
    action: ZavorthAgentOperatingSystemActionResult;
    agentOs: ZavorthAgentOperatingSystemSnapshot;
    teams: ZavorthTeamCatalogSnapshot;
    capabilities: ZavorthCapabilityCatalogSnapshot | null;
  }> {
    const workflowRunId = String(input.workflowRunId || '').trim();
    if (!workflowRunId) {
      throw new Error('workflowRunId is required to resume a loop.');
    }

    const resumeStageId = String(input.resumeStageId || '').trim();
    const args = ['resume', workflowRunId, resumeStageId].filter(Boolean).join(' ');
    const replies = await this.runWorkflowCommand(args, input.runtimeUserId || null);

    return this.buildResponse({
      status: 'started',
      actionId: 'resume_loop',
      teamId: String(input.teamId || '').trim() || null,
      workflowRunId,
      command: `/workflow ${args}`,
      note: `Loop ${workflowRunId} enviado para resumption${resumeStageId ? ` em ${resumeStageId}` : ''}.`,
      replies,
    }, input.workspace || null);
  }

  private async runWorkflowCommand(args: string, runtimeUserId: string | null): Promise<string[]> {
    const replies: string[] = [];
    const ctx = {
      from: { id: 0, username: 'web-agent-os' },
      chat: { id: 0, type: 'private' },
      reply: async (text: string) => {
        const normalized = String(text || '').trim();
        if (normalized) {
          replies.push(normalized);
        }
        return {};
      },
      api: {
        sendChatAction: async () => undefined,
      },
      zavorth: {
        runtimeUserId: runtimeUserId || 'web-user',
      },
    };

    await this.workflowController!.handleWorkflow(ctx, args);
    return replies;
  }

  private buildResponse(
    action: ZavorthAgentOperatingSystemActionResult,
    workspace: string | null,
  ): {
    action: ZavorthAgentOperatingSystemActionResult;
    agentOs: ZavorthAgentOperatingSystemSnapshot;
    teams: ZavorthTeamCatalogSnapshot;
    capabilities: ZavorthCapabilityCatalogSnapshot | null;
  } {
    return {
      action,
      agentOs: this.agentOperatingSystemService.buildSnapshot({ workspace }),
      teams: this.teamCatalogService.buildSnapshot({ workspace }),
      capabilities: this.capabilityCatalogService ? this.capabilityCatalogService.buildSnapshot() : null,
    };
  }

  private findTeam(teamId: string, workspace: string | null): { id: string } | null {
    const snapshot = this.teamCatalogService.buildSnapshot({ workspace });
    return snapshot.teams.find((team) => String(team.id || '').trim().toLowerCase() === teamId) || null;
  }
}
