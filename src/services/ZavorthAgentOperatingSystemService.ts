import {
  ZavorthTeamCatalogService,
  type ZavorthTeamCatalogSnapshot,
} from './ZavorthTeamCatalogService.js';

type ZavorthAgentOperatingSystemRuntime = {
  now?: () => Date;
  teamCatalogService?: Pick<ZavorthTeamCatalogService, 'buildSnapshot'>;
};

export type ZavorthAgentOperatingSystemRoleSnapshot = {
  id: 'spec' | 'planner' | 'execution' | 'review';
  label: string;
  executor: 'codex' | 'external_executor';
  writeBoundary: string;
  responsibility: string;
};

export type ZavorthAgentOperatingSystemLoopSnapshot = {
  id: string;
  label: string;
  status: 'idle' | 'active' | 'resumable';
  entryCommand: string;
  members: number;
  activeRuns: number;
  resumableRuns: number;
  latestWorkflowRunId: string | null;
  latestResumeStage: string | null;
  actions: Array<{
    id: 'start_loop' | 'resume_loop';
    label: string;
    requiresInput: boolean;
    payload: {
      teamId: string;
      workflowRunId?: string | null;
      resumeStageId?: string | null;
    };
  }>;
};

export type ZavorthAgentOperatingSystemSnapshot = {
  generatedAt: string;
  kernel: {
    label: string;
    coordinator: string;
    stateModel: string;
    handoffModel: string;
  };
  summary: {
    roles: number;
    loops: number;
    activeLoops: number;
    resumableLoops: number;
    sddLoopReady: boolean;
  };
  roles: ZavorthAgentOperatingSystemRoleSnapshot[];
  loops: ZavorthAgentOperatingSystemLoopSnapshot[];
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

const AGENT_OS_ROLES: ZavorthAgentOperatingSystemRoleSnapshot[] = [
  {
    id: 'spec',
    label: 'Spec Agent',
    executor: 'codex',
    writeBoundary: 'spec.md',
    responsibility: 'Clarifica contrato, requisitos e criterios de aceitacao da feature.',
  },
  {
    id: 'planner',
    label: 'Planner Agent',
    executor: 'codex',
    writeBoundary: 'plan.md + tasks.md',
    responsibility: 'Traduz o spec em plano tecnico e tasks pequenas, validaveis e ordenadas.',
  },
  {
    id: 'execution',
    label: 'Execution Agent',
    executor: 'codex',
    writeBoundary: 'tasks.md + arquivos referenciados da feature',
    responsibility: 'Implementa a task ativa dentro do escopo aprovado da feature.',
  },
  {
    id: 'review',
    label: 'Review Agent',
    executor: 'external_executor',
    writeBoundary: 'tasks.md + handoff.md + run-state.json',
    responsibility: 'Valida coerencia entre spec, plan, tasks, testes e evidencias do run.',
  },
];

export class ZavorthAgentOperatingSystemService {
  private readonly now: () => Date;
  private readonly teamCatalogService: Pick<ZavorthTeamCatalogService, 'buildSnapshot'>;

  constructor(runtime: ZavorthAgentOperatingSystemRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.teamCatalogService = runtime.teamCatalogService || new ZavorthTeamCatalogService();
  }

  public buildSnapshot(input: { workspace?: string | null } = {}): ZavorthAgentOperatingSystemSnapshot {
    const teamCatalog = this.teamCatalogService.buildSnapshot(input);
    const loops = this.buildLoops(teamCatalog);
    const summary = {
      roles: AGENT_OS_ROLES.length,
      loops: loops.length,
      activeLoops: loops.filter((loop) => loop.status === 'active').length,
      resumableLoops: loops.filter((loop) => loop.status === 'resumable').length,
      sddLoopReady: loops.some((loop) => loop.id === 'sdd'),
    };

    return {
      generatedAt: this.now().toISOString(),
      kernel: {
        label: 'Limited Agent OS',
        coordinator: 'workflow-backed',
        stateModel: 'spec-plan-tasks-run-state',
        handoffModel: 'handoff.md + workflow ledger',
      },
      summary,
      roles: AGENT_OS_ROLES,
      loops,
      narrative: {
        headline: `Zavorth expoe um Agent OS limitado com ${summary.roles} papel(is) e ${summary.loops} loop(s) coordenados.`,
        operatorSummary: [
          `${summary.activeLoops} loop(s) ativo(s).`,
          `${summary.resumableLoops} loop(s) com retomada pronta.`,
          summary.sddLoopReady
            ? 'O loop SDD ja serve como nucleo do agent OS limitado.'
            : 'O loop SDD ainda nao apareceu no catalogo operacional.',
        ].join(' '),
      },
    };
  }

  private buildLoops(teamCatalog: ZavorthTeamCatalogSnapshot): ZavorthAgentOperatingSystemLoopSnapshot[] {
    return (teamCatalog.teams || []).map((team) => ({
      id: team.id,
      label: team.label,
      status: team.status,
      entryCommand: team.entryCommand,
      members: team.members.length,
      activeRuns: Number(team.runStats.active || 0),
      resumableRuns: Number(team.runStats.resumable || 0),
      latestWorkflowRunId: team.latestRun?.workflowRunId || null,
      latestResumeStage: team.latestRun?.resumeStageLabel || null,
      actions: [
        {
          id: 'start_loop',
          label: team.id === 'sdd' ? 'Iniciar loop SDD' : `Iniciar ${team.label}`,
          requiresInput: true,
          payload: {
            teamId: team.id,
          },
        },
        ...(team.latestRun?.resumeAvailable
          ? [
              {
                id: 'resume_loop' as const,
                label: 'Retomar ultimo run',
                requiresInput: false,
                payload: {
                  teamId: team.id,
                  workflowRunId: team.latestRun.workflowRunId || null,
                  resumeStageId: team.latestRun.resumeStageLabel || null,
                },
              },
            ]
          : []),
      ],
    }));
  }
}
