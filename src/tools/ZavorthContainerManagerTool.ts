import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export class ZavorthContainerManagerTool extends BaseTool {
  public readonly name = 'zavorth_container_manager';

  public readonly description =
    'Container management — Docker containers, images, volumes, networks, docker compose, build, exec, logs, stats, prune, and registry operations.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'ps', 'logs', 'exec', 'build', 'stop', 'start', 'restart', 'rm', 'inspect', 'stats', 'images', 'pull', 'push', 'network_ls', 'volume_ls', 'prune', 'compose_up', 'compose_down', 'compose_ps', 'compose_logs', 'tag', 'save', 'load'.",
      },
      container: {
        type: 'string',
        description: 'Container name or ID.',
      },
      image: {
        type: 'string',
        description: 'Image name (for build, pull, push, tag).',
      },
      command: {
        type: 'string',
        description: 'Command for exec action.',
      },
      dockerfile: {
        type: 'string',
        description: 'Path to Dockerfile (for build).',
      },
      context_path: {
        type: 'string',
        description: 'Build context path. Default: ".".',
      },
      tag: {
        type: 'string',
        description: 'Image tag (for build, pull, push).',
      },
      compose_file: {
        type: 'string',
        description: 'Path to docker-compose.yml.',
      },
      service: {
        type: 'string',
        description: 'Service name for compose operations.',
      },
      tail: {
        type: 'number',
        description: 'Number of log lines to show. Default: 100.',
      },
      follow: {
        type: 'boolean',
        description: 'Follow log output. Default: false.',
      },
      output_path: {
        type: 'string',
        description: 'Output file path for save/export.',
      },
      env_vars: {
        type: 'string',
        description: 'JSON of environment variables.',
      },
      ports: {
        type: 'string',
        description: "Port mappings (e.g., '8080:80,3000:3000').",
      },
      volumes: {
        type: 'string',
        description: "Volume mappings (e.g., '/host:/container').",
      },
      network: {
        type: 'string',
        description: 'Network name.',
      },
      force: {
        type: 'boolean',
        description: 'Force operation.',
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'ps': return await this.dockerCmd(['ps', '-a', '--format', 'table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}']);
      case 'logs': return await this.logs(args);
      case 'exec': return await this.exec(args);
      case 'build': return await this.build(args);
      case 'stop': return await this.stop(args);
      case 'start': return await this.dockerCmd(['start', String(args.container || '')], !!args.container);
      case 'restart': return await this.dockerCmd(['restart', String(args.container || '')], !!args.container);
      case 'rm': return await this.rm(args);
      case 'inspect': return await this.inspect(args);
      case 'stats': return await this.dockerCmd(['stats', '--no-stream', '--format', 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}']);
      case 'images': return await this.dockerCmd(['images', '--format', 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}']);
      case 'pull': return await this.pull(args);
      case 'push': return await this.push(args);
      case 'network_ls': return await this.dockerCmd(['network', 'ls']);
      case 'volume_ls': return await this.dockerCmd(['volume', 'ls']);
      case 'prune': return await this.prune(args);
      case 'compose_up': return await this.composeUp(args);
      case 'compose_down': return await this.composeDown(args);
      case 'compose_ps': return await this.composeCmd(['ps'], args);
      case 'compose_logs': return await this.composeLogs(args);
      case 'tag': return await this.tagImage(args);
      case 'save': return await this.saveImage(args);
      case 'load': return await this.loadImage(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async dockerCmd(cmdArgs: string[], required = false): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('docker', cmdArgs, {
        timeout: 120000,
        maxBuffer: 50 * 1024 * 1024,
      }).toString();
      return result.trim() || '(no output)';
    } catch (error: any) { logger.warn('[Zavorth Container Manager] process execution failed', error); return ''; }
  }

  private async logs(args: Record<string, unknown>): Promise<string> {
    const container = String(args.container || '');
    if (!container) return 'Error: "container" is required for logs.';

    const tail = Number(args.tail || 100);
    const cmdArgs = ['logs', '--tail', String(tail)];
    if (args.follow) cmdArgs.push('-f');
    cmdArgs.push(container);

    return await this.dockerCmd(cmdArgs);
  }

  private async exec(args: Record<string, unknown>): Promise<string> {
    const container = String(args.container || '');
    const command = String(args.command || '');
    if (!container || !command) return 'Error: "container" and "command" are required for exec.';

    return await this.dockerCmd(['exec', container, 'sh', '-c', command]);
  }

  private async build(args: Record<string, unknown>): Promise<string> {
    const image = String(args.image || '');
    if (!image) return 'Error: "image" is required for build.';

    const contextPath = String(args.context_path || '.');
    const dockerfile = String(args.dockerfile || '');
    const tagStr = String(args.tag || 'latest');

    const cmdArgs = ['build', '-t', `${image}:${tagStr}`];
    if (dockerfile) cmdArgs.push('-f', dockerfile);
    if (args.ports) {
      for (const mapping of String(args.ports).split(',')) {
        cmdArgs.push('-p', mapping.trim());
      }
    }
    cmdArgs.push(contextPath);

    return await this.dockerCmd(cmdArgs);
  }

  private async stop(args: Record<string, unknown>): Promise<string> {
    const container = String(args.container || '');
    if (!container) return 'Error: "container" is required for stop.';

    const cmdArgs = ['stop'];
    if (args.force) cmdArgs.push('-t', '0');
    cmdArgs.push(container);

    return await this.dockerCmd(cmdArgs);
  }

  private async rm(args: Record<string, unknown>): Promise<string> {
    const container = String(args.container || '');
    if (!container) return 'Error: "container" is required for rm.';

    const cmdArgs = ['rm'];
    if (args.force) cmdArgs.push('-f');
    cmdArgs.push(container);

    return await this.dockerCmd(cmdArgs);
  }

  private async inspect(args: Record<string, unknown>): Promise<string> {
    const container = String(args.container || '');
    if (!container) return 'Error: "container" is required for inspect.';

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('docker', ['inspect', '--format', '{{json .}}', container], {
        timeout: 15000,
        maxBuffer: 10 * 1024 * 1024,
      }).toString();
      const parsed = JSON.parse(result.trim());
      return `Container ${container}:\n  Status: ${parsed[0]?.State?.Status}\n  Image: ${parsed[0]?.Config?.Image}\n  Created: ${parsed[0]?.Created}\n  Ports: ${JSON.stringify(parsed[0]?.NetworkSettings?.Ports || {})}`;
    } catch (error: any) { logger.warn('[Zavorth Container Manager] JSON parse failed', error); return ''; }
  }

  private async pull(args: Record<string, unknown>): Promise<string> {
    const image = String(args.image || '');
    if (!image) return 'Error: "image" is required for pull.';

    const tag = String(args.tag || 'latest');
    return await this.dockerCmd(['pull', `${image}:${tag}`]);
  }

  private async push(args: Record<string, unknown>): Promise<string> {
    const image = String(args.image || '');
    if (!image) return 'Error: "image" is required for push.';

    const tag = String(args.tag || 'latest');
    return await this.dockerCmd(['push', `${image}:${tag}`]);
  }

  private async prune(args: Record<string, unknown>): Promise<string> {
    const type = String(args.network || 'all');
    const cmdArgs = type === 'images' ? ['image', 'prune', '-f'] :
                    type === 'volumes' ? ['volume', 'prune', '-f'] :
                    type === 'networks' ? ['network', 'prune', '-f'] :
                    ['system', 'prune', '-f'];
    return await this.dockerCmd(cmdArgs);
  }

  private async composeUp(args: Record<string, unknown>): Promise<string> {
    const composeFile = String(args.compose_file || '');
    const cmdArgs = ['compose'];
    if (composeFile) cmdArgs.push('-f', composeFile);
    cmdArgs.push('up', '-d');
    return await this.dockerCmd(cmdArgs);
  }

  private async composeDown(args: Record<string, unknown>): Promise<string> {
    const composeFile = String(args.compose_file || '');
    const cmdArgs = ['compose'];
    if (composeFile) cmdArgs.push('-f', composeFile);
    cmdArgs.push('down');
    return await this.dockerCmd(cmdArgs);
  }

  private async composeCmd(cmdArgs: string[], args: Record<string, unknown>): Promise<string> {
    const composeFile = String(args.compose_file || '');
    const fullArgs = ['compose'];
    if (composeFile) fullArgs.push('-f', composeFile);
    fullArgs.push(...cmdArgs);
    return await this.dockerCmd(fullArgs);
  }

  private async composeLogs(args: Record<string, unknown>): Promise<string> {
    const composeFile = String(args.compose_file || '');
    const service = String(args.service || '');
    const tail = Number(args.tail || 100);

    const cmdArgs = ['compose'];
    if (composeFile) cmdArgs.push('-f', composeFile);
    cmdArgs.push('logs', '--tail', String(tail));
    if (service) cmdArgs.push(service);

    return await this.dockerCmd(cmdArgs);
  }

  private async tagImage(args: Record<string, unknown>): Promise<string> {
    const image = String(args.image || '');
    const newTag = String(args.tag || '');
    if (!image || !newTag) return 'Error: "image" and "tag" are required.';

    return await this.dockerCmd(['tag', image, newTag]);
  }

  private async saveImage(args: Record<string, unknown>): Promise<string> {
    const image = String(args.image || '');
    const outputPath = String(args.output_path || '');
    if (!image || !outputPath) return 'Error: "image" and "output_path" are required.';

    return await this.dockerCmd(['save', '-o', outputPath, image]);
  }

  private async loadImage(args: Record<string, unknown>): Promise<string> {
    const inputPath = String(args.output_path || '');
    if (!inputPath) return 'Error: "output_path" (input file) is required.';

    return await this.dockerCmd(['load', '-i', inputPath]);
  }
}
