import fs from 'fs';
import { SpecDrivenDevelopmentService } from '../../src/services/SpecDrivenDevelopmentService';

describe('SpecDrivenDevelopmentService', () => {
  it('creates spec, plan and tasks files from templates', () => {
    const writes: Record<string, string> = {};
    const service = new SpecDrivenDevelopmentService({
      projectRoot: 'C:/tmp/zavorth',
      existsSync: (filePath: fs.PathLike) => {
        const normalized = String(filePath).replace(/\\/g, '/');
        return normalized.endsWith('/specs/_templates/feature-spec.md')
          || normalized.endsWith('/specs/_templates/feature-plan.md')
          || normalized.endsWith('/specs/_templates/feature-tasks.md');
      },
      mkdirSync: () => undefined as any,
      writeFileSync: (filePath: fs.PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView) => {
        writes[String(filePath).replace(/\\/g, '/')] = String(data);
      },
      readFileSync: (filePath: fs.PathOrFileDescriptor) => {
        const normalized = String(filePath).replace(/\\/g, '/');
        if (normalized.endsWith('/specs/_templates/feature-spec.md')) {
          return '# {{FEATURE_TITLE}}\n{{FEATURE_ID}}\n{{FEATURE_PATH}}';
        }
        if (normalized.endsWith('/specs/_templates/feature-plan.md')) {
          return 'plan {{FEATURE_TITLE}}';
        }
        return 'tasks {{FEATURE_ID}}';
      },
    });

    const result = service.scaffoldFeature({
      featureId: 'Runtime/Nova Feature',
      title: 'Nova Feature',
    });

    expect(result.featureId).toBe('runtime/nova-feature');
    expect(result.filesCreated).toHaveLength(3);
    expect(writes['C:/tmp/zavorth/specs/features/runtime/nova-feature/spec.md']).toContain('Nova Feature');
    expect(writes['C:/tmp/zavorth/specs/features/runtime/nova-feature/spec.md']).toContain('runtime/nova-feature');
    expect(writes['C:/tmp/zavorth/specs/features/runtime/nova-feature/plan.md']).toContain('plan Nova Feature');
    expect(writes['C:/tmp/zavorth/specs/features/runtime/nova-feature/tasks.md']).toContain('tasks runtime/nova-feature');
  });

  it('skips files that already exist', () => {
    const existing = new Set<string>([
      'C:/tmp/zavorth/specs/_templates/feature-spec.md',
      'C:/tmp/zavorth/specs/_templates/feature-plan.md',
      'C:/tmp/zavorth/specs/_templates/feature-tasks.md',
      'C:/tmp/zavorth/specs/features/security/foo/spec.md',
    ]);

    const service = new SpecDrivenDevelopmentService({
      projectRoot: 'C:/tmp/zavorth',
      existsSync: (filePath: fs.PathLike) => existing.has(String(filePath).replace(/\\/g, '/')),
      mkdirSync: () => undefined as any,
      writeFileSync: () => undefined as any,
      readFileSync: () => 'template',
    });

    const result = service.scaffoldFeature({
      featureId: 'security/foo',
      title: 'Foo',
    });

    expect(result.filesSkipped.map((file) => file.replace(/\\/g, '/'))).toContain(
      'C:/tmp/zavorth/specs/features/security/foo/spec.md',
    );
    expect(result.filesCreated).toHaveLength(2);
  });
});
