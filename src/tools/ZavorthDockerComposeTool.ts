import fs from 'fs';
import path from 'path';
import os from 'os';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export class ZavorthDockerComposeTool extends BaseTool {
  public readonly name = 'zavorth_docker_compose';

  public readonly description =
    'Docker Compose operations — manage multi-container applications. Up, down, build, logs, ps, exec, scale.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'up', 'down', 'build', 'logs', 'ps', 'exec', 'scale', 'pull', 'restart', 'stop', 'config'.",
      },
      compose_file: {
        type: 'string',
        description: 'Path to docker-compose.yml. Default: ./docker-compose.yml.',
      },
      service: {
        type: 'string',
        description: 'Service name to target.',
      },
      command: {
        type: 'string',
        description: 'Command to exec (for exec action).',
      },
      replicas: {
        type: 'number',
        description: 'Number of replicas (for scale action).',
      },
      detached: {
        type: 'boolean',
        description: 'Run in detached mode (for up). Default: true.',
      },
      build_args: {
        type: 'string',
        description: 'JSON of build arguments.',
      },
      env_file: {
        type: 'string',
        description: 'Path to .env file.',
      },
      project_name: {
        type: 'string',
        description: 'Docker Compose project name.',
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    const validActions = ['up', 'down', 'build', 'logs', 'ps', 'exec', 'scale', 'pull', 'restart', 'stop', 'config'];
    if (!validActions.includes(action)) {
      return `Error: action "${action}" is invalid. Use: ${validActions.join(', ')}.`;
    }

    const composeFile = String(args.compose_file || 'docker-compose.yml');
    const service = String(args.service || '');
    const projectName = String(args.project_name || '');

    try {
      const { execFileSync } = await import('child_process');
      const dockerArgs = ['compose'];

      if (composeFile && composeFile !== 'docker-compose.yml') {
        dockerArgs.push('-f', composeFile);
      }
      if (projectName) {
        dockerArgs.push('-p', projectName);
      }

      dockerArgs.push(action);

      if (action === 'up' && args.detached !== false) {
        dockerArgs.push('-d');
      }
      if (action === 'logs' && service) {
        dockerArgs.push('--tail', '50');
      }
      if (service && !['up', 'down', 'build', 'config'].includes(action)) {
        dockerArgs.push(service);
      }
      if (action === 'exec' && args.command) {
        dockerArgs.push('sh', '-c', String(args.command));
      }
      if (action === 'scale' && service && args.replicas) {
        dockerArgs.push(`${service}=${args.replicas}`);
      }

      const result = execFileSync('docker', dockerArgs, {
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      }).toString();

      return `Docker Compose ${action}:\n${result.slice(0, 3000)}`;
    } catch (error: unknown) {logger.warn('[Zavorth Docker Compose] process execution failed', error); return ''; }
  }
}
