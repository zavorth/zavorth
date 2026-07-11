import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LlmRuntimeService } from '../../../src/services/llm/LlmRuntimeService.js';
import { writeProviderPreference } from '../../../src/services/UserSelectionResolver.js';

describe('V9 secondary-model runtime path', () => {
  it('retries the selected provider with the saved secondary model before provider fallback', async () => {
    const previousCwd = process.cwd();
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-secondary-'));
    writeProviderPreference({
      projectRoot,
      providerId: 'openai',
      modelId: 'primary-model',
      secondaryModelId: 'secondary-model',
    });

    process.chdir(projectRoot);
    try {
      const runtime = new LlmRuntimeService('openai') as any;
      runtime.isProviderAvailable = () => true;
      runtime.createProvider = () => ({});
      runtime.chatProvider = jest.fn(async (input: { modelName: string }) => {
        if (input.modelName === 'primary-model') throw new Error('primary unavailable');
        return { content: 'secondary ok', toolCalls: [] };
      });

      const result = await runtime.chatDetailed(
        [{ role: 'user', content: 'hello' }],
        undefined,
        { providerName: 'openai', modelName: 'primary-model', allowFallback: false },
      );

      expect(runtime.chatProvider).toHaveBeenCalledTimes(2);
      expect(runtime.chatProvider.mock.calls.map((call: any[]) => call[0].modelName)).toEqual([
        'primary-model',
        'secondary-model',
      ]);
      expect(result.modelName).toBe('secondary-model');
      expect(result.metadata).toMatchObject({
        usedSecondaryModel: true,
        secondaryModelId: 'secondary-model',
      });
      expect(result.route.attempts.map((attempt) => attempt.modelName)).toEqual([
        'primary-model',
        'secondary-model',
      ]);
    } finally {
      process.chdir(previousCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
