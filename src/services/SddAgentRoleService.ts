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
      'Refine the problem, objective, requirements, and acceptance criteria.',
      'Make explicit the impact on runtime, security, tenancy, and surfaces.',
      'Remove ambiguities before implementation.',
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
        'Role: Spec Agent',
        `Write scope: ${writeScope.join(', ')}`,
        'Objective: consolidate or fix the feature spec before execution.',
      ].join('\n'),
    };
  }

  private buildPlannerBrief(snapshot: SddFeatureWorkspaceSnapshot): SddRoleBrief {
    const writeScope = [snapshot.paths.planFile, snapshot.paths.tasksFile];
    const checklist = [
      'Align plan with real files and risks.',
      'Break the work into small, verifiable tasks in order.',
      'Declare validation, rollout, and rollback.',
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
        'Role: Planner Agent',
        `Write scope: ${writeScope.join(', ')}`,
        `Open tasks today: ${snapshot.openTasks.length}.`,
      ].join('\n'),
    };
  }

  private buildExecutionBrief(snapshot: SddFeatureWorkspaceSnapshot): SddRoleBrief {
    const writeScope = Array.from(new Set([snapshot.paths.tasksFile, ...snapshot.referencedFiles]));
    const currentTask = snapshot.currentTask?.text || 'without an identified open task.';
    const checklist = [
      `run the active task: ${currentTask}`,
      'Strictly respect the spec and the plan.',
      'Add or adjust tests when a task touches behavior.',
      'Do not expand scope outside the first open task without updating the plan.',
    ];
    return {
      role: 'execution',
      label: 'Execution Agent',
      purpose: 'Implement the first open task of the feature while keeping scope controlled.',
      writeScope,
      checklist,
      prompt: [
        `Feature: ${snapshot.featureId}`,
        `Title: ${snapshot.title}`,
        'Role: Execution Agent',
        `Active task: ${currentTask}`,
        `Initial write scope: ${writeScope.join(', ') || snapshot.paths.tasksFile}`,
      ].join('\n'),
    };
  }

  private buildReviewBrief(snapshot: SddFeatureWorkspaceSnapshot): SddRoleBrief {
    const writeScope = [snapshot.paths.tasksFile, snapshot.paths.handoffFile, snapshot.paths.runStateFile];
    const checklist = [
      'Compare the implementation against the spec, plan, and tasks.',
      'Confirm build/tests/operational validation.',
      'Mark ready, blocked, or return objective findings.',
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
        'Role: Review Agent',
        `Write scope: ${writeScope.join(', ')}`,
        'Validate the feature against spec, plan, and tasks before promoting to ready.',
      ].join('\n'),
    };
  }
}
