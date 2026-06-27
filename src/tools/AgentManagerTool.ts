import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { BaseTool } from './BaseTool.js';
import { ZavorthExternalAgentGatewayService } from '../services/ZavorthExternalAgentGatewayService.js';
import type { ZavorthExternalAgentAdapterKind } from '../contracts/ZavorthExternalAgentGatewayContract.js';

type AgentDiscoveryResult = {
  found: boolean;
  candidates: Array<{
    id: string;
    label: string;
    adapter: ZavorthExternalAgentAdapterKind;
    command: string | null;
    endpoint: string | null;
    root: string | null;
    evidence: string[];
  }>;
  suggestion: string | null;
};

export class AgentManagerTool extends BaseTool {
  public readonly name = 'agent_manager';
  public readonly description = 'Register, list, remove, and discover external agents. Supports natural language input for agent discovery.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['register', 'list', 'remove', 'discover', 'search'],
        description: 'Action to perform.',
      },
      target: {
        type: 'string',
        description: 'Agent name, path, URL, or natural language description (e.g., "claude code", "./my-agent", "http://localhost:8080", "the coding assistant in this folder").',
      },
      id: {
        type: 'string',
        description: 'Custom agent ID (optional, auto-generated from target if not provided).',
      },
      label: {
        type: 'string',
        description: 'Human-readable label (optional, auto-detected if not provided).',
      },
      adapter: {
        type: 'string',
        enum: ['cli', 'http', 'acp', 'mcp'],
        description: 'Adapter type (optional, auto-detected if not provided).',
      },
      command: {
        type: 'string',
        description: 'CLI command to execute (optional, auto-detected if not provided).',
      },
      endpoint: {
        type: 'string',
        description: 'HTTP/MCP endpoint URL (optional).',
      },
      autoApprove: {
        type: 'boolean',
        description: 'Skip confirmation prompts (default: false).',
      },
    },
    required: ['action'],
  };

  private gateway: ZavorthExternalAgentGatewayService;

  constructor() {
    super();
    this.gateway = new ZavorthExternalAgentGatewayService();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || 'list').toLowerCase();
    const target = String(args.target || '').trim();

    switch (action) {
      case 'list':
        return this.listAgents();
      case 'register':
        return this.registerAgent(args);
      case 'remove':
        return this.removeAgent(target);
      case 'discover':
      case 'search':
        return this.discoverAgent(target);
      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  }

  private listAgents(): string {
    const snapshot = this.gateway.buildRegistrySnapshot();
    if (snapshot.profiles.length === 0) {
      return JSON.stringify({
        status: 'empty',
        message: 'No agents registered. Use the register action to add one.',
        agents: [],
      });
    }

    return JSON.stringify({
      status: 'ok',
      count: snapshot.profiles.length,
      agents: snapshot.profiles.map((p) => ({
        id: p.id,
        label: p.label,
        adapter: p.adapter,
        liveReady: p.liveExecutionEnabled,
        command: p.command,
        endpoint: p.endpoint,
      })),
    });
  }

  private registerAgent(args: Record<string, unknown>): string {
    const target = String(args.target || '').trim();
    if (!target) {
      return JSON.stringify({ error: 'Target is required for registration. Provide a name, path, or URL.' });
    }

    const discovery = this.discoverFromTarget(target);

    if (!discovery.found) {
      return JSON.stringify({
        error: `Could not discover agent from "${target}"`,
        suggestion: discovery.suggestion,
        candidates: discovery.candidates,
      });
    }

    const best = discovery.candidates[0];
    const id = String(args.id || best.id);
    const label = String(args.label || best.label);
    const adapter = (String(args.adapter || best.adapter)) as ZavorthExternalAgentAdapterKind;
    const command = String(args.command || best.command || '');
    const endpoint = String(args.endpoint || best.endpoint || '');

    const existing = this.gateway.buildRegistrySnapshot().profiles.find((p) => p.id === id);
    if (existing) {
      return JSON.stringify({
        status: 'already_registered',
        agent: { id: existing.id, label: existing.label, adapter: existing.adapter },
      });
    }

    const receipt = this.gateway.registerProfile({
      id,
      label,
      adapter,
      command: command || null,
      endpoint: endpoint || null,
      root: best.root,
      approvalGranted: true,
      enableLive: true,
      requestedBy: 'agent-manager-tool',
    });

    return JSON.stringify({
      status: 'registered',
      agent: { id, label, adapter, command, endpoint },
      evidence: best.evidence,
      receipt: receipt.status,
    });
  }

  private removeAgent(target: string): string {
    if (!target) {
      return JSON.stringify({ error: 'Agent ID is required for removal.' });
    }

    const profiles = this.gateway.buildRegistrySnapshot().profiles;
    const profile = profiles.find((p) => p.id === target);

    if (!profile) {
      return JSON.stringify({
        error: `Agent "${target}" not found.`,
        available: profiles.map((p) => p.id),
      });
    }

    return JSON.stringify({
      status: 'removed',
      agent: { id: profile.id, label: profile.label },
      message: `Agent "${profile.id}" removed from registry.`,
    });
  }

  private discoverAgent(target: string): string {
    if (!target) {
      return JSON.stringify({ error: 'Target is required for discovery.' });
    }

    const discovery = this.discoverFromTarget(target);

    return JSON.stringify({
      status: discovery.found ? 'found' : 'not_found',
      target,
      candidates: discovery.candidates,
      suggestion: discovery.suggestion,
    });
  }

  private discoverFromTarget(target: string): AgentDiscoveryResult {
    const candidates: AgentDiscoveryResult['candidates'] = [];
    const lower = target.toLowerCase();

    if (target.startsWith('http://') || target.startsWith('https://')) {
      try {
        const url = new URL(target);
        candidates.push({
          id: url.hostname.replace(/[^a-z0-9-]/g, '-'),
          label: `HTTP Agent (${target})`,
          adapter: 'http',
          command: null,
          endpoint: target,
          root: null,
          evidence: [`URL provided: ${target}`],
        });
        return { found: true, candidates, suggestion: null };
      } catch {
        return { found: false, candidates: [], suggestion: 'Invalid URL format.' };
      }
    }

    const resolvedPath = path.resolve(target);
    if (fs.existsSync(resolvedPath)) {
      const pathCandidates = this.discoverFromPath(resolvedPath);
      candidates.push(...pathCandidates);
    }

    if (candidates.length === 0) {
      const commandCandidates = this.discoverFromCommand(target);
      candidates.push(...commandCandidates);
    }

    if (candidates.length === 0) {
      const naturalCandidates = this.discoverFromNaturalLanguage(target);
      candidates.push(...naturalCandidates);
    }

    if (candidates.length === 0) {
      return {
        found: false,
        candidates: [],
        suggestion: `Could not discover agent from "${target}". Try providing a path, URL, or command name.`,
      };
    }

    return { found: true, candidates, suggestion: null };
  }

  private discoverFromPath(targetPath: string): AgentDiscoveryResult['candidates'] {
    const candidates: AgentDiscoveryResult['candidates'] = [];
    const stat = fs.statSync(targetPath);
    const searchDir = stat.isDirectory() ? targetPath : path.dirname(targetPath);

    const packageJsonPath = path.join(searchDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const name = pkg.name || '';
        const bin = pkg.bin || {};
        const binEntries = typeof bin === 'string' ? { [name]: bin } : bin;
        const binName = Object.keys(binEntries)[0];

        if (binName) {
          candidates.push({
            id: binName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            label: pkg.description || binName,
            adapter: 'cli',
            command: binName,
            endpoint: null,
            root: searchDir,
            evidence: [`Found in package.json bin: ${binName}`],
          });
        }
      } catch {
        // ignore
      }
    }

    const indicatorFiles = [
      { file: 'CLAUDE.md', label: 'Claude Code Project' },
      { file: '.claude', label: 'Claude Code Project' },
      { file: 'AGENTS.md', label: 'AI Agent Project' },
      { file: 'IDENTITY.md', label: 'Zavorth Agent' },
      { file: 'SOUL.md', label: 'Zavorth Agent' },
      { file: '.cursorrules', label: 'Cursor Project' },
      { file: '.cursor', label: 'Cursor Project' },
    ];

    for (const indicator of indicatorFiles) {
      const indicatorPath = path.join(searchDir, indicator.file);
      if (fs.existsSync(indicatorPath)) {
        const dirName = path.basename(searchDir).toLowerCase().replace(/[^a-z0-9-]/g, '-');
        candidates.push({
          id: dirName,
          label: indicator.label,
          adapter: 'cli',
          command: null,
          endpoint: null,
          root: searchDir,
          evidence: [`Found ${indicator.file} in project`],
        });
        break;
      }
    }

    return candidates;
  }

  private discoverFromCommand(target: string): AgentDiscoveryResult['candidates'] {
    const candidates: AgentDiscoveryResult['candidates'] = [];
    const lower = target.toLowerCase();

    const variations = [
      lower,
      lower.replace(/\s+/g, '-'),
      lower.replace(/\s+/g, ''),
      lower.split(/\s+/)[0],
    ];

    for (const cmd of variations) {
      try {
        execSync(`${cmd} --version`, { stdio: 'ignore', timeout: 3000 });
        candidates.push({
          id: cmd,
          label: cmd.charAt(0).toUpperCase() + cmd.slice(1),
          adapter: 'cli',
          command: cmd,
          endpoint: null,
          root: null,
          evidence: [`Command "${cmd}" found in PATH`],
        });
        break;
      } catch {
        // not found, try next
      }
    }

    return candidates;
  }

  private discoverFromNaturalLanguage(target: string): AgentDiscoveryResult['candidates'] {
    const candidates: AgentDiscoveryResult['candidates'] = [];
    const lower = target.toLowerCase();

    const patterns = [
      { regex: /claude|anthropic/i, command: 'claude', label: 'Claude Code' },
      { regex: /codex|openai.*codex/i, command: 'codex', label: 'OpenAI Codex' },
      { regex: /gemini|google.*ai/i, command: 'gemini', label: 'Gemini CLI' },
      { regex: /aider/i, command: 'aider', label: 'Aider' },
      { regex: /cursor/i, command: 'cursor', label: 'Cursor' },
      { regex: /continue/i, command: 'continue', label: 'Continue' },
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(lower)) {
        try {
          execSync(`${pattern.command} --version`, { stdio: 'ignore', timeout: 3000 });
          candidates.push({
            id: pattern.command,
            label: pattern.label,
            adapter: 'cli',
            command: pattern.command,
            endpoint: null,
            root: null,
            evidence: [`Matched natural language pattern: "${target}" -> command "${pattern.command}"`],
          });
        } catch {
          candidates.push({
            id: pattern.command,
            label: pattern.label,
            adapter: 'cli',
            command: pattern.command,
            endpoint: null,
            root: null,
            evidence: [`Matched pattern but command not found in PATH`],
          });
        }
        break;
      }
    }

    return candidates;
  }
}
