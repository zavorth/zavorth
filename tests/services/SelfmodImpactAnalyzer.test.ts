import fs from 'fs';
import path from 'path';
import { SelfmodImpactAnalyzer } from '../../src/services/SelfmodImpactAnalyzer';
import { SelfmodOptimizationCatalog } from '../../src/services/SelfmodOptimizationCatalog';
import { SelfmodPatternMemory } from '../../src/services/SelfmodPatternMemory';
import { SelfmodRuntimeGuard } from '../../src/services/SelfmodRuntimeGuard';

describe('SelfmodImpactAnalyzer', () => {
  const tempRoot = path.join(process.cwd(), 'tmp', 'selfmod-impact-analyzer');
  const memoryFile = path.join(tempRoot, 'data', 'runtime', 'selfmod-pattern-memory.json');

  afterEach(() => {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('classifies gateway/runtime changes with richer operational analysis', () => {
    const patternMemory = new SelfmodPatternMemory({ filePath: memoryFile });
    const analyzer = new SelfmodImpactAnalyzer({
      runtimeGuard: new SelfmodRuntimeGuard(),
      optimizationCatalog: new SelfmodOptimizationCatalog(),
      patternMemory,
    });

    const result = analyzer.analyzeGoalPreview({
      goal: 'endurecer o gateway e revisar o runtime supervisionado',
      relativePaths: [
        'src/services/WebAppService.ts',
        'src/services/ZavorthGatewayControlSocketService.ts',
        'scripts/launch-zavorth-unified.ps1',
      ],
      resourceImpact: {
        ramIdleMb: 128,
        diskMb: 48,
        processCount: 1,
        notes: 'preview de runtime',
      },
      changeCount: 3,
    });

    expect(result.runtimeRisk.level).toMatch(/high|critical/);
    expect(result.runtimeRisk.requiresSupervisorAttention).toBe(true);
    expect(result.resourceDelta.summary).toContain('128 MB RAM');
    expect(result.companionImpact.companionIds).toEqual(expect.arrayContaining(['zavorthBridge', 'codex-companion']));
    expect(result.rollbackConfidence).toBeLessThan(0.8);
    expect(result.opportunities.map((entry) => entry.id)).toContain('runtime-sidecar-hygiene');
  });

  it('surfaces pattern memory signals for similar selfmod goals', () => {
    const patternMemory = new SelfmodPatternMemory({ filePath: memoryFile });
    const analyzer = new SelfmodImpactAnalyzer({
      runtimeGuard: new SelfmodRuntimeGuard(),
      optimizationCatalog: new SelfmodOptimizationCatalog(),
      patternMemory,
    });

    patternMemory.rememberPreview({
      goal: 'otimizar a surface web',
      relativePaths: ['src/services/WebAppService.ts'],
      analysis: analyzer.analyzeGoalPreview({
        goal: 'otimizar a surface web',
        relativePaths: ['src/services/WebAppService.ts'],
        resourceImpact: {
          ramIdleMb: 64,
          diskMb: 16,
          processCount: 0,
          notes: 'primeiro preview',
        },
        changeCount: 1,
      }),
    });
    patternMemory.rememberRollback({
      goal: 'otimizar a surface web',
      relativePaths: ['src/services/WebAppService.ts'],
      analysis: null,
    });

    const result = analyzer.analyzeGoalPreview({
      goal: 'polir novamente a surface web',
      relativePaths: ['src/services/WebAppService.ts'],
      resourceImpact: {
        ramIdleMb: 72,
        diskMb: 20,
        processCount: 0,
        notes: 'segundo preview',
      },
      changeCount: 1,
    });

    expect(result.patternSignals.length).toBeGreaterThan(0);
    expect(result.patternSignals.map((entry) => entry.summary).join(' ')).toContain('rollback');
  });
});
