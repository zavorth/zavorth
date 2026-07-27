import { WebAppPolishContractService } from '../../src/services/WebAppPolishContractService';
import { buildRuntimeShellHtml } from '../../src/domain/surface/presentation/web-console/WebConsoleRuntimeShellHtml';
import { buildRuntimeShellScript } from '../../src/domain/surface/presentation/web-console/WebConsoleRuntimeShellScript';
import { buildRuntimeShellStyles } from '../../src/domain/surface/presentation/web-console/WebConsoleRuntimeShellStyles';

describe('WebAppPolishContractService', () => {
  it('passes against the current repository web/app polish contract', () => {
    const service = new WebAppPolishContractService();
    const snapshot = service.buildSnapshot();

    expect(snapshot.gate).toBe('web-app-polish');
    expect(snapshot.surface).toBe('web-app-polish');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.requirements.map((requirement) => requirement.id)).toContain('product-command-rail');
    expect(snapshot.nextRecommendedGate).toEqual(expect.objectContaining({
      stage: '43',
      title: 'Artifact And Replay Workbench',
    }));
  });

  it('fails when the product command rail loses the canonical CLI journey', () => {
    const html = buildRuntimeShellHtml('/zavorthControl')
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
      html: buildRuntimeShellHtml('/zavorthControl'),
      script: buildRuntimeShellScript(),
      styles: buildRuntimeShellStyles(),
      packageJson: packageJsonFixture({
        'qa:web-app-polish': '',
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
    ]));
  });

  it('fails when the responsive layout contract disappears', () => {
    const service = new WebAppPolishContractService({
      html: buildRuntimeShellHtml('/zavorthControl'),
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

  it('renders a human report with the next gate recommendation', () => {
    const service = new WebAppPolishContractService({
      html: buildRuntimeShellHtml('/zavorthControl'),
      script: buildRuntimeShellScript(),
      styles: buildRuntimeShellStyles(),
      packageJson: packageJsonFixture(),
      existsSync: () => true,
      readFileSync: () => '',
      now: () => new Date('2026-04-24T00:00:00.000Z'),
    });

    const report = service.renderReport();

    expect(report).toContain('Gate web-app-polish - Web/App Polish');
    expect(report).toContain('next step recomendada: 43 - Artifact And Replay Workbench');
  });
});

function packageJsonFixture(overrides: Record<string, string> = {}) {
  return {
    scripts: {
      'web-surface:check': 'node scripts/check-surface-syntax.mjs --target=web-components',
      'test:web:qa': 'jest tests/domain/surface/presentation/dashboard --runInBand',
      'test:web:smoke': 'node scripts/web-app-smoke.mjs',
      'qa:web-app-polish': 'npx tsx scripts/web-app-polish.ts --require-pass',
      ...overrides,
    },
  };
}
