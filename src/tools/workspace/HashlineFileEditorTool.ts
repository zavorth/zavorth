import { BaseTool } from '../BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import {
  HashlineAnchorPatcherService,
  type HashlineChunkReplacement,
  type MultiFilePatchInput,
} from '../../services/editor/HashlineAnchorPatcherService.js';
import { ShadowCheckpointStoreService } from '../../services/snapshot/ShadowCheckpointStoreService.js';

export class HashlineFileEditorTool extends BaseTool {
  public readonly name = 'hashline_edit_file';
  public readonly description =
    'Performs surgical, fingerprint-anchored file modifications with automatic line drift compensation. ' +
    'Supports single-file edits, multi-file atomic edits, and Jupyter Notebook (.ipynb) cell editing.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['edit', 'multiedit', 'notebook_edit', 'annotate'],
        description: 'Action to perform: edit a single file, multiedit across multiple files, notebook_edit for .ipynb, or annotate to inspect line hashes.',
      },
      filePath: {
        type: 'string',
        description: 'Absolute path to target file (for edit, notebook_edit, annotate).',
      },
      startLine: {
        type: 'number',
        description: '1-indexed starting line number of the target block.',
      },
      endLine: {
        type: 'number',
        description: '1-indexed ending line number of the target block.',
      },
      targetContent: {
        type: 'string',
        description: 'The exact string to be replaced within the target file.',
      },
      replacementContent: {
        type: 'string',
        description: 'The drop-in replacement content for the target block.',
      },
      patches: {
        type: 'array',
        items: { type: 'object' },
        description: 'Array of multi-file patches for action=multiedit.',
      },
      cellIndex: {
        type: 'number',
        description: '0-indexed cell index for Jupyter Notebook cell editing (action=notebook_edit).',
      },
      cellType: {
        type: 'string',
        enum: ['code', 'markdown'],
        description: 'Cell type for Jupyter Notebook (optional).',
      },
      newSource: {
        type: 'string',
        description: 'New source code/markdown for the Jupyter cell.',
      },
    },
    required: ['action'],
  };

  private readonly patcher: HashlineAnchorPatcherService;
  private readonly checkpointStore: ShadowCheckpointStoreService;

  constructor(
    patcher = new HashlineAnchorPatcherService(),
    checkpointStore = new ShadowCheckpointStoreService()
  ) {
    super();
    this.patcher = patcher;
    this.checkpointStore = checkpointStore;
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || 'edit').trim().toLowerCase();

    switch (action) {
      case 'edit': {
        const filePath = String(args.filePath || '').trim();
        if (!filePath) {
          return JSON.stringify({ error: 'filePath is required for action=edit.' });
        }
        const targetContent = String(args.targetContent || '');
        const replacementContent = String(args.replacementContent || '');
        const startLine = typeof args.startLine === 'number' ? args.startLine : 1;
        const endLine = typeof args.endLine === 'number' ? args.endLine : startLine;

        // Auto snapshot before mutation
        this.checkpointStore.createCheckpoint([filePath], `Pre-edit on ${filePath}`);

        const replacement: HashlineChunkReplacement = {
          startLine,
          endLine,
          targetContent,
          replacementContent,
        };

        const result = this.patcher.applyPatchToFile(filePath, [replacement]);
        return JSON.stringify(result, null, 2);
      }

      case 'multiedit': {
        const rawPatches = Array.isArray(args.patches) ? (args.patches as Record<string, unknown>[]) : [];
        if (rawPatches.length === 0) {
          return JSON.stringify({ error: 'patches array is required for action=multiedit.' });
        }

        const patches: MultiFilePatchInput[] = rawPatches.map((p) => ({
          filePath: String(p.filePath || ''),
          replacements: Array.isArray(p.replacements)
            ? (p.replacements as HashlineChunkReplacement[])
            : [],
        }));

        const allFiles = patches.map((p) => p.filePath);
        this.checkpointStore.createCheckpoint(allFiles, `Pre-multiedit on ${allFiles.length} files`);

        const result = this.patcher.applyMultiFilePatches(patches);
        return JSON.stringify(result, null, 2);
      }

      case 'notebook_edit': {
        const filePath = String(args.filePath || '').trim();
        if (!filePath) {
          return JSON.stringify({ error: 'filePath is required for action=notebook_edit.' });
        }
        const cellIndex = typeof args.cellIndex === 'number' ? args.cellIndex : 0;
        const cellType = args.cellType === 'markdown' ? 'markdown' : 'code';
        const newSource = String(args.newSource || '');

        this.checkpointStore.createCheckpoint([filePath], `Pre-notebook-edit on ${filePath}`);

        const result = this.patcher.editJupyterNotebookCell({
          filePath,
          cellIndex,
          cellType,
          newSource,
        });

        return JSON.stringify(result, null, 2);
      }

      case 'annotate': {
        const filePath = String(args.filePath || '').trim();
        if (!filePath) {
          return JSON.stringify({ error: 'filePath is required for action=annotate.' });
        }
        const lines = this.patcher.generateAnnotatedLines(filePath);
        return JSON.stringify({ filePath, lines }, null, 2);
      }

      default:
        return JSON.stringify({
          error: `Unknown action: ${action}. Expected: edit, multiedit, notebook_edit, annotate.`,
        });
    }
  }
}
