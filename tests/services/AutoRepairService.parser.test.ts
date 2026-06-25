import { AutoRepairService } from '../../src/services/AutoRepairService';

describe('AutoRepairService extractStructuredFailure parser', () => {
  it('returns null for empty or success stdout logs', () => {
    const service = new AutoRepairService({ existsSync: () => false });
    expect(service.extractStructuredFailure('')).toBeNull();
    expect(service.extractStructuredFailure('PASS tests/unit/tokenCounter.test.ts\nAll tests passed!')).toBeNull();
  });

  it('correctly parses a standard Jest failure log', () => {
    const service = new AutoRepairService({ existsSync: () => false });
    const jestLog = `
FAIL tests/services/SpecDrivenDevelopmentService.compliance.test.ts
  ● SpecDrivenDevelopmentService compliance validation › scans files and signatures, returning compliant=true when all requirements exist

    expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: false

      36 |
      37 |     const result = await service.validateFeatureCompliance('my-feature', []);
    > 38 |     expect(result.compliant).toBe(true);
         |                              ^
      39 |     expect(result.report).toContain('Status: COMPLIANT');
      40 |     expect(result.report).toContain('- [x] src/services/MyNewService.ts');

      at Object.<anonymous> (tests/services/SpecDrivenDevelopmentService.compliance.test.ts:38:30)
      at Promise.then.completed (node_modules/jest-circus/build/utils.js:298:28)
    `;

    const failure = service.extractStructuredFailure(jestLog);
    expect(failure).not.toBeNull();
    expect(failure!.testName).toBe('SpecDrivenDevelopmentService compliance validation › scans files and signatures, returning compliant=true when all requirements exist');
    expect(failure!.file).toBe('tests/services/SpecDrivenDevelopmentService.compliance.test.ts');
    expect(failure!.line).toBe(38);
    expect(failure!.error).toContain('Expected: true');
    expect(failure!.error).toContain('Received: false');
    expect(failure!.error).not.toContain('expect(result.compliant).toBe(true)'); // Code frame should be cleaned
  });

  it('falls back to first stack trace match if no bullet point test name is found', () => {
    const service = new AutoRepairService({ existsSync: () => false });
    const fallbackLog = `
    Error: Something went wrong in runtime execution.
      at handleRun (src/runtime/agent/AgentRunNativeToolLoopService.ts:455:12)
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
    `;

    const failure = service.extractStructuredFailure(fallbackLog);
    expect(failure).not.toBeNull();
    expect(failure!.testName).toBe('Unknown Test');
    expect(failure!.file).toBe('src/runtime/agent/AgentRunNativeToolLoopService.ts');
    expect(failure!.line).toBe(455);
    expect(failure!.error).toBe('Assertion failed / Test failed');
  });
});
