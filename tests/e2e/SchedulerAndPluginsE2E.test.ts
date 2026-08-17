import { ZavorthE2EHarness } from '../../src/testing/e2e/ZavorthE2EHarness.js';
import { definePlugin } from '../../src/plugin-sdk/index.js';
import { BaseTool } from '../../src/tools/BaseTool.js';

describe('SchedulerAndPluginsE2E', () => {
  let harness: ZavorthE2EHarness;

  beforeAll(() => {
    harness = new ZavorthE2EHarness({ enableScheduler: true });
  });

  afterAll(() => {
    harness.dispose();
  });

  it('should register a dynamic plugin and execute tool calls over the test harness', async () => {
    class E2ETestCalculatorTool extends BaseTool {
      readonly name = 'e2e_calc';
      readonly description = 'Calculates sum for E2E test';
      readonly parameters = {
        type: 'object' as const,
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      };

      public async execute(args: Record<string, unknown>): Promise<string> {
        const sum = Number(args.a) + Number(args.b);
        return JSON.stringify({ status: 'success', sum });
      }
    }

    const testPlugin = definePlugin({
      id: 'e2e_calc_plugin',
      manifest: {
        name: 'e2e_calc_plugin',
        version: '1.0.0',
        description: 'E2E test plugin',
        main: 'index.js',
        capabilities: ['tools'],
        permissions: ['filesystem.read'],
      },
      initialize: (ctx) => {
        ctx.registerTool(new E2ETestCalculatorTool());
      },
    });

    const record = await harness.pluginRegistry.registerAndInitialize(testPlugin);
    expect(record.status).toBe('active');
    expect(record.registeredTools.has('e2e_calc')).toBe(true);

    const calcTool = record.registeredTools.get('e2e_calc');
    expect(calcTool).toBeDefined();

    const output = await calcTool!.execute({ a: 15, b: 27 });
    const parsed = JSON.parse(output);
    expect(parsed.sum).toBe(42);

    // Unload cleanup
    await harness.pluginRegistry.unload('e2e_calc_plugin');
    expect(harness.pluginRegistry.getPlugin('e2e_calc_plugin')).toBeUndefined();
  });
});
