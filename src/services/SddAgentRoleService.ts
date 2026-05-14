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
      'Refinar problema, objetivo, requisitos e criterios de aceitacao.',
      'Explicitar impacto em runtime, security, tenancy e surfaces.',
      'Remover ambiguidades antes da implementacao.',
    ];
    return {
      role: 'spec',
      label: 'Spec Agent',
      purpose: 'Clarificar o contrato funcional da feature antes de qualquer implementacao relevante.',
      writeScope,
      checklist,
      prompt: [
        `Feature: ${snapshot.featureId}`,
        `Titulo: ${snapshot.title}`,
        'Papel: Spec Agent',
        `Write scope: ${writeScope.join(', ')}`,
        'Objetivo: consolidar ou corrigir o spec da feature antes da execucao.',
      ].join('\n'),
    };
  }

  private buildPlannerBrief(snapshot: SddFeatureWorkspaceSnapshot): SddRoleBrief {
    const writeScope = [snapshot.paths.planFile, snapshot.paths.tasksFile];
    const checklist = [
      'Alinhar plano com os arquivos reais e os riscos.',
      'Transformar o trabalho em tasks pequenas, verificaveis e em ordem.',
      'Declarar validacao, rollout e rollback.',
    ];
    return {
      role: 'planner',
      label: 'Planner Agent',
      purpose: 'Traduzir o spec em plano tecnico e tasks executaveis.',
      writeScope,
      checklist,
      prompt: [
        `Feature: ${snapshot.featureId}`,
        `Titulo: ${snapshot.title}`,
        'Papel: Planner Agent',
        `Write scope: ${writeScope.join(', ')}`,
        `Tasks abertas hoje: ${snapshot.openTasks.length}.`,
      ].join('\n'),
    };
  }

  private buildExecutionBrief(snapshot: SddFeatureWorkspaceSnapshot): SddRoleBrief {
    const writeScope = Array.from(new Set([snapshot.paths.tasksFile, ...snapshot.referencedFiles]));
    const currentTask = snapshot.currentTask?.text || 'Sem task aberta identificada.';
    const checklist = [
      `Executar a task ativa: ${currentTask}`,
      'Respeitar estritamente o spec e o plan.',
      'Adicionar ou ajustar testes quando a task tocar comportamento.',
      'Nao expandir o escopo fora da primeira task aberta sem atualizar o plano.',
    ];
    return {
      role: 'execution',
      label: 'Execution Agent',
      purpose: 'Implementar a primeira task aberta da feature mantendo o escopo controlado.',
      writeScope,
      checklist,
      prompt: [
        `Feature: ${snapshot.featureId}`,
        `Titulo: ${snapshot.title}`,
        'Papel: Execution Agent',
        `Task ativa: ${currentTask}`,
        `Write scope inicial: ${writeScope.join(', ') || snapshot.paths.tasksFile}`,
      ].join('\n'),
    };
  }

  private buildReviewBrief(snapshot: SddFeatureWorkspaceSnapshot): SddRoleBrief {
    const writeScope = [snapshot.paths.tasksFile, snapshot.paths.handoffFile, snapshot.paths.runStateFile];
    const checklist = [
      'Comparar implementacao com spec, plan e tasks.',
      'Confirmar build/testes/validacao operacional.',
      'Marcar pronto, bloqueado ou devolver findings objetivos.',
    ];
    return {
      role: 'review',
      label: 'Review Agent',
      purpose: 'Validar coerencia entre especificacao, execucao e evidencias antes de considerar a feature pronta.',
      writeScope,
      checklist,
      prompt: [
        `Feature: ${snapshot.featureId}`,
        `Titulo: ${snapshot.title}`,
        'Papel: Review Agent',
        `Write scope: ${writeScope.join(', ')}`,
        'Validar a feature contra spec, plan e tasks antes de promover para pronta.',
      ].join('\n'),
    };
  }
}
