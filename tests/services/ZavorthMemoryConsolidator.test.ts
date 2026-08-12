import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { ToolHookPipelineService } from '../../src/services/ToolHookPipelineService.js';
import { LlmResponse } from '../../src/providers/ILlmProvider.js';
import { LlmRuntimeService } from '../../src/services/llm/LlmRuntimeService.js';
import { ZavorthMemoryConsolidator } from '../../src/services/ZavorthMemoryConsolidator.js';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execFileSync: jest.fn(),
}));

describe('ZavorthMemoryConsolidator', () => {
  let tempDirs: string[] = [];
  let mockLlmRuntime: jest.Mocked<LlmRuntimeService>;
  let mockExecFileSync: jest.MockedFunction<typeof execFileSync>;

  beforeEach(() => {
    mockExecFileSync = execFileSync as any;
    mockExecFileSync.mockReset();

    mockLlmRuntime = {
      chat: jest.fn(),
    } as any;
  });

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir && fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('does nothing if there is no .git folder', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-consolidator-test-'));
    tempDirs.push(root);

    const pipeline = new ToolHookPipelineService();
    const consolidator = new ZavorthMemoryConsolidator(pipeline, mockLlmRuntime);
    consolidator.register();

    await pipeline.run({
      event: 'runtime.after_execute',
      workspace: root,
    });

    expect(mockExecFileSync).not.toHaveBeenCalled();
    expect(mockLlmRuntime.chat).not.toHaveBeenCalled();
  });

  it('does nothing if git diff is empty', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-consolidator-test-'));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, '.git'));

    mockExecFileSync.mockReturnValue('');

    const pipeline = new ToolHookPipelineService();
    const consolidator = new ZavorthMemoryConsolidator(pipeline, mockLlmRuntime);
    consolidator.register();

    await pipeline.run({
      event: 'runtime.after_execute',
      workspace: root,
    });

    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['diff'], expect.objectContaining({ cwd: root }));
    expect(mockLlmRuntime.chat).not.toHaveBeenCalled();
  });

  it('queries LLM and appends guidelines to AGENTS.md if diff has changes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-consolidator-test-'));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, '.git'));

    const agentsMdPath = path.join(root, 'AGENTS.md');
    fs.writeFileSync(agentsMdPath, '# AGENTS.md\nExisting content\n', 'utf8');

    mockExecFileSync.mockReturnValue('diff --git a/test.ts b/test.ts\n+console.log("hello");');
    
    mockLlmRuntime.chat.mockResolvedValue({
      content: '- Always handle console logs in test.ts\n- Standardize print calls.',
      toolCalls: [],
      finishReason: 'stop',
    });

    const pipeline = new ToolHookPipelineService();
    const consolidator = new ZavorthMemoryConsolidator(pipeline, mockLlmRuntime);
    consolidator.register();

    await pipeline.run({
      event: 'runtime.after_execute',
      workspace: root,
    });

    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['diff'], expect.objectContaining({ cwd: root }));
    expect(mockLlmRuntime.chat).toHaveBeenCalled();

    const updatedContent = fs.readFileSync(agentsMdPath, 'utf8');
    expect(updatedContent).toContain('## Lessons from Past Runs');
    expect(updatedContent).toContain('- Always handle console logs in test.ts');
  });

  it('inserts guidelines under existing section if it already exists', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-consolidator-test-'));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, '.git'));

    const agentsMdPath = path.join(root, 'AGENTS.md');
    fs.writeFileSync(agentsMdPath, '# AGENTS.md\n## Lessons from Past Runs\n- Old lesson\n', 'utf8');

    mockExecFileSync.mockReturnValue('diff --git a/test.ts b/test.ts\n+console.log("hello");');
    
    mockLlmRuntime.chat.mockResolvedValue({
      content: '- New lesson',
      toolCalls: [],
      finishReason: 'stop',
    });

    const pipeline = new ToolHookPipelineService();
    const consolidator = new ZavorthMemoryConsolidator(pipeline, mockLlmRuntime);
    consolidator.register();

    await pipeline.run({
      event: 'gateway.after_dispatch',
      workspace: root,
    });

    const updatedContent = fs.readFileSync(agentsMdPath, 'utf8');
    expect(updatedContent).toContain('## Lessons from Past Runs');
    expect(updatedContent).toContain('- New lesson');
    expect(updatedContent).toContain('- Old lesson');
  });
});
