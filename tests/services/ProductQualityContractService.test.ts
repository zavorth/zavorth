import { ProductQualityContractService } from '../../src/services/ProductQualityContractService';

describe('ProductQualityContractService', () => {
  it('passes against the current repository product contract', () => {
    const service = new ProductQualityContractService();
    const snapshot = service.buildSnapshot();

    expect(snapshot.gate).toBe('product-quality');
    expect(snapshot.surface).toBe('product-quality-contract');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.officialJourney).toEqual([
      'zavorth setup',
      'zavorth go',
      'zavorth chat',
      'zavorth status',
      'zavorth doctor',
    ]);
    expect(snapshot.nextRecommendedGate).toEqual(expect.objectContaining({
      gate: 'deterministic-qa',
      title: 'QA Deterministico',
    }));
  });

  it('fails when a canonical product alias disappears', () => {
    const service = new ProductQualityContractService({
      packageJson: packageJsonFixture({
        chat: '',
      }),
      files: filesFixture(),
      existsSync: () => true,
      readFileSync: () => '',
      now: () => new Date('2026-04-24T00:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'package:alias:chat',
        status: 'fail',
      }),
    ]));
  });

  it('fails when docs expose npm ops before the product journey', () => {
    const files = filesFixture({
      'README.md': [
        '# Zavorth',
        'npm run ops:start',
        'First Use In 60 Seconds',
        'zavorth setup',
        'zavorth go',
        'zavorth chat',
        'zavorth doctor',
        '--json',
        'Advanced And Maintenance Track',
      ].join('\n'),
    });
    const service = new ProductQualityContractService({
      packageJson: packageJsonFixture(),
      files,
      existsSync: () => true,
      readFileSync: () => '',
    });

    const snapshot = service.buildSnapshot();
    const readme = snapshot.checks.find((check) => check.id === 'doc:README.md');

    expect(readme?.status).toBe('fail');
    expect(readme?.evidence?.join('\n')).toContain('npm run ops:* aparece antes');
  });

  it('renders a human report with the next gate recommendation', () => {
    const service = new ProductQualityContractService({
      packageJson: packageJsonFixture(),
      files: filesFixture(),
      existsSync: () => true,
      readFileSync: () => '',
      now: () => new Date('2026-04-24T00:00:00.000Z'),
    });

    const report = service.renderReport();

    expect(report).toContain('[product-quality] Product Quality Contract');
    expect(report).toContain('proximo passo recomendada: deterministic-qa - QA Deterministico');
  });
});

function packageJsonFixture(overrides: Record<string, string> = {}) {
  const scripts = {
    onboard: 'npx tsx scripts/setup-v3.ts',
    go: 'npx tsx scripts/ops-go.ts',
    chat: 'npm run cli -- chat',
    doctor: 'npm run cli -- doctor',
    status: 'npm run cli -- status',
    cockpit: 'npm run cli -- cockpit',
    capabilities: 'npm run cli -- capabilities',
    tasks: 'npm run cli -- tasks',
    artifacts: 'npm run cli -- artifacts',
    supervisor: 'npm run cli -- supervisor',
    'memory:review': 'npm run cli -- memory review',
    heal: 'npm run cli -- heal --preview',
    'release:status': 'npm run cli -- release status',
    'test:cli': 'jest tests/cli/ZavorthCli.test.ts tests/cli/ZavorthCliVisualContract.test.ts --runInBand',
    'qa:product-experience': 'node scripts/product-experience-readiness.mjs',
    'qa:flows': 'jest tests/integration/EndToEndFlowHarness.test.ts --runInBand',
    'qa:product-quality': 'npx tsx scripts/product-quality-contract.ts --require-pass',
    ...overrides,
  };

  return {
    bin: {
      zavorth: './dist/zavorth-cli.js',
    },
    scripts,
  };
}

function filesFixture(overrides: Record<string, string> = {}) {
  const readme = [
    '# Zavorth',
    'First Use In 60 Seconds',
    'zavorth setup',
    'zavorth go',
    'zavorth chat',
    'zavorth doctor',
    '--json',
    'Advanced And Maintenance Track',
    'npm run ops:*',
  ].join('\n');
  const quickstart = [
    'zavorth setup',
    'zavorth go',
    'zavorth chat',
    'zavorth doctor',
    '--json',
  ].join('\n');
  const cli = [
    'Happy Path',
    'Human Output Vs JSON',
    'CLI Quality Checklist',
    'Sem `--json`, a CLI deve ser produto',
    'Com `--json`, a CLI deve ser previsivel para automacao',
    'Regra: humano bonito; JSON limpo.',
    'zavorth setup',
    'zavorth go',
    'zavorth chat',
    'zavorth doctor',
  ].join('\n');
  const diagnosis = [
    'a short official path',
    'zavorth setup',
    'zavorth go',
    'zavorth chat',
    'CLI stage acceptance checklist',
  ].join('\n');
  const visual = [
    'FORBIDDEN_FIRST_LAYER_PATTERNS',
    'npm run ops:',
    'sessionId',
    'chatId',
    'control plane',
  ].join('\n');

  return {
    'README.md': readme,
    'docs/quickstart.md': quickstart,
    'docs/zavorth-cli.md': cli,
    'docs/product-direction.md': diagnosis,
    'tests/cli/ZavorthCliVisualContract.test.ts': visual,
    ...overrides,
  };
}
