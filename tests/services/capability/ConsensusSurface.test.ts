import {
  parseConsensusSurfaceTokens,
  formatConsensusHelp,
  invokeConsensusSurface,
} from '../../../src/services/ConsensusSurface.js';
import type { LlmRuntimeService } from '../../../src/services/llm/LlmRuntimeService.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('ConsensusSurface (CLI + slash shared)', () => {
  it('parses run with reviewers', () => {
    const args = parseConsensusSurfaceTokens([
      'run',
      'Ship A or B-',
      '--reviewer',
      'ollama:llama3.2',
      '--reviewer',
      'deepseek:deepseek-chat',
      '--strategy',
      'explicit',
    ]);
    expect(args.action).toBe('run');
    expect(args.query).toBe('Ship A or B-');
    expect(args.reviewers).toEqual([
      { provider: 'ollama', model: 'llama3.2' },
      { provider: 'deepseek', model: 'deepseek-chat' },
    ]);
    expect(args.strategy).toBe('explicit');
  });

  it('empty tokens open home (not a forced run)', () => {
    expect(parseConsensusSurfaceTokens([]).action).toBe('home');
  });

  it('natural question without run verb becomes run', () => {
    const args = parseConsensusSurfaceTokens(['Should', 'we', 'ship', 'A', 'or', 'B-']);
    expect(args.action).toBe('run');
    expect(args.query).toBe('Should we ship A or B-');
  });

  it('natural question can still take optional flags', () => {
    const args = parseConsensusSurfaceTokens([
      'Ship',
      'A',
      'or',
      'B-',
      '--strategy',
      'user_stack',
    ]);
    expect(args.action).toBe('run');
    expect(args.query).toBe('Ship A or B-');
    expect(args.strategy).toBe('user_stack');
  });

  it('help text emphasizes natural chat usage', () => {
    const help = formatConsensusHelp();
    expect(help).toMatch(/no need to type "run"/i);
    expect(help).toMatch(/\/consensus Should we ship/);
  });

  it('invokes home/status without inventing models', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-csurf-'));
    fs.mkdirSync(path.join(root, 'data', 'runtime'), { recursive: true });
    try {
      const llmRuntime = {
        isProviderAvailable: () => true,
        async chat() {
          return { content: 'should not be called' };
        },
      } as unknown as LlmRuntimeService;

      const result = await invokeConsensusSurface({
        tokens: [],
        projectRoot: root,
        llmRuntime,
      });
      expect(result.json.action).toBe('status');
      expect(result.text).toMatch(/Consensus/i);
      expect(result.text).toMatch(/no "run" required|Just type/i);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
