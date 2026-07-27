import type {
  SddAgentRole,
  SddFeatureWorkspaceSnapshot,
} from './SddFeatureWorkspaceService.js';

export type SddRoleBrief = {
  role: SddAgentRole;
  label: string;
  purpose: string;
  writeScope: string[];
  checklist: string[];
  prompt: string;
};

export class SddAgentRoleService {
  public buildBrief(snapshot: SddFeatureWorkspaceSnapshot, role: SddAgentRole = snapshot.nextRole): SddRoleBrief {
    switch (role) {
      case 'spec':
        return this.buildSpecBrief(snapshot);
      case 'planner':
        return this.buildPlannerBrief(snapshot);
      case 'review':
        return this.buildReviewBrief(snapshot);
      case 'execution':
      default:
        return this.buildExecutionBrief(snapshot);
    }
  }

  private buildSpecBrief(snapshot: SddFeatureWorkspaceSnapshot): SddRoleBrief {
    const writeScope = [snapshot.paths.specFile];
    const checklist = [
      'Refinar problema, objetivo, requisitos e criterios de aceitaction.',
      'Explicitar impacto em runtime, security, tenancy e surfaces.',
      'Remover ambiguidades before da implementation.',
    ];
    return {
      role: 'spec',
      label: 'Spec Agent',
      purpose: 'Clarify the feature functional contract before any relevant implementation.',
      writeScope,
      checklist,
      prompt: [
        `Feature: ${snapshot.featureId}`,
        `Title: ${snapshot.title}`,
        'Papel: Spec Agent',
        `Write scope: ${writeScope.join(', ')}`,
        'Objective: consolidate or fix the feature spec before execution.',
      ].join('\n'),
    };
  }

  private buildPlannerBrief(snapshot: SddFeatureWorkspaceSnapshot): SddRoleBrief {
    const writeScope = [snapshot.paths.planFile, snapshot.paths.tasksFile];
    const checklist = [
      'Align plan with real files and risks.',
      'Transformar o trabalho em tasks pequenas, verificaveis e em ordem.',
      'Declarar validation, rollout e rollback.',
    ];
    return {
      role: 'planner',
      label: 'Planner Agent',
      purpose: 'Translate the spec into a technical plan and executable tasks.',
      writeScope,
      checklist,
      prompt: [
        `Feature: ${snapshot.featureId}`,
        `Title: ${snapshot.title}`,
        'Papel: Planner Agent',
        `Write scope: ${writeScope.join(', ')}`,
        `Tasks abertas hoje: ${snapshot.openTasks.length}.`,
      ].join('\n'),
    };
  }

  private buildExecutionBrief(snapshot: SddFeatureWorkspaceSnapshot): SddRoleBrief {
    const writeScope = Array.from(new Set([snapshot.paths.tasksFile, ...snapshot.referencedFiles]));
    const currentTask = snapshot.currentTask?.text || 'without task aberta identificada.';
    const checklist = [
      `run a task ativa: ${currentTask}`,
      'Respeitar estritamente o spec e o plan.',
      'Adicionar ou ajustar testes when a task tocar comportamento.',
      'Do not expand scope outside the first open task without updating the plan.',
    ];
    return {
      role: 'execution',
      label: 'Execution Agent',
      purpose: 'Implementar a primeira task aberta da feature mantendo o escopo controlado.',
      writeScope,
      checklist,
      prompt: [
        `Feature: ${snapshot.featureId}`,
        `Title: ${snapshot.title}`,
        'Papel: Execution Agent',
        `Task ativa: ${currentTask}`,
        `Write scope inicial: ${writeScope.join(', ') || snapshot.paths.tasksFile}`,
      ].join('\n'),
    };
  }

  private buildReviewBrief(snapshot: SddFeatureWorkspaceSnapshot): SddRoleBrief {
    const writeScope = [snapshot.paths.tasksFile, snapshot.paths.handoffFile, snapshot.paths.runStateFile];
    const checklist = [
      'Comparar implementation com spec, plan e tasks.',
      'Confirmar build/testes/validation operational.',
      'Marcar ready, blocked ou devolver findings objetivos.',
    ];
    return {
      role: 'review',
      label: 'Review Agent',
      purpose: 'Validate coherence between specification, execution, and evidence before considering the feature ready.',
      writeScope,
      checklist,
      prompt: [
        `Feature: ${snapshot.featureId}`,
        `Title: ${snapshot.title}`,
        'Papel: Review Agent',
        `Write scope: ${writeScope.join(', ')}`,
        'validate a feature against spec, plan, and tasks before promoting to ready.',
      ].join('\n'),
    };
  }
}
