#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ZavorthExternalAgentGatewayService } from '../src/services/ZavorthExternalAgentGatewayService.js';
import type { ZavorthExternalAgentAdapterKind } from '../src/contracts/ZavorthExternalAgentGatewayContract.js';

type DiscoveredAgent = {
  id: string;
  label: string;
  adapter: ZavorthExternalAgentAdapterKind;
  command: string | null;
  endpoint: string | null;
  root: string | null;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
};

const KNOWN_AGENTS: Record<string, { command: string; adapter: ZavorthExternalAgentAdapterKind; label: string }> = {
  claude: { command: 'claude', adapter: 'cli', label: 'Claude Code' },
  codex: { command: 'codex', adapter: 'cli', label: 'OpenAI Codex' },
  gemini: { command: 'gemini', adapter: 'cli', label: 'Gemini CLI' },
  aider: { command: 'aider', adapter: 'cli', label: 'Aider' },
  continue: { command: 'continue', adapter: 'cli', label: 'Continue' },
  cursor: { command: 'cursor', adapter: 'cli', label: 'Cursor' },
};

function discoverFromPath(targetPath: string): DiscoveredAgent[] {
  const candidates: DiscoveredAgent[] = [];
  const resolvedPath = path.resolve(targetPath);

  if (!fs.existsSync(resolvedPath)) {
    return candidates;
  }

  const stat = fs.statSync(resolvedPath);
  const searchDir = stat.isDirectory() ? resolvedPath : path.dirname(resolvedPath);

  const packageJsonPath = path.join(searchDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const name = pkg.name || '';
      const bin = pkg.bin || {};
      const binName = typeof bin === 'string' ? name : Object.keys(bin)[0];

      if (binName) {
        const knownMatch = KNOWN_AGENTS[binName.toLowerCase()];
        if (knownMatch) {
          candidates.push({
            id: binName.toLowerCase(),
            label: knownMatch.label,
            adapter: knownMatch.adapter,
            command: knownMatch.command,
            endpoint: null,
            root: searchDir,
            confidence: 'high',
            evidence: [`Found in package.json bin: ${binName}`],
          });
        } else {
          candidates.push({
            id: binName.toLowerCase(),
            label: pkg.description || binName,
            adapter: 'cli',
            command: binName,
            endpoint: null,
            root: searchDir,
            confidence: 'medium',
            evidence: [`Found in package.json bin: ${binName}`],
          });
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  const agentIndicators = [
    { file: 'CLAUDE.md', agent: 'claude', label: 'Claude Code' },
    { file: '.claude', agent: 'claude', label: 'Claude Code' },
    { file: 'AGENTS.md', agent: 'generic', label: 'AI Agent' },
    { file: 'IDENTITY.md', agent: 'zavorth', label: 'Zavorth' },
    { file: 'SOUL.md', agent: 'zavorth', label: 'Zavorth' },
    { file: '.cursorrules', agent: 'cursor', label: 'Cursor' },
    { file: '.cursor', agent: 'cursor', label: 'Cursor' },
  ];

  for (const indicator of agentIndicators) {
    const indicatorPath = path.join(searchDir, indicator.file);
    if (fs.existsSync(indicatorPath)) {
      const existing = candidates.find((c) => c.id === indicator.agent);
      if (existing) {
        existing.evidence.push(`Found ${indicator.file}`);
        existing.confidence = 'high';
      } else if (indicator.agent !== 'generic') {
        const knownMatch = KNOWN_AGENTS[indicator.agent];
        candidates.push({
          id: indicator.agent,
          label: knownMatch?.label || indicator.label,
          adapter: knownMatch?.adapter || 'cli',
          command: knownMatch?.command || null,
          endpoint: null,
          root: searchDir,
          confidence: 'medium',
          evidence: [`Found ${indicator.file}`],
        });
      }
    }
  }

  return candidates;
}

function discoverFromCommand(command: string): DiscoveredAgent | null {
  const knownMatch = KNOWN_AGENTS[command.toLowerCase()];
  if (knownMatch) {
    try {
      execSync(`${knownMatch.command} --version`, { stdio: 'ignore', timeout: 5000 });
      return {
        id: command.toLowerCase(),
        label: knownMatch.label,
        adapter: knownMatch.adapter,
        command: knownMatch.command,
        endpoint: null,
        root: null,
        confidence: 'high',
        evidence: [`Command "${knownMatch.command}" found in PATH`],
      };
    } catch {
      return {
        id: command.toLowerCase(),
        label: knownMatch.label,
        adapter: knownMatch.adapter,
        command: knownMatch.command,
        endpoint: null,
        root: null,
        confidence: 'low',
        evidence: [`Command "${knownMatch.command}" not found in PATH, but registered as known agent`],
      };
    }
  }

  try {
    execSync(`${command} --version`, { stdio: 'ignore', timeout: 5000 });
    return {
      id: command.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      label: command,
      adapter: 'cli',
      command: command,
      endpoint: null,
      root: null,
      confidence: 'medium',
      evidence: [`Command "${command}" found in PATH`],
    };
  } catch {
    return null;
  }
}

function discoverFromName(name: string): DiscoveredAgent[] {
  const candidates: DiscoveredAgent[] = [];
  const lower = name.toLowerCase();

  const knownMatch = KNOWN_AGENTS[lower];
  if (knownMatch) {
    try {
      execSync(`${knownMatch.command} --version`, { stdio: 'ignore', timeout: 5000 });
      candidates.push({
        id: lower,
        label: knownMatch.label,
        adapter: knownMatch.adapter,
        command: knownMatch.command,
        endpoint: null,
        root: null,
        confidence: 'high',
        evidence: [`Known agent "${knownMatch.command}" found in PATH`],
      });
    } catch {
      candidates.push({
        id: lower,
        label: knownMatch.label,
        adapter: knownMatch.adapter,
        command: knownMatch.command,
        endpoint: null,
        root: null,
        confidence: 'low',
        evidence: [`Known agent "${knownMatch.command}" not found in PATH`],
      });
    }
  }

  return candidates;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    process.stdout.write([
      'Agent Add - Simplified agent registration',
      '',
      'Usage:',
      '  zavorth agent add <name-or-path>',
      '  zavorth agent add claude',
      '  zavorth agent add ./my-agent-project',
      '  zavorth agent add http://localhost:8080',
      '  zavorth agent add --interactive',
      '',
      'Examples:',
      '  zavorth agent add claude              # Registers Claude Code CLI',
      '  zavorth agent add codex               # Registers OpenAI Codex CLI',
      '  zavorth agent add ./my-agent          # Discovers agent from project folder',
      '  zavorth agent add http://localhost:8080  # Registers HTTP endpoint',
      '',
      'Options:',
      '  --yes, -y          Auto-confirm without interactive prompts',
      '  --json             Output as JSON',
      '  --help, -h         Show this help',
      '',
    ].join('\n'));
    return;
  }

  const autoConfirm = args.includes('--yes') || args.includes('-y');
  const jsonOutput = args.includes('--json');
  const target = args.find((a) => !a.startsWith('--')) || '';

  const service = new ZavorthExternalAgentGatewayService();
  const existingProfiles = service.buildRegistrySnapshot().profiles;
  const existingIds = new Set(existingProfiles.map((p) => p.id));

  if (target.startsWith('http://') || target.startsWith('https://')) {
    const id = new URL(target).hostname.replace(/[^a-z0-9-]/g, '-');
    if (existingIds.has(id)) {
      process.stdout.write(`Agent "${id}" is already registered.\n`);
      return;
    }

    const receipt = service.registerProfile({
      id,
      label: `HTTP Agent (${target})`,
      adapter: 'http',
      endpoint: target,
      approvalGranted: true,
      enableLive: true,
      requestedBy: 'agent-add',
    });

    if (jsonOutput) {
      process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    } else {
      process.stdout.write(`Registered HTTP agent "${id}" at ${target}\n`);
      process.stdout.write(`Run: zavorth agent run ${id} --prompt "your task"\n`);
    }
    return;
  }

  const discovered: DiscoveredAgent[] = [];

  if (fs.existsSync(path.resolve(target))) {
    discovered.push(...discoverFromPath(target));
  }

  if (discovered.length === 0) {
    discovered.push(...discoverFromName(target));
  }

  if (discovered.length === 0) {
    const fromCommand = discoverFromCommand(target);
    if (fromCommand) {
      discovered.push(fromCommand);
    }
  }

  if (discovered.length === 0) {
    process.stdout.write(`Could not discover agent "${target}".\n`);
    process.stdout.write(`Try one of these:\n`);
    process.stdout.write(`  zavorth agent add claude\n`);
    process.stdout.write(`  zavorth agent add codex\n`);
    process.stdout.write(`  zavorth agent add ./path/to/agent\n`);
    process.stdout.write(`  zavorth agent add http://localhost:8080\n`);
    process.exitCode = 1;
    return;
  }

  const best = discovered[0];

  if (existingIds.has(best.id)) {
    process.stdout.write(`Agent "${best.id}" is already registered.\n`);
    return;
  }

  if (!autoConfirm) {
    process.stdout.write(`\nDiscovered agent:\n`);
    process.stdout.write(`  ID: ${best.id}\n`);
    process.stdout.write(`  Label: ${best.label}\n`);
    process.stdout.write(`  Adapter: ${best.adapter}\n`);
    process.stdout.write(`  Command: ${best.command || 'N/A'}\n`);
    process.stdout.write(`  Endpoint: ${best.endpoint || 'N/A'}\n`);
    process.stdout.write(`  Confidence: ${best.confidence}\n`);
    process.stdout.write(`  Evidence: ${best.evidence.join(', ')}\n`);
    process.stdout.write(`\nRegister this agent? [Y/n] `);

    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) => {
      rl.question('', resolve);
    });
    rl.close();

    if (answer.toLowerCase() === 'n' || answer.toLowerCase() === 'no') {
      process.stdout.write('Cancelled.\n');
      return;
    }
  }

  const receipt = service.registerProfile({
    id: best.id,
    label: best.label,
    adapter: best.adapter,
    command: best.command,
    endpoint: best.endpoint,
    root: best.root,
    approvalGranted: true,
    enableLive: true,
    requestedBy: 'agent-add',
  });

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } else {
    process.stdout.write(`\nRegistered agent "${best.id}" (${best.label})\n`);
    process.stdout.write(`Adapter: ${best.adapter}\n`);
    if (best.command) process.stdout.write(`Command: ${best.command}\n`);
    if (best.endpoint) process.stdout.write(`Endpoint: ${best.endpoint}\n`);
    process.stdout.write(`\nUsage:\n`);
    process.stdout.write(`  zavorth agent run ${best.id} --prompt "your task"\n`);
    process.stdout.write(`  zavorth agent chain --steps '[{"id":"s1","kind":"agent","agent":"${best.id}","prompt":"do something"}]'\n`);
  }
}

main().catch((error) => {
  console.error(`[agent-add] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
