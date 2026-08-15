import { spawnSync } from 'child_process';
import path from 'path';


describe('provider mesh convergence check', () => {
  it('keeps the canonical Provider Mesh path green and reports known follow-ups as warnings', () => {
    const root = path.resolve(__dirname, '..', '..');
    const result = spawnSync(
      process.execPath,
      ['scripts/provider-mesh-convergence-check.mjs', '--json'],
      {
        cwd: root,
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.status).toBe('passed');
    expect(payload.summary.failed).toBe(0);
    expect(payload.rules.map((entry: any) => entry.id)).toEqual(
      expect.arrayContaining([
        'provider-mesh-canonical-stack',
        'catalog-api-facades',
        'onboarding-model-picker-consumer',
        'provider-mesh-product-onboarding',
        'providers-page-model-picker-consumer',
        'control-model-picker-consumer',
        'cli-model-picker-consumer',
        'control-plane-selection-resolution',
        'strategy-selection-consumer',
        'runtime-selection-bridge',
      ]),
    );
    expect(payload.warnings.map((entry: any) => entry.id)).toEqual(
      expect.arrayContaining([
        'provider-detail-model-picker-followup',
        'workspace-hardening-known-blocker',
      ]),
    );
  });
});
