import type {
  RemoteMeshNotebookProjectFileRootConfig,
  RemoteMeshNotebookScopedMcpToolName,
} from '../contracts/RemoteMeshNotebookScopedMcpServerContract.js';
import type { RemoteMeshJson } from '../contracts/RemoteMeshSandboxContract.js';

export type RemoteMeshNotebookScopedMcpToolCatalogConfig = {
  enableDockerObservability: boolean;
  enableDockerControl: boolean;
  enableProjectFileRead: boolean;
  allowedDockerContainers: string[];
  allowedDockerControlActions: string[];
  allowedProjectFileRoots: RemoteMeshNotebookProjectFileRootConfig[];
  maxDockerLogLines: number;
};

export function exposedRemoteMeshNotebookTools(
  config: RemoteMeshNotebookScopedMcpToolCatalogConfig,
): RemoteMeshNotebookScopedMcpToolName[] {
  const tools: RemoteMeshNotebookScopedMcpToolName[] = ['notebook.get_status'];
  if (config.enableDockerObservability) {
    tools.push('notebook.docker.list_containers', 'notebook.docker.get_logs');
  }
  if (config.enableDockerControl) {
    tools.push('notebook.docker.preview_control', 'notebook.docker.apply_control');
  }
  if (config.enableProjectFileRead) {
    tools.push('notebook.project_files.preview_read', 'notebook.project_files.apply_read');
  }
  return tools;
}

export function buildRemoteMeshNotebookToolDefinitions(
  config: RemoteMeshNotebookScopedMcpToolCatalogConfig,
): RemoteMeshJson[] {
  const definitions: RemoteMeshJson[] = [{
    name: 'notebook.get_status',
    description: 'Return a read-only Zavorth notebook status snapshot.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  }];

  if (config.enableDockerObservability) {
    definitions.push(
      {
        name: 'notebook.docker.list_containers',
        description: 'Return read-only summaries for Docker containers allowed by Zavorth policy.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'notebook.docker.get_logs',
        description: 'Return tail logs for one allowlisted Docker container without accepting raw shell commands.',
        inputSchema: {
          type: 'object',
          required: ['container'],
          properties: {
            container: { type: 'string', enum: config.allowedDockerContainers },
            lines: { type: 'integer', minimum: 1, maximum: config.maxDockerLogLines },
          },
          additionalProperties: false,
        },
      },
    );
  }

  if (config.enableDockerControl) {
    definitions.push(
      {
        name: 'notebook.docker.preview_control',
        description: 'Preview an allowlisted Docker lifecycle action and create a short-lived approval request.',
        inputSchema: {
          type: 'object',
          required: ['container', 'action'],
          properties: {
            container: { type: 'string', enum: config.allowedDockerContainers },
            action: { type: 'string', enum: config.allowedDockerControlActions },
          },
          additionalProperties: false,
        },
      },
      {
        name: 'notebook.docker.apply_control',
        description: 'Apply a previously previewed Docker lifecycle action after conversational approval.',
        inputSchema: {
          type: 'object',
          required: ['approvalId', 'approvalPhrase'],
          properties: { approvalId: { type: 'string' }, approvalPhrase: { type: 'string' } },
          additionalProperties: false,
        },
      },
    );
  }

  if (config.enableProjectFileRead) {
    definitions.push(
      {
        name: 'notebook.project_files.preview_read',
        description: 'Preview a read from an allowlisted project root and create a short-lived approval request.',
        inputSchema: {
          type: 'object',
          required: ['project', 'relativePath'],
          properties: {
            project: { type: 'string', enum: config.allowedProjectFileRoots.map(({ name }) => name) },
            relativePath: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
      {
        name: 'notebook.project_files.apply_read',
        description: 'Read an approved project file using an exact approval phrase and return a receipt.',
        inputSchema: {
          type: 'object',
          required: ['approvalId', 'approvalPhrase'],
          properties: { approvalId: { type: 'string' }, approvalPhrase: { type: 'string' } },
          additionalProperties: false,
        },
      },
    );
  }

  return definitions;
}
