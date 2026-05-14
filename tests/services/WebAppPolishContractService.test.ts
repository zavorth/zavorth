import { WebAppPolishContractService } from '../../src/services/WebAppPolishContractService';
import { buildRuntimeShellHtml } from '../../src/domain/surface/presentation/web-console/WebConsoleRuntimeShellHtml';
import { buildRuntimeShellScript } from '../../src/domain/surface/presentation/web-console/WebConsoleRuntimeShellScript';
import { buildRuntimeShellStyles } from '../../src/domain/surface/presentation/web-console/WebConsoleRuntimeShellStyles';

describe('WebAppPolishContractService', () => {
  it('passes against the current repository web/app polish contract', () => {
    const service = new WebAppPolishContractService();
    const snapshot = service.buildSnapshot();

    expect(snapshot.phase).toBe('40');
    expect(snapshot.surface).toBe('web-app-polish');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.requirements.map((requirement) => requirement.id)).toContain('product-command-rail');
    expect(snapshot.nextRecommendedPhase).toEqual(expect.objectContaining({
      phase: '43',
      title: 'Artifact And Replay Workbench',
    }));
  });

  it('fails when the product command rail loses the canonical CLI journey', () => {
    const html = buildRuntimeShellHtml('/control')
      .replace('id="product-command-chat"', 'id="product-command-chat-missing"')
      .replace('zavorth doctor', 'zavorth diagnose');
    const service = new WebAppPolishContractService({
      html,
      script: buildRuntimeShellScript(),
      styles: buildRuntimeShellStyles(),
      packageJson: packageJsonFixture(),
      existsSync: () => true,
      readFileSync: () => '',
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'requirement:product-command-rail',
        status: 'fail',
      }),
    ]));
  });

  it('fails when web polish package gates are not exposed', () => {
    const service = new WebAppPolishContractService({
      html: buildRuntimeShellHtml('/control'),
      script: buildRuntimeShellScript(),
      styles: buildRuntimeShellStyles(),
      packageJson: packageJsonFixture({
        'qa:web-app-polish': '',
        'qa:phase:40': '',
      }),
      existsSync: () => true,
      readFileSync: () => '',
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'package:qa:web-app-polish',
        status: 'fail',
      }),
      expect.objectContaining({
        id: 'package:qa:phase:40',
        status: 'fail',
      }),
    ]));
  });

  it('fails when the responsive layout contract disappears', () => {
    const service = new WebAppPolishContractService({
      html: buildRuntimeShellHtml('/control'),
      script: buildRuntimeShellScript(),
      styles: buildRuntimeShellStyles().replace('@media (max-width: 640px)', '@media (min-width: 641px)'),
      packageJson: packageJsonFixture(),
      existsSync: () => true,
      readFileSync: () => '',
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'requirement:responsive-scannable-layout',
        status: 'fail',
      }),
    ]));
  });

  it('renders a human report with the next phase recommendation', () => {
    const service = new WebAppPolishContractService({
      html: buildRuntimeShellHtml('/control'),
      script: buildRuntimeShellScript(),
      styles: buildRuntimeShellStyles(),
      packageJson: packageJsonFixture(),
      existsSync: () => true,
      readFileSync: () => '',
      now: () => new Date('2026-04-24T00:00:00.000Z'),
    });

    const report = service.renderReport();

    expect(report).toContain('Fase 40 - Web/App Polish');
    expect(report).toContain('proxima fase recomendada: 43 - Artifact And Replay Workbench');
  });
});

function packageJsonFixture(overrides: Record<string, string> = {}) {
  return {
    scripts: {
      'web-surface:check': 'node scripts/check-surface-syntax.mjs --target=web-components',
      'test:web:qa': 'jest tests/domain/surface/presentation/dashboard --runInBand',
      'test:web:smoke': 'node scripts/web-app-smoke.mjs',
      'qa:web-app-polish': 'npx tsx scripts/web-app-polish.ts --require-pass',
      'qa:phase:40': 'node scripts/phases-39-45-check.mjs --phase=40',
      ...overrides,
    },
  };
}
