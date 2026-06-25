import { readFileSync } from 'fs';
import { join } from 'path';

const rootDir = process.cwd();

describe('ZavorthControlQaIntegration', () => {
  const packageJson = JSON.parse(
    readFileSync(join(rootDir, 'package.json'), 'utf8'),
  ) as { scripts: Record<string, string> };

  it('exposes a single ZavorthControl QA script for product and CI flows', () => {
    const zavorthControlQa = packageJson.scripts['qa:zavorthControl'];
    for (const gate of [
      'npm run zavorth-control:check --silent',
      'npm run runtime-api-v1:check --silent',
      'npm run qa:zavorthControl-response-cortex --silent',
      'npm run qa:zavorthControl-provider-cockpit-visual --silent',
      'npm run qa:zavorthControl-provider-cockpit-live --silent',
      'npm run qa:zavorthControl-chat-visual --silent',
      'npm run qa:zavorthControl-composer-affordances --silent',
      'npm run qa:zavorthControl-browser-preview --silent',
      'npm run qa:zavorthControl-real --silent',
      'npm run qa:zavorthControl-cockpit --silent',
    ]) {
      expect(zavorthControlQa).toContain(gate);
    }
  });

  it('keeps the cockpit gate inside the dedicated ZavorthControl QA script', () => {
    const zavorthControlQa = packageJson.scripts['qa:zavorthControl'];

    expect(zavorthControlQa).toContain('qa:zavorthControl-cockpit');
    expect(zavorthControlQa).toContain('qa:zavorthControl-browser-preview');
    expect(zavorthControlQa).toContain('qa:zavorthControl-real');
    expect(zavorthControlQa).toContain('qa:zavorthControl-chat-visual');
    expect(zavorthControlQa).toContain('qa:zavorthControl-composer-affordances');
    expect(zavorthControlQa).toContain('qa:zavorthControl-response-cortex');
    expect(zavorthControlQa).toContain('zavorth-control:check');
  });

  it('runs the ZavorthControl gate in the local CI core path', () => {
    expect(packageJson.scripts['qa:ci:core']).toContain('npm run qa:zavorthControl --silent');
  });

  it('runs the ZavorthControl gate before the long product QA matrix', () => {
    const productQa = readFileSync(
      join(rootDir, 'scripts/product-final-qa.mjs'),
      'utf8',
    );

    expect(productQa).toContain("runStep('zavorth control cockpit gate', npmCmd, ['run', 'qa:zavorthControl'])");
    expect(productQa.indexOf("['run', 'qa:zavorthControl']")).toBeLessThan(
      productQa.indexOf("runStep('testes criticos de produto'"),
    );
  });

  it('documents the QA integration as part of the ZavorthControl readiness pack', () => {
    const readiness = readFileSync(
      join(rootDir, 'docs/product-direction.md'),
      'utf8',
    );
    const qaIntegration = readFileSync(
      join(rootDir, 'docs/product-direction.md'),
      'utf8',
    );

    expect(readiness).toContain('Data readiness');
    expect(readiness).toContain('qa:zavorthControl');
    expect(qaIntegration).toContain('qa:zavorthControl');
    expect(qaIntegration).toContain('qa:zavorthControl-real');
    expect(qaIntegration).toContain('qa:ci:core');
    expect(qaIntegration).toContain('qa:product');
  });
});
