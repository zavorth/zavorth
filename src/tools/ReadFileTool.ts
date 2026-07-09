import { BaseTool } from './BaseTool.js';
import fs from 'fs';
import { WorkspaceFsPolicy } from './workspace/WorkspaceFsPolicy.js';
import { logger } from '../logger.js';

/**
 * Allows the agent to read a local text file.
 */
export class ReadFileTool extends BaseTool {
  public readonly name = 'read_file';
  public readonly description = 'Reads the complete contents of a local text file on the host machine. Returns the content as a string.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      filePath: {
        type: 'string',
        description: 'Absolute or relative path of the file to read, for example "package.json" or "./src/index.ts".',
      },
    },
    required: ['filePath'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const rawFilePath = String(args.filePath || '').trim();
    if (!rawFilePath) {
      return 'Error: the "filePath" parameter is required.';
    }

    let filePath: string;
    try {
      filePath = new WorkspaceFsPolicy().resolveReadPath(rawFilePath).absolutePath;
    } catch (error: unknown) {logger.warn('[Read File] process execution failed', error); return 'Error: for security, files can only be read inside the current workspace.'; }

    try {
      if (!fs.existsSync(filePath)) {
        return `Error: file "${filePath}" does not exist.`;
      }

      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return `Error: path "${filePath}" does not point to a valid file.`;
      }

      if (stats.size > 2 * 1024 * 1024) {
        return 'Error: file is larger than 2MB and cannot be read fully in the current context window.';
      }

      console.log(`[ReadFile] Reading file: ${filePath}`);
      let content = fs.readFileSync(filePath, 'utf-8');

      if (content.length > 15000) {
        content = content.substring(0, 15000) + '\n\n...[Content truncated because it exceeded the 15,000 character limit]';
      }

      return content.trim();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[ReadFile] Error while reading:', message);
      return `Error while reading file: ${message}`;
    }
  }
}
