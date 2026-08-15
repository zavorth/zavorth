import { spawnSync } from 'child_process';
import path from 'path';


describe('AI Gateway native hygiene convergence check', () => {
  it('keeps the C8 convergence path on Zavorth-native contracts', () => {
    const root = path.resolve(__dirname, '..', '..');
    const result = spawnSync(
      process.execPath,
      ['scripts/zavorth-control-native-convergence-check.mjs', '--json'],
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
      'c8-native-hygiene-convergence-service',
      'runtime-attaches-c8-snapshot',
      'agent-gateway-real-snapshot-consumer',
      'provider-plane-through-model-picker',
      'budget-route-observability-correlation',
      'proxy-sse-remain-adapters',
    ]));
  });
});
