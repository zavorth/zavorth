import { readFileSync } from 'fs';
import { join } from 'path';

const rootDir = process.cwd();

describe('DashboardQaIntegration', () => {
  const packageJson = JSON.parse(
    readFileSync(join(rootDir, 'package.json'), 'utf8'),
  ) as { scripts: Record<string, string> };

  it('exposes a single Dashboard QA script for product and CI flows', () => {
    expect(packageJson.scripts['qa:dashboard']).toBe(
      [
        'npm run qa:dashboard-cockpit --silent',
        'npm run qa:dashboard-browser-preview --silent',
        'npm run qa:dashboard-real --silent',
        'npm run qa:dashboard-chat-visual --silent',
        'npm run qa:dashboard-composer-affordances --silent',
        'npm run qa:dashboard-response-cortex --silent',
        'npm run ai-gateway:check --silent',
      ].join(' && '),
    );
  });

  it('keeps the cockpit gate inside the dedicated Dashboard QA script', () => {
    const dashboardQa = packageJson.scripts['qa:dashboard'];

    expect(dashboardQa).toContain('qa:dashboard-cockpit');
    expect(dashboardQa).toContain('qa:dashboard-browser-preview');
    expect(dashboardQa).toContain('qa:dashboard-real');
    expect(dashboardQa).toContain('qa:dashboard-chat-visual');
    expect(dashboardQa).toContain('qa:dashboard-composer-affordances');
    expect(dashboardQa).toContain('qa:dashboard-response-cortex');
    expect(dashboardQa).toContain('ai-gateway:check');
  });

  it('runs the Dashboard gate in the local CI core path', () => {
    expect(packageJson.scripts['qa:ci:core']).toContain('npm run qa:dashboard --silent');
  });

  it('runs the Dashboard gate before the long product QA matrix', () => {
    const productQa = readFileSync(
      join(rootDir, 'scripts/product-final-qa.mjs'),
      'utf8',
    );

    expect(productQa).toContain("runStep('command center cockpit gate', npmCmd, ['run', 'qa:dashboard'])");
    expect(productQa.indexOf("['run', 'qa:dashboard']")).toBeLessThan(
      productQa.indexOf("runStep('testes criticos de produto'"),
    );
  });

  it('documents the QA integration as part of the Dashboard readiness pack', () => {
    const readiness = readFileSync(
      join(rootDir, 'docs/product-direction.md'),
      'utf8',
    );
    const qaIntegration = readFileSync(
      join(rootDir, 'docs/product-direction.md'),
      'utf8',
    );

    expect(readiness).toContain('Data readiness');
    expect(readiness).toContain('qa:dashboard');
    expect(qaIntegration).toContain('qa:dashboard');
    expect(qaIntegration).toContain('qa:dashboard-real');
    expect(qaIntegration).toContain('qa:ci:core');
    expect(qaIntegration).toContain('qa:product');
  });
});
