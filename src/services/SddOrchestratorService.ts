import { SpecDrivenDevelopmentService } from './SpecDrivenDevelopmentService.js';
import {
  SddFeatureWorkspaceService,
  type SddAgentRole,
  type SddFeatureWorkspaceSnapshot,
  type SddRunLifecycle,
  type SddRunState,
} from './SddFeatureWorkspaceService.js';
import { SddAgentRoleService, type SddRoleBrief } from './SddAgentRoleService.js';

export type SddWorkOrder = {
  featureId: string;
  title: string;
  lifecycle: SddRunLifecycle;
  nextRole: SddAgentRole;
  currentTask: string | null;
  openTaskCount: number;
  completedTaskCount: number;
  paths: SddFeatureWorkspaceSnapshot['paths'];
  brief: SddRoleBrief;
  runState: SddRunState;
};

type SddOrchestratorRuntime = {
  workspaceService?: SddFeatureWorkspaceService;
  roleService?: SddAgentRoleService;
  scaffoldService?: SpecDrivenDevelopmentService;
};

export class SddOrchestratorService {
  private readonly workspaceService: SddFeatureWorkspaceService;
  private readonly roleService: SddAgentRoleService;
  private readonly scaffoldService: SpecDrivenDevelopmentService;

  constructor(runtime: SddOrchestratorRuntime = {}) {
    this.workspaceService = runtime.workspaceService || new SddFeatureWorkspaceService();
    this.roleService = runtime.roleService || new SddAgentRoleService();
    this.scaffoldService = runtime.scaffoldService || new SpecDrivenDevelopmentService();
  }

  public inspect(featureId: string): SddWorkOrder {
    const snapshot = this.workspaceService.ensureControlFiles(featureId);
    const runState = this.workspaceService.writeRunState(snapshot.featureId, {
      title: snapshot.title,
      lifecycle: snapshot.lifecycle,
      currentRole: snapshot.nextRole,
      currentTask: snapshot.currentTask?.text || null,
      lastActor: 'system',
      note: this.buildSystemNote(snapshot),
    });
    const refreshed = this.workspaceService.inspect(snapshot.featureId);
    return this.buildWorkOrder(refreshed, runState);
  }

  public scaffoldAndInspect(featureId: string, title: string): SddWorkOrder {
    this.scaffoldService.scaffoldFeature({ featureId, title });
    return this.inspect(featureId);
  }

  public isKnownFeature(featureId: string): boolean {
    return this.workspaceService.hasScaffold(featureId);
  }

  public handoff(
    featureId: string,
    input: {
      role: SddAgentRole;
      actor: string;
      summary: string;
      lifecycle?: SddRunLifecycle;
      note?: string | null;
    },
  ): SddWorkOrder {
    const snapshot = this.workspaceService.ensureControlFiles(featureId);
    this.workspaceService.appendHandoff(snapshot.featureId, {
      role: input.role,
      actor: input.actor,
      summary: input.summary,
    });
    const refreshed = this.workspaceService.inspect(snapshot.featureId);
    const runState = this.workspaceService.writeRunState(refreshed.featureId, {
      title: refreshed.title,
      lifecycle: input.lifecycle || refreshed.lifecycle,
      currentRole: refreshed.nextRole,
      currentTask: refreshed.currentTask?.text || null,
      lastActor: input.actor,
      note: input.note || input.summary,
    });
    return this.buildWorkOrder(refreshed, runState);
  }

  private buildWorkOrder(snapshot: SddFeatureWorkspaceSnapshot, runState: SddRunState): SddWorkOrder {
    return {
      featureId: snapshot.featureId,
      title: snapshot.title,
      lifecycle: runState.lifecycle,
      nextRole: runState.currentRole,
      currentTask: snapshot.currentTask?.text || null,
      openTaskCount: snapshot.openTasks.length,
      completedTaskCount: snapshot.completedTasks.length,
      paths: snapshot.paths,
      brief: this.roleService.buildBrief(snapshot, runState.currentRole),
      runState,
    };
  }

  private buildSystemNote(snapshot: SddFeatureWorkspaceSnapshot): string {
    switch (snapshot.nextRole) {
      case 'spec':
        return 'Feature ainda precisa consolidar o spec.';
      case 'planner':
        return 'Feature precisa alinhar plan/tasks antes da execucao.';
      case 'review':
        return 'Feature sem tasks abertas; pronta para revisao final.';
      case 'execution':
      default:
        return snapshot.currentTask
          ? `Proxima execucao sugerida: ${snapshot.currentTask.text}`
          : 'Feature pronta para a etapa de execucao.';
    }
  }
}
