import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthKnowledgeDistillerService } from '../../src/services/ZavorthKnowledgeDistillerService.js';
import { ExternalAiRelayService } from '../../src/services/ExternalAiRelayService.js';

jest.mock('../../src/services/ExternalAiRelayService.js');

describe('ZavorthKnowledgeDistillerService', () => {
  let tempDir = '';
  let mockLogPath = '';
  let mockKnowledgePath = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-distiller-test-'));
    mockLogPath = path.join(tempDir, 'transcript.jsonl');
    mockKnowledgePath = path.join(tempDir, 'KNOWLEDGE.md');

    // Create a mock log file
    fs.writeFileSync(
      mockLogPath,
      [
        JSON.stringify({ type: 'USER_INPUT', content: 'Configure eslint rules for ES modules.' }),
        JSON.stringify({ type: 'PLANNER_RESPONSE', content: 'Creating package.json type module.' }),
      ].join('\n') + '\n',
      'utf-8'
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('parses log file, queries LLM, and creates KNOWLEDGE.md', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      rawResponse: '- Use ESM imports in eslint\n- Set type modules in package.json',
    });
    (ExternalAiRelayService as jest.Mock).mockImplementation(() => ({
      execute: mockExecute,
    }));

    const service = new ZavorthKnowledgeDistillerService({ knowledgePath: mockKnowledgePath });
    const result = await service.distillAndSave(mockLogPath);

    expect(result).toBe(true);
    expect(mockExecute).toHaveBeenCalled();
    
    const knowledgeContent = fs.readFileSync(mockKnowledgePath, 'utf-8');
    expect(knowledgeContent).toContain('## Distilled Rules from Recent Runs');
    expect(knowledgeContent).toContain('- Use ESM imports in eslint');
    expect(knowledgeContent).toContain('- Set type modules in package.json');
  });

  it('returns false if log file does not exist', async () => {
    const service = new ZavorthKnowledgeDistillerService({ knowledgePath: mockKnowledgePath });
    const result = await service.distillAndSave(path.join(tempDir, 'nonexistent.jsonl'));
    expect(result).toBe(false);
  });
});
