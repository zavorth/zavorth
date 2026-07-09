import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { asErrorLike } from '../src/utils/errorLike';

const server = new Server(
  {
    name: 'zavorth-mcp-fixture-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

function getSandboxDir(): string {
  const tempDir = os.tmpdir();
  return path.join(tempDir, 'zavorth-mcp-fixture');
}

function resolvePathInSandbox(relativeOrAbsolutePath: string): string {
  const sandbox = path.resolve(getSandboxDir());
  if (!fs.existsSync(sandbox)) {
    fs.mkdirSync(sandbox, { recursive: true });
  }

  // Resolve input path relative to sandbox
  const resolved = path.resolve(sandbox, relativeOrAbsolutePath);

  // Path Traversal checks:
  // 1. Must start with the sandbox path prefix
  // 2. Cannot equal a parent path or escape the directory
  const relative = path.relative(sandbox, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path traversal detected or path outside sandbox');
  }

  // 3. Double-check path starts with sandbox
  if (!resolved.startsWith(sandbox + path.sep) && resolved !== sandbox) {
    throw new Error('Path traversal detected or path outside sandbox');
  }

  // Symlinks validation if path already exists
  if (fs.existsSync(resolved)) {
    const realPath = fs.realpathSync(resolved);
    if (!realPath.startsWith(sandbox + path.sep) && realPath !== sandbox) {
      throw new Error('Dangerous symlink outside sandbox detected');
    }
  }

  return resolved;
}

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const mode = process.env.MCP_FIXTURE_DRIFT;

  // fixture.echo tool definition
  let echoDesc = 'Echoes back the message';
  let echoSchema: any = {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'The message to echo' },
    },
    required: ['message'],
  };

  if (mode === 'schema') {
    echoSchema = {
      type: 'object',
      properties: {
        msg: { type: 'string', description: 'The message to echo' },
      },
      required: ['msg'],
    };
  } else if (mode === 'description') {
    echoDesc = 'Drifted description of echoes back the message';
  }

  return {
    tools: [
      {
        name: 'fixture.echo',
        description: echoDesc,
        inputSchema: echoSchema,
      },
      {
        name: 'fixture.add',
        description: 'Adds two numbers',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' },
          },
          required: ['a', 'b'],
        },
      },
      {
        name: 'fixture.read_temp_file',
        description: 'Reads a file from the temp sandbox',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'The relative file path inside sandbox' },
          },
          required: ['path'],
        },
      },
      {
        name: 'fixture.write_temp_file',
        description: 'Writes a file to the temp sandbox',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'The relative file path inside sandbox' },
            content: { type: 'string', description: 'The file content to write' },
          },
          required: ['path', 'content'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'fixture.echo') {
      const mode = process.env.MCP_FIXTURE_DRIFT;
      if (mode === 'schema') {
        const msg = args?.msg;
        if (typeof msg !== 'string') {
          throw new Error('Missing msg parameter');
        }
        return { content: [{ type: 'text', text: msg }] };
      } else {
        const message = args?.message;
        if (typeof message !== 'string') {
          throw new Error('Missing message parameter');
        }
        return { content: [{ type: 'text', text: message }] };
      }
    }

    if (name === 'fixture.add') {
      const { a, b } = args as { a: number; b: number };
      if (typeof a !== 'number' || typeof b !== 'number') {
        throw new Error('Parameters a and b must be numbers');
      }
      return { content: [{ type: 'text', text: String(a + b) }] };
    }

    if (name === 'fixture.read_temp_file') {
      const filePathParam = args?.path;
      if (typeof filePathParam !== 'string') {
        throw new Error('Missing path parameter');
      }
      const resolved = resolvePathInSandbox(filePathParam);
      if (!fs.existsSync(resolved)) {
        throw new Error(`File not found: ${filePathParam}`);
      }
      const content = fs.readFileSync(resolved, 'utf8');
      return { content: [{ type: 'text', text: content }] };
    }

    if (name === 'fixture.write_temp_file') {
      const filePathParam = args?.path;
      const fileContent = args?.content;
      if (typeof filePathParam !== 'string' || typeof fileContent !== 'string') {
        throw new Error('Missing path or content parameter');
      }
      const resolved = resolvePathInSandbox(filePathParam);
      fs.writeFileSync(resolved, fileContent, 'utf8');
      return { content: [{ type: 'text', text: 'OK' }] };
    }

    throw new Error(`Tool not found: ${name}`);
  } catch (error: unknown) {
    const err = asErrorLike(error);

    return {
      content: [{ type: 'text', text: error.message }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Logs must strictly go to stderr to prevent corrupting stdio transport
  console.error('MCP Fixture Server running on stdio');
}

main().catch((err) => {
  console.error('Failed to start MCP Fixture Server:', err);
  process.exit(1);
});
