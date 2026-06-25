import fs from 'fs';
import { SpecDrivenDevelopmentService } from '../../src/services/SpecDrivenDevelopmentService';

describe('SpecDrivenDevelopmentService compliance validation', () => {
  it('returns compliant=false when spec.md or plan.md is missing', async () => {
    const service = new SpecDrivenDevelopmentService({
      projectRoot: 'C:/tmp/zavorth',
      existsSync: () => false,
      readFileSync: () => { throw new Error('File not found'); }
    });

    const result = await service.validateFeatureCompliance('some-feature', []);
    expect(result.compliant).toBe(false);
    expect(result.report).toContain('Feature specs not found under');
  });

  it('scans files and signatures, returning compliant=true when all requirements exist', async () => {
    const virtualFs: Record<string, string> = {
      'C:/tmp/zavorth/specs/features/my-feature/spec.md': 'We will modify `src/services/MyNewService.ts` and test in `tests/services/MyNewService.test.ts`. Should contain class `MyNewService` and method `runFeature`.',
      'C:/tmp/zavorth/specs/features/my-feature/plan.md': 'Verify in `tests/services/MyNewService.test.ts`. Class `MyNewService` has method `runFeature`.',
      'C:/tmp/zavorth/src/services/MyNewService.ts': 'export class MyNewService { public runFeature() { return true; } }',
      'C:/tmp/zavorth/tests/services/MyNewService.test.ts': 'describe("MyNewService", () => { it("works", () => { const s = new MyNewService(); s.runFeature(); }); });'
    };

    const service = new SpecDrivenDevelopmentService({
      projectRoot: 'C:/tmp/zavorth',
      existsSync: (filePath: fs.PathLike) => {
        const normalized = String(filePath).replace(/\\/g, '/');
        return normalized in virtualFs;
      },
      readFileSync: (filePath: fs.PathOrFileDescriptor) => {
        const normalized = String(filePath).replace(/\\/g, '/');
        return virtualFs[normalized] || '';
      }
    });

    const result = await service.validateFeatureCompliance('my-feature', []);
    expect(result.compliant).toBe(true);
    expect(result.report).toContain('Status: COMPLIANT');
    expect(result.report).toContain('- [x] src/services/MyNewService.ts');
    expect(result.report).toContain('- [x] tests/services/MyNewService.test.ts');
    expect(result.report).toContain('- [x] Class/Type `MyNewService`');
    expect(result.report).toContain('- [x] Method/Function `runFeature`');
  });

  it('returns compliant=false when files are missing or signatures are missing', async () => {
    const virtualFs: Record<string, string> = {
      'C:/tmp/zavorth/specs/features/my-feature/spec.md': 'We will modify `src/services/MyNewService.ts` and test in `tests/services/MyNewService.test.ts`. Should contain class `MyNewService` and method `runFeature`.',
      'C:/tmp/zavorth/specs/features/my-feature/plan.md': 'Class `MyNewService` has method `runFeature`.',
      // MyNewService.ts exists but does NOT contain runFeature method
      'C:/tmp/zavorth/src/services/MyNewService.ts': 'export class MyNewService { public differentMethod() {} }',
      // tests/services/MyNewService.test.ts is missing
    };

    const service = new SpecDrivenDevelopmentService({
      projectRoot: 'C:/tmp/zavorth',
      existsSync: (filePath: fs.PathLike) => {
        const normalized = String(filePath).replace(/\\/g, '/');
        return normalized in virtualFs;
      },
      readFileSync: (filePath: fs.PathOrFileDescriptor) => {
        const normalized = String(filePath).replace(/\\/g, '/');
        return virtualFs[normalized] || '';
      }
    });

    const result = await service.validateFeatureCompliance('my-feature', []);
    expect(result.compliant).toBe(false);
    expect(result.report).toContain('Status: NON-COMPLIANT');
    expect(result.report).toContain('- [x] src/services/MyNewService.ts');
    expect(result.report).toContain('- [ ] tests/services/MyNewService.test.ts');
    expect(result.report).toContain('- [x] Class/Type `MyNewService`');
    expect(result.report).toContain('- [ ] Method/Function `runFeature`');
  });
});
