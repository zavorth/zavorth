import { readFileSync } from 'fs';
import { join } from 'path';

const rootDir = process.cwd();

describe('CommandCenterQaIntegration', () => {
  const packageJson = JSON.parse(
    readFileSync(join(rootDir, 'package.json'), 'utf8'),
  ) as { scripts: Record<string, string> };

  it('exposes a single Command Center QA script for product and CI flows', () => {
    expect(packageJson.scripts['qa:command-center']).toBe(
      [
        'npm run qa:command-center-cockpit --silent',
        'npm run qa:command-center-browser-preview --silent',
        'npm run qa:command-center-real --silent',
        'npm run qa:command-center-chat-visual --silent',
        'npm run qa:command-center-composer-affordances --silent',
        'npm run qa:command-center-response-cortex --silent',
        'npm run ai-gateway:check --silent',
      ].join(' && '),
    );
  });

  it('keeps the cockpit gate inside the dedicated Command Center QA script', () => {
    const commandCenterQa = packageJson.scripts['qa:command-center'];

    expect(commandCenterQa).toContain('qa:command-center-cockpit');
    expect(commandCenterQa).toContain('qa:command-center-browser-preview');
    expect(commandCenterQa).toContain('qa:command-center-real');
    expect(commandCenterQa).toContain('qa:command-center-chat-visual');
    expect(commandCenterQa).toContain('qa:command-center-composer-affordances');
    expect(commandCenterQa).toContain('qa:command-center-response-cortex');
    expect(commandCenterQa).toContain('ai-gateway:check');
  });

  it('runs the Command Center gate in the local CI core path', () => {
    expect(packageJson.scripts['qa:ci:core']).toContain('npm run qa:command-center --silent');
  });

  it('runs the Command Center gate before the long product QA matrix', () => {
    const productQa = readFileSync(
      join(rootDir, 'scripts/product-final-qa.mjs'),
      'utf8',
    );

    expect(productQa).toContain("runStep('command center cockpit gate', npmCmd, ['run', 'qa:command-center'])");
    expect(productQa.indexOf("['run', 'qa:command-center']")).toBeLessThan(
      productQa.indexOf("runStep('testes criticos de produto'"),
    );
  });

  it('documents the QA integration as part of the Command Center readiness pack', () => {
    const readiness = readFileSync(
      join(rootDir, 'docs/product-direction.md'),
      'utf8',
    );
    const qaIntegration = readFileSync(
      join(rootDir, 'docs/product-direction.md'),
      'utf8',
    );

    expect(readiness).toContain('Data readiness');
    expect(readiness).toContain('qa:command-center');
    expect(qaIntegration).toContain('qa:command-center');
    expect(qaIntegration).toContain('qa:command-center-real');
    expect(qaIntegration).toContain('qa:ci:core');
    expect(qaIntegration).toContain('qa:product');
  });
});
