import {
  WorkflowRunService,
  type WorkflowKind,
  type WorkflowRunSnapshot,
  type WorkflowStageExecutor,
} from '../runtime/workflows/WorkflowRunService.js';
import { DiscordSurfacePolicyService } from './DiscordSurfacePolicyService.js';

type WorkflowRunServiceLike = Pick<WorkflowRunService, 'listRuns'>;
type DiscordSurfacePolicyLike = Pick<
  DiscordSurfacePolicyService,
  | 'getCommandExposure'
  | 'getAllowedChannelIds'
  | 'getOwnerUserIds'
  | 'isPublicServerMode'
  | 'requiresOwnerForOperational'
>;

type ZavorthTeamCatalogRuntime = {
  now?: () => Date;
  workflowRunService?: WorkflowRunServiceLike;
  discordSurfacePolicyService?: DiscordSurfacePolicyLike;
};

export type ZavorthTeamMemberSnapshot = {
  role: string;
  label: string;
  executor: WorkflowStageExecutor;
  responsibility: string;
};

export type ZavorthTeamRunSummary = {
  workflowRunId: string;
  objective: string;
  status: WorkflowRunSnapshot['status'];
  updatedAt: string;
  resumeStageLabel: string | null;
  resumeAvailable: boolean;
  checkpointCount: number;
  latestChainHash: string | null;
  lastCheckpointEvent: string | null;
};

export type ZavorthTeamSurfaceAvailability = {
  surfaceId: 'telegram' | 'web' | 'discord_dm' | 'discord_channel';
  label: string;
  status: 'available' | 'owner_only' | 'restricted' | 'blocked';
  summary: string;
  actionHint: string | null;
};

export type ZavorthTeamSnapshot = {
  id: WorkflowKind;
  label: string;
  summary: string;
  whenToUse: string;
  entryCommand: string;
  status: 'idle' | 'active' | 'resumable';
  members: ZavorthTeamMemberSnapshot[];
  runStats: {
    total: number;
    active: number;
    resumable: number;
    completedRecently: number;
  };
  surfaces: ZavorthTeamSurfaceAvailability[];
  latestRun: ZavorthTeamRunSummary | null;
  operatorSummary: string;
};

export type ZavorthTeamCatalogSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    active: number;
    resumable: number;
    completedRecently: number;
    executors: WorkflowStageExecutor[];
  };
  teams: ZavorthTeamSnapshot[];
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

type TeamTemplate = {
  id: WorkflowKind;
  label: string;
  summary: string;
  whenToUse: string;
  entryCommand: string;
  members: ZavorthTeamMemberSnapshot[];
};

const TEAM_TEMPLATES: TeamTemplate[] = [
  {
    id: 'review',
    label: 'Review Team',
    summary: 'Two-step flow to review code, find risks, and return a more reliable reading.',
    whenToUse: 'Use when you want module auditing, technical review, or a second pass before trusting a change.',
    entryCommand: '/workflow review <objective>',
    members: [
      {
        role: 'maker',
        label: 'ExternalExecutor Maker',
        executor: 'external_executor',
        responsibility: 'Explores the repo, gathers context, and performs the first review pass.',
      },
      {
        role: 'reviewer',
        label: 'ExternalExecutor Reviewer',
        executor: 'external_executor',
        responsibility: 'Audits the result, highlights risks, and points out what still deserves attention.',
      },
    ],
  },
  {
    id: 'ship',
    label: 'Ship Team',
    summary: 'Delivery team with implementation first and cross-review before closure.',
    whenToUse: 'Use when the idea is already fairly clear and you want to execute, review, and close delivery with less rework.',
    entryCommand: '/workflow ship <objective>',
    members: [
      {
        role: 'maker',
        label: 'Codex Maker',
        executor: 'codex',
        responsibility: 'Implements the change directly in the workspace and prepares delivery.',
      },
      {
        role: 'reviewer',
        label: 'ExternalExecutor Reviewer',
        executor: 'external_executor',
        responsibility: 'Revisa a implementacao e tenta encontrar regressao, risco e ajuste final.',
      },
    ],
  },
  {
    id: 'research',
    label: 'Research Team',
    summary: 'Structured research followed by final synthesis to turn raw context into an actionable brief.',
    whenToUse: 'Use when the task needs discovery, comparison, external investigation, or context consolidation before action.',
    entryCommand: '/workflow research <objective>',
    members: [
      {
        role: 'researcher',
        label: 'AI Studio Researcher',
        executor: 'aistudio',
        responsibility: 'Collects signals, organizes raw material, and expands the initial context.',
      },
      {
        role: 'synthesizer',
        label: 'Codex Synthesizer',
        executor: 'codex',
        responsibility: 'Condenses research into a final brief, executive summary, or short plan.',
      },
    ],
  },
  {
    id: 'sdd',
    label: 'SDD Loop Team',
    summary: 'Spec-driven development loop with one step at a time, guided by role and feature state.',
    whenToUse: 'Use when you want to drive a feature through spec, plan, execution, and review without losing the official workflow trail.',
    entryCommand: '/workflow sdd <feature-id>',
    members: [
      {
        role: 'spec',
        label: 'Codex Spec Agent',
        executor: 'codex',
        responsibility: 'Consolidates the spec and closes feature ambiguities.',
      },
      {
        role: 'planner',
        label: 'Codex Planner Agent',
        executor: 'codex',
        responsibility: 'Translates the spec into a technical plan and small tasks.',
      },
      {
        role: 'execution',
        label: 'Codex Execution Agent',
        executor: 'codex',
        responsibility: 'Executes the active task while respecting the feature scope.',
      },
      {
        role: 'review',
        label: 'ExternalExecutor Review Agent',
        executor: 'external_executor',
        responsibility: 'Validates consistency between spec, plan, tasks, and execution evidence.',
      },
    ],
  },
];

export class ZavorthTeamCatalogService {
  private readonly now: () => Date;
  private readonly workflowRuns: WorkflowRunServiceLike;
  private readonly discordSurfacePolicy: DiscordSurfacePolicyLike;

  constructor(runtime: ZavorthTeamCatalogRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workflowRuns = runtime.workflowRunService || new WorkflowRunService();
    this.discordSurfacePolicy = runtime.discordSurfacePolicyService || new DiscordSurfacePolicyService();
  }

  public buildSnapshot(input: { workspace?: string | null } = {}): ZavorthTeamCatalogSnapshot {
    const runs = this.workflowRuns.listRuns({
      workspace: input.workspace || null,
      limit: 30,
    });
    const teams = TEAM_TEMPLATES.map((template) => this.buildTeamSnapshot(template, runs));
    const summary = this.buildSummary(teams);

    return {
      generatedAt: this.now().toISOString(),
      summary,
      teams,
      narrative: {
        headline: `Zavorth exposes ${summary.total} composed team(s) for review, delivery, research, and SDD loops.`,
        operatorSummary: this.buildOperatorSummary(summary),
      },
    };
  }

  private buildTeamSnapshot(template: TeamTemplate, runs: WorkflowRunSnapshot[]): ZavorthTeamSnapshot {
    const scopedRuns = runs
      .filter((run) => run.workflow_name === template.id)
      .sort((left, right) => String(right.updated_at || '').localeCompare(String(left.updated_at || '')));
    const resumable = scopedRuns.filter((run) => this.isResumable(run));
    const active = scopedRuns.filter((run) => run.status === 'running' || run.status === 'approval_pending');
    const completedRecently = scopedRuns.filter((run) => run.status === 'completed').slice(0, 3);
    const latestRun = scopedRuns[0] || null;
    const surfaces = this.buildSurfaceAvailability(template);

    return {
      id: template.id,
      label: template.label,
      summary: template.summary,
      whenToUse: template.whenToUse,
      entryCommand: template.entryCommand,
      status: resumable.length ? 'resumable' : (active.length ? 'active' : 'idle'),
      members: template.members,
      runStats: {
        total: scopedRuns.length,
        active: active.length,
        resumable: resumable.length,
        completedRecently: completedRecently.length,
      },
      surfaces,
      latestRun: latestRun
        ? {
            workflowRunId: latestRun.workflow_run_id,
            objective: latestRun.objective,
            status: latestRun.status,
            updatedAt: latestRun.updated_at,
            resumeStageLabel: latestRun.resume_stage?.label || null,
            resumeAvailable: this.isResumable(latestRun),
            checkpointCount: Number(latestRun.externalized_state?.checkpoint_count || 0),
            latestChainHash: latestRun.externalized_state?.latest_chain_hash || null,
            lastCheckpointEvent: latestRun.externalized_state?.last_event || null,
          }
        : null,
      operatorSummary: this.buildTeamOperatorSummary(template, {
        total: scopedRuns.length,
        active: active.length,
        resumable: resumable.length,
        latestRun,
        surfaces,
      }),
    };
  }

  private buildTeamOperatorSummary(
    template: TeamTemplate,
    input: {
      total: number;
      active: number;
      resumable: number;
      latestRun: WorkflowRunSnapshot | null;
      surfaces: ZavorthTeamSurfaceAvailability[];
    },
  ): string {
    if (input.resumable > 0 && input.latestRun) {
      return `Resume is ready for ${template.label}: ${input.latestRun.workflow_run_id}${input.latestRun.resume_stage?.label ? ` at ${input.latestRun.resume_stage.label}` : ''}${this.buildExternalizedStateSuffix(input.latestRun)} ${this.buildSurfaceSuffix(input.surfaces)}`.trim();
    }
    if (input.active > 0 && input.latestRun) {
      return `${template.label} is active now in ${input.latestRun.workflow_run_id}${this.buildExternalizedStateSuffix(input.latestRun)} ${this.buildSurfaceSuffix(input.surfaces)}`.trim();
    }
    if (input.total > 0 && input.latestRun) {
      return `${template.label} has run ${input.total} time(s); latest activity in ${input.latestRun.workflow_run_id}${this.buildExternalizedStateSuffix(input.latestRun)} ${this.buildSurfaceSuffix(input.surfaces)}`.trim();
    }
    return `${template.label} is ready for a new request through ${template.entryCommand}. ${this.buildSurfaceSuffix(input.surfaces)}`.trim();
  }

  private buildExternalizedStateSuffix(run: WorkflowRunSnapshot | null): string {
    const checkpointCount = Number(run?.externalized_state?.checkpoint_count || 0);
    if (!checkpointCount) {
      return '';
    }

    const lastEvent = String(run?.externalized_state?.last_event || '').trim();
    return ` com ${checkpointCount} checkpoint(s)${lastEvent ? ` e ultimo evento ${lastEvent}` : ''}`;
  }

  private buildSummary(teams: ZavorthTeamSnapshot[]): ZavorthTeamCatalogSnapshot['summary'] {
    const executors = Array.from(new Set(
      teams.flatMap((team) => team.members.map((member) => member.executor)),
    )).sort() as WorkflowStageExecutor[];

    return {
      total: teams.length,
      active: teams.filter((team) => Number(team.runStats.active || 0) > 0).length,
      resumable: teams.filter((team) => Number(team.runStats.resumable || 0) > 0).length,
      completedRecently: teams.reduce((acc, team) => acc + Number(team.runStats.completedRecently || 0), 0),
      executors,
    };
  }

  private buildOperatorSummary(summary: ZavorthTeamCatalogSnapshot['summary']): string {
    const parts = [
      `${summary.total} composed team(s)`,
      summary.resumable ? `${summary.resumable} ready to resume` : 'no open resumptions',
      summary.active ? `${summary.active} active` : 'none active now',
      summary.completedRecently ? `${summary.completedRecently} recent completion(s)` : 'no recent completions',
    ];
    if (summary.executors.length) {
      parts.push(`visible executors: ${summary.executors.join(', ')}`);
    }
    return parts.join(' | ');
  }

  private isResumable(run: WorkflowRunSnapshot | null | undefined): boolean {
    return Boolean(run?.resume_stage)
      || run?.status === 'approval_pending'
      || run?.status === 'blocked'
      || run?.status === 'failed';
  }

  private buildSurfaceAvailability(_template: TeamTemplate): ZavorthTeamSurfaceAvailability[] {
    const commandExposure = this.discordSurfacePolicy.getCommandExposure();
    const publicServerMode = this.discordSurfacePolicy.isPublicServerMode();
    const ownerCount = this.discordSurfacePolicy.getOwnerUserIds().length;
    const allowedChannelCount = this.discordSurfacePolicy.getAllowedChannelIds().length;
    const requireOwnerForOperational = this.discordSurfacePolicy.requiresOwnerForOperational();

    const discordDm = this.resolveDiscordDmAvailability({
      publicServerMode,
      ownerCount,
      requireOwnerForOperational,
    });
    const discordChannel = this.resolveDiscordChannelAvailability({
      commandExposure,
      publicServerMode,
      ownerCount,
      allowedChannelCount,
      requireOwnerForOperational,
    });

    return [
      {
        surfaceId: 'telegram',
        label: 'Telegram',
        status: 'available',
        summary: 'Available in the main gateway through /workflow.',
        actionHint: '/workflow <review|ship|research|sdd> <objective>',
      },
      {
        surfaceId: 'web',
        label: 'Authenticated Web',
        status: 'available',
        summary: 'Available in /app, the composer, and the limited Agent OS.',
        actionHint: 'Use the authenticated /app to open or resume the flow.',
      },
      discordDm,
      discordChannel,
    ];
  }

  private resolveDiscordDmAvailability(input: {
    publicServerMode: boolean;
    ownerCount: number;
    requireOwnerForOperational: boolean;
  }): ZavorthTeamSurfaceAvailability {
    if (input.publicServerMode) {
      if (input.ownerCount === 0) {
        return {
          surfaceId: 'discord_dm',
          label: 'Discord owner DM',
          status: 'blocked',
          summary: 'Public mode is active, but no owner is configured to use /workflow in DM.',
          actionHint: 'Set DISCORD_OWNER_USER_IDS before depending on Discord workflows.',
        };
      }
      return {
        surfaceId: 'discord_dm',
        label: 'Discord owner DM',
        status: 'owner_only',
        summary: 'In public Discord mode, composed workflows are restricted to owner-only DMs.',
        actionHint: 'Use DM with the bot to run /workflow with operational context.',
      };
    }

    if (input.requireOwnerForOperational) {
      if (input.ownerCount === 0) {
        return {
          surfaceId: 'discord_dm',
          label: 'Discord owner DM',
          status: 'blocked',
          summary: 'The runtime requires an owner for operational commands, but no owner was configured.',
          actionHint: 'Set DISCORD_OWNER_USER_IDS before opening workflows on Discord.',
        };
      }
      return {
        surfaceId: 'discord_dm',
        label: 'Discord owner DM',
        status: 'owner_only',
        summary: 'Discord operational commands require an owner in this runtime.',
        actionHint: 'Use an owner-only DM when you want to run /workflow through Discord.',
      };
    }

    return {
      surfaceId: 'discord_dm',
      label: 'Discord DM',
      status: 'available',
      summary: 'Available in DM for owner/operator when the Discord surface is active.',
      actionHint: 'Use DM to open or resume a workflow without exposing context in a channel.',
    };
  }

  private resolveDiscordChannelAvailability(input: {
    commandExposure: ReturnType<DiscordSurfacePolicyLike['getCommandExposure']>;
    publicServerMode: boolean;
    ownerCount: number;
    allowedChannelCount: number;
    requireOwnerForOperational: boolean;
  }): ZavorthTeamSurfaceAvailability {
    if (input.publicServerMode && input.allowedChannelCount === 0) {
      return {
        surfaceId: 'discord_channel',
        label: 'Discord channel',
        status: 'restricted',
        summary: 'Public Discord is fail-closed until allowed channels are configured.',
        actionHint: 'Fill DISCORD_ALLOWED_CHANNEL_IDS before allowing public traffic.',
      };
    }

    if (input.commandExposure === 'none') {
      return {
        surfaceId: 'discord_channel',
        label: 'Discord channel',
        status: 'blocked',
        summary: 'Discord slash commands are disabled by policy in this runtime.',
        actionHint: 'Adjust DISCORD_COMMAND_EXPOSURE if you want to expose slash commands on Discord.',
      };
    }

    if (input.publicServerMode) {
      return {
        surfaceId: 'discord_channel',
        label: 'Discord public channel',
        status: 'blocked',
        summary: 'On a public server, /workflow is not exposed in channels; use owner-only DM.',
        actionHint: 'Keep composed workflows out of public server channels.',
      };
    }

    if (input.commandExposure === 'minimal') {
      return {
        surfaceId: 'discord_channel',
        label: 'Discord channel',
        status: 'blocked',
        summary: 'The runtime is in minimal exposure, so /workflow does not appear in Discord channels.',
        actionHint: 'Move to operator exposure if you want slash /workflow in operational context.',
      };
    }

    if (input.requireOwnerForOperational) {
      return {
        surfaceId: 'discord_channel',
        label: 'Discord channel',
        status: input.ownerCount > 0 ? 'owner_only' : 'blocked',
        summary: input.ownerCount > 0
          ? 'Available only to owners in Discord operational context.'
          : 'The runtime requires an owner for /workflow, but no owner was configured.',
        actionHint: input.ownerCount > 0
          ? 'Use a controlled operational channel or prefer owner-only DM.'
          : 'Set owners before trusting composed workflows on Discord.',
      };
    }

    return {
      surfaceId: 'discord_channel',
      label: 'Discord channel',
      status: 'available',
      summary: 'Available in Discord operational context when slash operator exposure is enabled.',
      actionHint: 'Use controlled operational channels to avoid exposing unnecessary context.',
    };
  }

  private buildSurfaceSuffix(surfaces: ZavorthTeamSurfaceAvailability[]): string {
    const available = surfaces.filter((entry) => entry.status === 'available').map((entry) => entry.label);
    const ownerOnly = surfaces.filter((entry) => entry.status === 'owner_only').map((entry) => entry.label);
    const blocked = surfaces.filter((entry) => entry.status === 'blocked' || entry.status === 'restricted').map((entry) => entry.label);

    const parts: string[] = [];
    if (available.length > 0) {
      parts.push(`Available in ${available.join(', ')}`);
    }
    if (ownerOnly.length > 0) {
      parts.push(`owner-only in ${ownerOnly.join(', ')}`);
    }
    if (blocked.length > 0) {
      parts.push(`blocked/restricted in ${blocked.join(', ')}`);
    }
    return parts.length > 0 ? `${parts.join(' | ')}.` : '';
  }
}
