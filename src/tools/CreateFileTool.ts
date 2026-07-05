import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import { WorkspaceFsPolicy } from './workspace/WorkspaceFsPolicy.js';
import { logger } from '../logger.js';

/**
 * Creates files on the local filesystem inside safe directories.
 */
export class CreateFileTool extends BaseTool {
  readonly name = 'create_file';
  readonly description = 'Creates a file on the local filesystem with the specified content. Use it to generate documents, specs, code, or any text file.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      filepath: {
        type: 'string',
        description: 'Relative path of the file to create, for example output/my-document.md.',
      },
      content: {
        type: 'string',
        description: 'Content of the file to create.',
      },
    },
    required: ['filepath', 'content'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const filepath = args.filepath as string;
    const content = args.content as string;

    if (!filepath || content === undefined) {
      return JSON.stringify({ error: 'Parameters "filepath" and "content" are required.' });
    }

    const policy = new WorkspaceFsPolicy();
    let fullPath: string;
    let resolvedPolicy: ReturnType<WorkspaceFsPolicy['resolveWritePath']>;

    try {
      resolvedPolicy = policy.resolveWritePath(filepath);
      fullPath = resolvedPolicy.absolutePath;
    } catch (error) {
    logger.warn('[Create File] serialization failed', error);
    return JSON.stringify({ error: 'For security, files can only be created inside the output/ folder.' });
  }

    try {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, content, 'utf-8');

      return JSON.stringify({
        success: true,
        message: `File created successfully: ${filepath}`,
        path: fullPath,
        size: `${Buffer.byteLength(content, 'utf-8')} bytes`,
        policy: {
          access: resolvedPolicy.access,
          scope: resolvedPolicy.scope,
        },
      });
    } catch (error) {
    logger.warn('[Create File] filesystem operation failed', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ error: `Failed to create file: ${errorMessage}` });
  }
  }
}
