import { spawnSync } from 'child_process';
import path from 'path';


describe('Productization contract check', () => {
  it('keeps C9 productization wired through shared runtime, CLI, docs and website contracts', () => {
    const root = path.resolve(__dirname, '..', '..');
    const result = spawnSync(
      process.execPath,
      ['scripts/productization-contract-check.mjs', '--json'],
      {
        cwd: root,
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.status).toBe('passed');
    expect(payload.summary.failed).toBe(0);
    expect(payload.rules.map((entry: any) => entry.id)).toEqual(expect.arrayContaining([
      'c9-productization-contract-service',
      'control-contract-items',
      'runtime-attaches-c9-snapshot',
      'cli-renders-same-contract',
      'control-renders-c9-contract',
      'onboarding-docs-website-covered',
      'package-exposes-productization-gate',
    ]));
  });
});
