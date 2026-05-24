import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IntentExampleSimilarityService } from '../../src/services/IntentExampleSimilarityService';

describe('IntentExampleSimilarityService', () => {
  it('matches trainable examples without changing classifier code', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-intent-examples-'));
    const file = path.join(root, 'intent-examples.json');
    fs.writeFileSync(file, JSON.stringify({
      examples: [
        {
          text: 'what time is it in Brasilia',
          intent: 'tool-use',
          route: 'tool-preview',
          risk: 'safe',
          signals: ['datetime'],
        },
      ],
    }), 'utf8');

    const match = new IntentExampleSimilarityService({ examplesPath: file }).match('tell me the time in Brasilia please');

    expect(match).toEqual(expect.objectContaining({
      intent: 'tool-use',
      route: 'tool-preview',
      risk: 'safe',
    }));
    expect(match!.score).toBeGreaterThan(0.42);
  });
});
