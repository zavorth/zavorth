import * as fs from 'node:fs';
import * as crypto from 'node:crypto';

export interface AnnotatedLine {
  readonly lineNumber: number;
  readonly hash: string;
  readonly text: string;
  readonly raw: string;
}

export interface HashlineChunkReplacement {
  readonly startLine: number;
  readonly startHash?: string;
  readonly endLine: number;
  readonly endHash?: string;
  readonly targetContent: string;
  readonly replacementContent: string;
}

export interface HashlinePatchResult {
  readonly success: boolean;
  readonly filePath: string;
  readonly modified: boolean;
  readonly appliedReplacements: number;
  readonly originalChecksum: string;
  readonly newChecksum: string;
  readonly error?: string;
}

export interface MultiFilePatchInput {
  readonly filePath: string;
  readonly replacements: readonly HashlineChunkReplacement[];
}

export interface MultiFilePatchResult {
  readonly success: boolean;
  readonly results: readonly HashlinePatchResult[];
  readonly totalFilesModified: number;
  readonly errors: readonly string[];
}

export interface JupyterCellEditInput {
  readonly filePath: string;
  readonly cellIndex: number;
  readonly cellType?: 'code' | 'markdown';
  readonly newSource: string | readonly string[];
}

export class HashlineAnchorPatcherService {
  public static computeLineHash(text: string, lineNumber: number): string {
    const normalized = text.trim();
    return crypto
      .createHash('sha256')
      .update(`${lineNumber}:${normalized}`)
      .digest('hex')
      .slice(0, 6);
  }

  public generateAnnotatedLines(content: string): readonly AnnotatedLine[] {
    const lines = content.split(/\r?\n/);
    return lines.map((text, idx) => {
      const lineNumber = idx + 1;
      const hash = HashlineAnchorPatcherService.computeLineHash(text, lineNumber);
      return {
        lineNumber,
        hash,
        text,
        raw: `${lineNumber}:${hash}:${text}`,
      };
    });
  }

  public applyPatchToFile(
    filePath: string,
    replacements: readonly HashlineChunkReplacement[]
  ): HashlinePatchResult {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        filePath,
        modified: false,
        appliedReplacements: 0,
        originalChecksum: '',
        newChecksum: '',
        error: `File not found: ${filePath}`,
      };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const originalChecksum = this.computeSha256(content);

    const result = this.applyPatchToString(content, replacements);
    if (!result.success) {
      return {
        success: false,
        filePath,
        modified: false,
        appliedReplacements: 0,
        originalChecksum,
        newChecksum: originalChecksum,
        error: result.error,
      };
    }

    const newChecksum = this.computeSha256(result.patchedContent);
    const modified = originalChecksum !== newChecksum;

    if (modified) {
      fs.writeFileSync(filePath, result.patchedContent, 'utf8');
    }

    return {
      success: true,
      filePath,
      modified,
      appliedReplacements: result.appliedCount,
      originalChecksum,
      newChecksum,
    };
  }

  public applyPatchToString(
    content: string,
    replacements: readonly HashlineChunkReplacement[]
  ): { success: boolean; patchedContent: string; appliedCount: number; error?: string } {
    let currentContent = content;
    let appliedCount = 0;

    // Sort replacements descending by startLine to prevent line shift interference during multiple edits
    const sorted = [...replacements].sort((a, b) => b.startLine - a.startLine);

    for (const chunk of sorted) {
      const lines = currentContent.split(/\r?\n/);
      const shiftOffset = this.findShiftedOffset(lines, chunk);

      if (shiftOffset === null) {
        // Fallback to literal target replacement if unique
        const occurrences = currentContent.split(chunk.targetContent).length - 1;
        if (occurrences === 1) {
          currentContent = currentContent.replace(chunk.targetContent, chunk.replacementContent);
          appliedCount++;
          continue;
        }

        return {
          success: false,
          patchedContent: content,
          appliedCount,
          error: `Target content anchor mismatch at line ${chunk.startLine} (hash: ${chunk.startHash || 'none'}). Target content is either shifted beyond threshold or not unique.`,
        };
      }

      const effectiveStart = chunk.startLine + shiftOffset;
      const effectiveEnd = chunk.endLine + shiftOffset;

      const targetLinesCount = chunk.targetContent.split(/\r?\n/).length;
      const actualRangeLines = lines.slice(effectiveStart - 1, effectiveStart - 1 + targetLinesCount);
      const actualRangeText = actualRangeLines.join('\n');

      const targetNormalized = chunk.targetContent.replace(/\r\n/g, '\n');
      const actualNormalized = actualRangeText.replace(/\r\n/g, '\n');

      if (actualNormalized === targetNormalized) {
        const before = lines.slice(0, effectiveStart - 1);
        const after = lines.slice(effectiveStart - 1 + targetLinesCount);
        const replacementLines = chunk.replacementContent.split(/\r?\n/);

        currentContent = [...before, ...replacementLines, ...after].join('\n');
        appliedCount++;
      } else if (currentContent.includes(chunk.targetContent)) {
        currentContent = currentContent.replace(chunk.targetContent, chunk.replacementContent);
        appliedCount++;
      } else {
        return {
          success: false,
          patchedContent: content,
          appliedCount,
          error: `Target content at resolved line ${effectiveStart}-${effectiveEnd} does not match expected chunk text.`,
        };
      }
    }

    return {
      success: true,
      patchedContent: currentContent,
      appliedCount,
    };
  }

  public applyMultiFilePatches(patches: readonly MultiFilePatchInput[]): MultiFilePatchResult {
    const results: HashlinePatchResult[] = [];
    const errors: string[] = [];
    let totalFilesModified = 0;

    for (const patch of patches) {
      const res = this.applyPatchToFile(patch.filePath, patch.replacements);
      results.push(res);
      if (res.success && res.modified) {
        totalFilesModified++;
      }
      if (!res.success && res.error) {
        errors.push(`${patch.filePath}: ${res.error}`);
      }
    }

    return {
      success: errors.length === 0,
      results,
      totalFilesModified,
      errors,
    };
  }

  public editJupyterNotebookCell(input: JupyterCellEditInput): HashlinePatchResult {
    if (!fs.existsSync(input.filePath)) {
      return {
        success: false,
        filePath: input.filePath,
        modified: false,
        appliedReplacements: 0,
        originalChecksum: '',
        newChecksum: '',
        error: `Notebook not found: ${input.filePath}`,
      };
    }

    try {
      const raw = fs.readFileSync(input.filePath, 'utf8');
      const originalChecksum = this.computeSha256(raw);
      const notebook = JSON.parse(raw);

      if (!Array.isArray(notebook.cells)) {
        return {
          success: false,
          filePath: input.filePath,
          modified: false,
          appliedReplacements: 0,
          originalChecksum,
          newChecksum: originalChecksum,
          error: 'Invalid .ipynb notebook format: missing cells array.',
        };
      }

      if (input.cellIndex < 0 || input.cellIndex >= notebook.cells.length) {
        return {
          success: false,
          filePath: input.filePath,
          modified: false,
          appliedReplacements: 0,
          originalChecksum,
          newChecksum: originalChecksum,
          error: `Cell index ${input.cellIndex} out of bounds (total cells: ${notebook.cells.length}).`,
        };
      }

      const cell = notebook.cells[input.cellIndex];
      if (input.cellType) {
        cell.cell_type = input.cellType;
      }

      const sourceLines = Array.isArray(input.newSource)
        ? (input.newSource as readonly string[])
        : String(input.newSource || '').split('\n');

      const formattedSource = sourceLines.map((line: string, idx: number, arr: readonly string[]) =>
        (idx < arr.length - 1 && !line.endsWith('\n') ? `${line}\n` : line),
      );

      cell.source = formattedSource;

      const newContent = JSON.stringify(notebook, null, 1);
      const newChecksum = this.computeSha256(newContent);
      fs.writeFileSync(input.filePath, newContent, 'utf8');

      return {
        success: true,
        filePath: input.filePath,
        modified: originalChecksum !== newChecksum,
        appliedReplacements: 1,
        originalChecksum,
        newChecksum,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        filePath: input.filePath,
        modified: false,
        appliedReplacements: 0,
        originalChecksum: '',
        newChecksum: '',
        error: `Failed to parse/update Jupyter Notebook: ${message}`,
      };
    }
  }

  private findShiftedOffset(lines: readonly string[], chunk: HashlineChunkReplacement): number | null {
    const targetFirstLine = chunk.targetContent.split(/\r?\n/)[0].trim();
    const expectedLineIndex = chunk.startLine - 1;

    // Check exact position first (offset 0)
    if (lines[expectedLineIndex] !== undefined && lines[expectedLineIndex].trim() === targetFirstLine) {
      return 0;
    }

    // Search outward within a +/- 60 line radius
    const maxRadius = Math.min(60, lines.length);
    for (let r = 1; r <= maxRadius; r++) {
      // Check down (+r)
      const downIdx = expectedLineIndex + r;
      if (downIdx < lines.length && lines[downIdx].trim() === targetFirstLine) {
        return r;
      }
      // Check up (-r)
      const upIdx = expectedLineIndex - r;
      if (upIdx >= 0 && lines[upIdx].trim() === targetFirstLine) {
        return -r;
      }
    }

    return null;
  }

  private computeSha256(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }
}
