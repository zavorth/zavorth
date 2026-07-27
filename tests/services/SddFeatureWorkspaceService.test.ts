import fs from 'fs';
import { SddFeatureWorkspaceService } from '../../src/services/SddFeatureWorkspaceService';

describe('SddFeatureWorkspaceService', () => {
  it('inspects a feature workspace and derives the execution role from open tasks', () => {
    const files: Record<string, string> = {
      'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/spec.md': [
        '# Spec: Shared Command Contract',
        '',
        'A feature linked to [SharedSurfaceCommandService](C:\\TESTES DEV\\zavorth-core\\Zavorth\\src\\services\\SharedSurfaceCommandService.ts).',
      ].join('\n'),
      'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/plan.md': [
        '# Plan: Shared Command Contract',
        '',
        'Touch [CoreOrchestrator](C:\\TESTES DEV\\zavorth-core\\Zavorth\\src\\core\\CoreOrchestrator.ts).',
      ].join('\n'),
      'C:/tmp/zavorth/specs/features/multisurface/shared-command-contract/tasks.md': [
        '# Tasks',
        '',
        '- [x] T1. Definir o contrato shared',
        '- [ ] T2. Integrar o core ao contrato',
      ].join('\n'),
    };

    const service = new SddFeatureWorkspaceService({
      projectRoot: 'C:/tmp/zavorth',
      existsSync: (filePath: fs.PathLike) => Object.prototype.hasOwnProperty.call(files, String(filePath).replace(/\\/g, '/')),
      mkdirSync: () => undefined as any,
      readFileSync: (filePath: fs.PathOrFileDescriptor) => files[String(filePath).replace(/\\/g, '/')],
      writeFileSync: () => undefined as any,
      now: () => new Date('2026-04-03T12:00:00.000Z'),
    });

    const snapshot = service.inspect('Multisurface/Shared Command Contract');

    expect(snapshot.featureId).toBe('multisurface/shared-command-contract');
    expect(snapshot.title).toBe('Shared Command Contract');
    expect(snapshot.nextRole).toBe('execution');
    expect(snapshot.lifecycle).toBe('active');
    expect(snapshot.currentTask).toEqual(expect.objectContaining({
      taskId: 'T2',
      text: 'Integrar o core ao contrato',
    }));
    expect(snapshot.completedTasks).toHaveLength(1);
    expect(snapshot.openTasks).toHaveLength(1);
    expect(snapshot.referencedFiles).toEqual([
      'C:\\TESTES DEV\\zavorth-core\\Zavorth\\src\\services\\SharedSurfaceCommandService.ts',
      'C:\\TESTES DEV\\zavorth-core\\Zavorth\\src\\core\\CoreOrchestrator.ts',
    ]);
  });

  it('creates run-state and handoff control files when they are missing', () => {
    const files: Record<string, string> = {
      'C:/tmp/zavorth/specs/features/runtime/loop-core/spec.md': '# Spec: Loop Core',
      'C:/tmp/zavorth/specs/features/runtime/loop-core/plan.md': '# Plan: Loop Core',
      'C:/tmp/zavorth/specs/features/runtime/loop-core/tasks.md': '- [ ] T1. Implementar o loop',
    };

    const service = new SddFeatureWorkspaceService({
      projectRoot: 'C:/tmp/zavorth',
      existsSync: (filePath: fs.PathLike) => Object.prototype.hasOwnProperty.call(files, String(filePath).replace(/\\/g, '/')),
      mkdirSync: () => undefined as any,
      readFileSync: (filePath: fs.PathOrFileDescriptor) => files[String(filePath).replace(/\\/g, '/')],
      writeFileSync: (filePath: fs.PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView) => {
        files[String(filePath).replace(/\\/g, '/')] = String(data);
      },
      now: () => new Date('2026-04-03T12:30:00.000Z'),
    });

    const snapshot = service.ensureControlFiles('runtime/loop-core');

    const runStatePath = 'C:/tmp/zavorth/specs/features/runtime/loop-core/run-state.json';
    const handoffPath = 'C:/tmp/zavorth/specs/features/runtime/loop-core/handoff.md';

    expect(snapshot.runState).toEqual(expect.objectContaining({
      featureId: 'runtime/loop-core',
      currentRole: 'execution',
      currentTask: 'Implementar o loop',
      lifecycle: 'active',
    }));
    expect(files[runStatePath]).toContain('"currentRole": "execution"');
    expect(files[runStatePath]).toContain('"currentTask": "Implementar o loop"');
    expect(files[handoffPath]).toContain('# Handoff');
    expect(files[handoffPath]).toContain('Feature: `runtime/loop-core`');
  });
});
