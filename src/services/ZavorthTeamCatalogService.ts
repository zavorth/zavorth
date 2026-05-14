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
    summary: 'Fluxo em duas etapas para revisar codigo, encontrar riscos e devolver uma leitura mais confiavel.',
    whenToUse: 'Use quando voce quer auditoria de modulo, revisao tecnica ou um segundo passe antes de confiar numa mudanca.',
    entryCommand: '/workflow review <objetivo>',
    members: [
      {
        role: 'maker',
        label: 'ExternalExecutor Maker',
        executor: 'external_executor',
        responsibility: 'Explora o repo, junta contexto e faz a primeira passada da revisao.',
      },
      {
        role: 'reviewer',
        label: 'ExternalExecutor Reviewer',
        executor: 'external_executor',
        responsibility: 'Audita o resultado, destaca riscos e aponta o que ainda merece atencao.',
      },
    ],
  },
  {
    id: 'ship',
    label: 'Ship Team',
    summary: 'Time de entrega com implementacao primeiro e revisao cruzada antes do fechamento.',
    whenToUse: 'Use quando a ideia ja esta relativamente clara e voce quer executar, revisar e fechar a entrega com menos retrabalho.',
    entryCommand: '/workflow ship <objetivo>',
    members: [
      {
        role: 'maker',
        label: 'Codex Maker',
        executor: 'codex',
        responsibility: 'Implementa a mudanca direto no workspace e prepara a entrega.',
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
    summary: 'Pesquisa estruturada seguida de sintese final para transformar contexto bruto em briefing acionavel.',
    whenToUse: 'Use quando a tarefa pede descoberta, comparativo, investigacao externa ou consolidacao de contexto antes de agir.',
    entryCommand: '/workflow research <objetivo>',
    members: [
      {
        role: 'researcher',
        label: 'AI Studio Researcher',
        executor: 'aistudio',
        responsibility: 'Coleta sinais, organiza material bruto e amplia o contexto inicial.',
      },
      {
        role: 'synthesizer',
        label: 'Codex Synthesizer',
        executor: 'codex',
        responsibility: 'Condensa a pesquisa em briefing final, resumo executivo ou plano curto.',
      },
    ],
  },
  {
    id: 'sdd',
    label: 'SDD Loop Team',
    summary: 'Loop de spec-driven development com uma etapa por vez, orientado por papel e estado da feature.',
    whenToUse: 'Use quando voce quer conduzir uma feature por spec, plano, execucao e revisao sem perder a trilha oficial do workflow.',
    entryCommand: '/workflow sdd <feature-id>',
    members: [
      {
        role: 'spec',
        label: 'Codex Spec Agent',
        executor: 'codex',
        responsibility: 'Consolida o spec e fecha ambiguidades da feature.',
      },
      {
        role: 'planner',
        label: 'Codex Planner Agent',
        executor: 'codex',
        responsibility: 'Traduz o spec em plano tecnico e tasks pequenas.',
      },
      {
        role: 'execution',
        label: 'Codex Execution Agent',
        executor: 'codex',
        responsibility: 'Executa a task ativa respeitando o escopo da feature.',
      },
      {
        role: 'review',
        label: 'ExternalExecutor Review Agent',
        executor: 'external_executor',
        responsibility: 'Valida coerencia entre spec, plan, tasks e evidencias da execucao.',
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
        headline: `Zavorth expõe ${summary.total} team(s) compostos para review, entrega, pesquisa e loops SDD.`,
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
      return `Existe retomada pronta para ${template.label}: ${input.latestRun.workflow_run_id}${input.latestRun.resume_stage?.label ? ` em ${input.latestRun.resume_stage.label}` : ''}${this.buildExternalizedStateSuffix(input.latestRun)} ${this.buildSurfaceSuffix(input.surfaces)}`.trim();
    }
    if (input.active > 0 && input.latestRun) {
      return `${template.label} esta ativo agora em ${input.latestRun.workflow_run_id}${this.buildExternalizedStateSuffix(input.latestRun)} ${this.buildSurfaceSuffix(input.surfaces)}`.trim();
    }
    if (input.total > 0 && input.latestRun) {
      return `${template.label} ja rodou ${input.total} vez(es); ultima atividade em ${input.latestRun.workflow_run_id}${this.buildExternalizedStateSuffix(input.latestRun)} ${this.buildSurfaceSuffix(input.surfaces)}`.trim();
    }
    return `${template.label} esta pronto para um novo pedido via ${template.entryCommand}. ${this.buildSurfaceSuffix(input.surfaces)}`.trim();
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
      `${summary.total} team(s) compostos`,
      summary.resumable ? `${summary.resumable} com retomada pronta` : 'sem retomadas abertas',
      summary.active ? `${summary.active} ativo(s)` : 'nenhum ativo agora',
      summary.completedRecently ? `${summary.completedRecently} fechamento(s) recente(s)` : 'sem fechamentos recentes',
    ];
    if (summary.executors.length) {
      parts.push(`executores visiveis: ${summary.executors.join(', ')}`);
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
        summary: 'Disponivel no gateway principal por /workflow.',
        actionHint: '/workflow <review|ship|research|sdd> <objetivo>',
      },
      {
        surfaceId: 'web',
        label: 'Web autenticada',
        status: 'available',
        summary: 'Disponivel no /app, no composer e no Agent OS limitado.',
        actionHint: 'Use o /app autenticado para abrir ou retomar o fluxo.',
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
          summary: 'Modo publico ativo, mas ainda nao existe owner configurado para usar /workflow em DM.',
          actionHint: 'Defina DISCORD_OWNER_USER_IDS antes de depender de workflows no Discord.',
        };
      }
      return {
        surfaceId: 'discord_dm',
        label: 'Discord owner DM',
        status: 'owner_only',
        summary: 'No Discord publico, workflows compostos ficam restritos a DM owner-only.',
        actionHint: 'Use DM com o bot para rodar /workflow com contexto operacional.',
      };
    }

    if (input.requireOwnerForOperational) {
      if (input.ownerCount === 0) {
        return {
          surfaceId: 'discord_dm',
          label: 'Discord owner DM',
          status: 'blocked',
          summary: 'O runtime exige owner para comandos operacionais, mas nenhum owner foi configurado.',
          actionHint: 'Defina DISCORD_OWNER_USER_IDS antes de abrir workflows no Discord.',
        };
      }
      return {
        surfaceId: 'discord_dm',
        label: 'Discord owner DM',
        status: 'owner_only',
        summary: 'Comandos operacionais do Discord pedem owner neste runtime.',
        actionHint: 'Use uma DM owner-only quando quiser rodar /workflow pelo Discord.',
      };
    }

    return {
      surfaceId: 'discord_dm',
      label: 'Discord DM',
      status: 'available',
      summary: 'Disponivel em DM para owner/operator quando a surface do Discord estiver ativa.',
      actionHint: 'Use DM para abrir ou retomar um workflow sem expor contexto em canal.',
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
        summary: 'Discord publico esta fail-closed ate configurar canais permitidos.',
        actionHint: 'Preencha DISCORD_ALLOWED_CHANNEL_IDS antes de liberar trafego publico.',
      };
    }

    if (input.commandExposure === 'none') {
      return {
        surfaceId: 'discord_channel',
        label: 'Discord channel',
        status: 'blocked',
        summary: 'Slash commands do Discord estao desabilitados por policy neste runtime.',
        actionHint: 'Ajuste DISCORD_COMMAND_EXPOSURE se quiser expor slash commands no Discord.',
      };
    }

    if (input.publicServerMode) {
      return {
        surfaceId: 'discord_channel',
        label: 'Discord public channel',
        status: 'blocked',
        summary: 'Em servidor publico, /workflow nao fica exposto nos canais; use DM owner-only.',
        actionHint: 'Mantenha workflows compostos fora dos canais publicos do servidor.',
      };
    }

    if (input.commandExposure === 'minimal') {
      return {
        surfaceId: 'discord_channel',
        label: 'Discord channel',
        status: 'blocked',
        summary: 'O runtime esta em exposure minimal, entao /workflow nao aparece em canais do Discord.',
        actionHint: 'Suba para exposure operator se quiser slash /workflow em contexto operacional.',
      };
    }

    if (input.requireOwnerForOperational) {
      return {
        surfaceId: 'discord_channel',
        label: 'Discord channel',
        status: input.ownerCount > 0 ? 'owner_only' : 'blocked',
        summary: input.ownerCount > 0
          ? 'Disponivel apenas para owner em contexto operacional do Discord.'
          : 'O runtime exige owner para /workflow, mas nenhum owner foi configurado.',
        actionHint: input.ownerCount > 0
          ? 'Use um canal operacional controlado ou prefira DM owner-only.'
          : 'Defina owners antes de confiar em workflows compostos no Discord.',
      };
    }

    return {
      surfaceId: 'discord_channel',
      label: 'Discord channel',
      status: 'available',
      summary: 'Disponivel em contexto operacional do Discord quando slash operator estiver habilitado.',
      actionHint: 'Use canais operacionais controlados para evitar expor contexto desnecessario.',
    };
  }

  private buildSurfaceSuffix(surfaces: ZavorthTeamSurfaceAvailability[]): string {
    const available = surfaces.filter((entry) => entry.status === 'available').map((entry) => entry.label);
    const ownerOnly = surfaces.filter((entry) => entry.status === 'owner_only').map((entry) => entry.label);
    const blocked = surfaces.filter((entry) => entry.status === 'blocked' || entry.status === 'restricted').map((entry) => entry.label);

    const parts: string[] = [];
    if (available.length > 0) {
      parts.push(`Disponivel em ${available.join(', ')}`);
    }
    if (ownerOnly.length > 0) {
      parts.push(`owner-only em ${ownerOnly.join(', ')}`);
    }
    if (blocked.length > 0) {
      parts.push(`bloqueado/restrito em ${blocked.join(', ')}`);
    }
    return parts.length > 0 ? `${parts.join(' | ')}.` : '';
  }
}
