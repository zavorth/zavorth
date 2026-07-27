import fs from 'fs';
import { SddFeatureWorkspaceService } from '../../src/services/SddFeatureWorkspaceService';
import { SddOrchestratorService } from '../../src/services/SddOrchestratorService';

describe('SddOrchestratorService', () => {
  it('builds an execution work order from an existing feature workspace', () => {
    const files: Record<string, string> = {
      'C:/tmp/zavorth/specs/features/runtime/dashboard-runtime-source-of-truth/spec.md': '# Spec: Dashboard Runtime Source Of Truth',
      'C:/tmp/zavorth/specs/features/runtime/dashboard-runtime-source-of-truth/plan.md': '# Plan: Dashboard Runtime Source Of Truth',
      'C:/tmp/zavorth/specs/features/runtime/dashboard-runtime-source-of-truth/tasks.md': [
        '- [x] T1. Definir spec',
        '- [ ] T2. Ajustar readiness',
      ].join('\n'),
    };

    const workspaceService = new SddFeatureWorkspaceService({
      projectRoot: 'C:/tmp/zavorth',
      existsSync: (filePath: fs.PathLike) => Object.prototype.hasOwnProperty.call(files, String(filePath).replace(/\\/g, '/')),
      mkdirSync: () => undefined as any,
      readFileSync: (filePath: fs.PathOrFileDescriptor) => files[String(filePath).replace(/\\/g, '/')],
      writeFileSync: (filePath: fs.PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView) => {
        files[String(filePath).replace(/\\/g, '/')] = String(data);
      },
      now: () => new Date('2026-04-03T13:00:00.000Z'),
    });

    const orchestrator = new SddOrchestratorService({
      workspaceService,
    });

    const workOrder = orchestrator.inspect('runtime/dashboard-runtime-source-of-truth');

    expect(workOrder.featureId).toBe('runtime/dashboard-runtime-source-of-truth');
    expect(workOrder.lifecycle).toBe('active');
    expect(workOrder.nextRole).toBe('execution');
    expect(workOrder.currentTask).toBe('Ajustar readiness');
    expect(workOrder.runState.note).toContain('Suggested next execution');
    expect(workOrder.brief.label).toBe('Execution Agent');
    expect(workOrder.brief.checklist[0]).toContain('Executar a task ativa');
  });

  it('records a handoff and moves the feature to review when no tasks remain abertas', () => {
    const files: Record<string, string> = {
      'C:/tmp/zavorth/specs/features/multisurface/tenant-aware-session-continuity/spec.md': '# Spec: Tenant Aware Session Continuity',
      'C:/tmp/zavorth/specs/features/multisurface/tenant-aware-session-continuity/plan.md': '# Plan: Tenant Aware Session Continuity',
      'C:/tmp/zavorth/specs/features/multisurface/tenant-aware-session-continuity/tasks.md': [
        '- [x] T1. Aplicar filtro por tenant',
        '- [x] T2. Cobrir com testes',
      ].join('\n'),
    };

    const workspaceService = new SddFeatureWorkspaceService({
      projectRoot: 'C:/tmp/zavorth',
      existsSync: (filePath: fs.PathLike) => Object.prototype.hasOwnProperty.call(files, String(filePath).replace(/\\/g, '/')),
      mkdirSync: () => undefined as any,
      readFileSync: (filePath: fs.PathOrFileDescriptor) => files[String(filePath).replace(/\\/g, '/')],
      writeFileSync: (filePath: fs.PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView) => {
        files[String(filePath).replace(/\\/g, '/')] = String(data);
      },
      now: () => new Date('2026-04-03T13:30:00.000Z'),
    });

    const orchestrator = new SddOrchestratorService({
      workspaceService,
    });

    const workOrder = orchestrator.handoff('multisurface/tenant-aware-session-continuity', {
      role: 'execution',
      actor: 'codex',
      summary: 'Implementation completed and ready for review.',
    });

    expect(workOrder.lifecycle).toBe('in_review');
    expect(workOrder.nextRole).toBe('review');
    expect(workOrder.brief.label).toBe('Review Agent');
    expect(workOrder.runState.lastActor).toBe('codex');
    expect(workOrder.runState.note).toBe('Implementation completed and ready for review.');
    expect(
      files['C:/tmp/zavorth/specs/features/multisurface/tenant-aware-session-continuity/handoff.md'],
    ).toContain('Implementation completed and ready for review.');
  });

  it('identifies whether a feature is already scaffolded before running the loop', () => {
    const files: Record<string, string> = {
      'C:/tmp/zavorth/specs/features/orchestrator/sdd-agent-loop/spec.md': '# Spec: SDD Agent Loop',
    };

    const workspaceService = new SddFeatureWorkspaceService({
      projectRoot: 'C:/tmp/zavorth',
      existsSync: (filePath: fs.PathLike) => Object.prototype.hasOwnProperty.call(files, String(filePath).replace(/\\/g, '/')),
      mkdirSync: () => undefined as any,
      readFileSync: (filePath: fs.PathOrFileDescriptor) => files[String(filePath).replace(/\\/g, '/')],
      writeFileSync: () => undefined as any,
      now: () => new Date('2026-04-03T13:45:00.000Z'),
    });

    const orchestrator = new SddOrchestratorService({
      workspaceService,
    });

    expect(orchestrator.isKnownFeature('orchestrator/sdd-agent-loop')).toBe(true);
    expect(orchestrator.isKnownFeature('orchestrator/ghost-loop')).toBe(false);
  });
});
