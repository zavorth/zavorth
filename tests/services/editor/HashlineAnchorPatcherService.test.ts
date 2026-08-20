import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  HashlineAnchorPatcherService,
  type HashlineChunkReplacement,
} from '../../../src/services/editor/HashlineAnchorPatcherService.js';

describe('HashlineAnchorPatcherService', () => {
  let tempRoot: string;
  let patcher: HashlineAnchorPatcherService;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-hashline-test-'));
    patcher = new HashlineAnchorPatcherService();
  });

  afterEach(() => {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // Cleanup fail-safe
    }
  });

  it('computes deterministic line hashes and annotated lines', () => {
    const content = 'import express from "express";\nconst app = express();\n';
    const lines = patcher.generateAnnotatedLines(content);

    expect(lines).toHaveLength(3);
    expect(lines[0].lineNumber).toBe(1);
    expect(lines[0].hash).toHaveLength(6);
    expect(lines[0].raw).toBe(`1:${lines[0].hash}:import express from "express";`);
  });

  it('applies a surgical replacement when line numbers match exactly', () => {
    const original = 'line 1\nline 2: target\nline 3\n';
    const chunk: HashlineChunkReplacement = {
      startLine: 2,
      endLine: 2,
      targetContent: 'line 2: target',
      replacementContent: 'line 2: replaced successfully',
    };

    const result = patcher.applyPatchToString(original, [chunk]);
    expect(result.success).toBe(true);
    expect(result.appliedCount).toBe(1);
    expect(result.patchedContent).toBe('line 1\nline 2: replaced successfully\nline 3\n');
  });

  it('recovers from line number drift automatically via shifted offset search', () => {
    // 5 lines inserted at top causing a 5-line shift
    const shiftedContent = 'new 1\nnew 2\nnew 3\nnew 4\nnew 5\nline 1\nline 2: target\nline 3\n';
    
    // Chunk still specifies startLine: 2 (expected line 2, but actual is line 7)
    const chunk: HashlineChunkReplacement = {
      startLine: 2,
      endLine: 2,
      targetContent: 'line 2: target',
      replacementContent: 'line 2: healed replacement',
    };

    const result = patcher.applyPatchToString(shiftedContent, [chunk]);
    expect(result.success).toBe(true);
    expect(result.appliedCount).toBe(1);
    expect(result.patchedContent).toContain('line 2: healed replacement');
  });

  it('edits a Jupyter Notebook cell cleanly via JSON AST manipulation', () => {
    const notebookPath = path.join(tempRoot, 'analysis.ipynb');
    const initialNotebook = {
      cells: [
        {
          cell_type: 'markdown',
          metadata: {},
          source: ['# Heading 1\n'],
        },
        {
          cell_type: 'code',
          metadata: {},
          execution_count: 1,
          outputs: [],
          source: ['print("old code")\n'],
        },
      ],
      metadata: {},
      nbformat: 4,
      nbformat_minor: 2,
    };

    fs.writeFileSync(notebookPath, JSON.stringify(initialNotebook, null, 2), 'utf8');

    const result = patcher.editJupyterNotebookCell({
      filePath: notebookPath,
      cellIndex: 1,
      cellType: 'code',
      newSource: 'import pandas as pd\ndf = pd.DataFrame({"a": [1, 2, 3]})\nprint(df)',
    });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);

    const updated = JSON.parse(fs.readFileSync(notebookPath, 'utf8'));
    expect(updated.cells[1].source[0]).toContain('import pandas as pd');
  });
});
