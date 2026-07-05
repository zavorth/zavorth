import { BaseTool } from './BaseTool.js';
import fs from 'fs';
import { WorkspaceFsPolicy } from './workspace/WorkspaceFsPolicy.js';
import { logger } from '../logger.js';

/**
 * Allows the agent to list files and folders in a local directory.
 */
export class ListDirectoryTool extends BaseTool {
  public readonly name = 'list_directory';
  public readonly description = 'Lists files and subdirectories for a specific local path on the host machine. Returns the current directory contents when the path is empty.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      dirPath: {
        type: 'string',
        description: 'Absolute or relative directory path to list, for example "./src" or "C:\\Test". Leave empty to list the current directory.',
      },
    },
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const rawDirPath = typeof args?.dirPath === 'string' && args.dirPath.trim()
      ? args.dirPath
      : undefined;
    let dirPath: string;
    try {
      dirPath = new WorkspaceFsPolicy().resolveListPath(rawDirPath).absolutePath;
    } catch (error) { logger.warn('[List Directory] process execution failed', error); return 'Error: for security, directories can only be listed inside the current workspace.'; }

    try {
      if (!fs.existsSync(dirPath)) {
        return `Error: directory "${dirPath}" does not exist.`;
      }

      const stats = fs.statSync(dirPath);
      if (!stats.isDirectory()) {
        return `Error: path "${dirPath}" is not a directory.`;
      }

      console.log(`[ListDirectory] Listing: ${dirPath}`);
      const items = fs.readdirSync(dirPath, { withFileTypes: true });

      let output = `Directory contents: ${dirPath}\n\n`;
      const folders: string[] = [];
      const files: string[] = [];

      for (const item of items) {
        if (item.isDirectory()) folders.push(`[DIR]  ${item.name}`);
        else files.push(`[FILE] ${item.name}`);
      }

      output += folders.join('\n') + (folders.length > 0 ? '\n' : '');
      output += files.join('\n');

      if (items.length === 0) {
        output += '(Empty directory)';
      }

      return output.trim();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[ListDirectory] Error while listing:', message);
      return `Error while reading directory: ${message}`;
    }
  }
}
