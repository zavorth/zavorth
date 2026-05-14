#!/usr/bin/env node

import { config } from '../src/config/index.js';
import { WorkspaceCommandService } from '../src/services/WorkspaceCommandService.js';
import { WorkspaceProfileService } from '../src/services/WorkspaceProfileService.js';

function getOptionValue(argv: string[], name: string): string | null {
  const prefix = `${name}=`;
  const matched = argv.find((entry) => entry.startsWith(prefix));
  if (matched) {
    return matched.slice(prefix.length);
  }

  const index = argv.findIndex((entry) => entry === name);
  if (index >= 0) {
    return argv[index + 1] || null;
  }

  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  const workspace = getOptionValue(argv, '--workspace') || config.defaultWorkspace;
  const commandName = getOptionValue(argv, '--name') || '';
  const argsText = getOptionValue(argv, '--args') || '';
  const listOnly = argv.includes('--list') || !commandName;

  const profileService = new WorkspaceProfileService();
  const commandService = new WorkspaceCommandService();
  const profile = await profileService.getProfile(workspace);

  if (!profile) {
    throw new Error(`Nao foi possivel resolver o workspace: ${workspace}`);
  }

  if (listOnly) {
    const commands = commandService.listCommands(profile);
    if (commands.length === 0) {
      console.log('[workspace-command] Nenhum comando reutilizavel encontrado.');
      return;
    }

    console.log(`[workspace-command] Workspace: ${workspace}`);
    for (const entry of commands) {
      console.log(`[workspace-command] /${entry.name}: ${entry.template}`);
    }
    return;
  }

  const resolved = commandService.resolveInvocation(profile, commandName, argsText);
  if (!resolved) {
    throw new Error(`Comando reutilizavel nao encontrado: ${commandName}`);
  }

  console.log(`[workspace-command] /${resolved.name}`);
  console.log(`[workspace-command] template: ${resolved.template}`);
  console.log(`[workspace-command] resolved: ${resolved.resolvedText}`);
}

main().catch((error: any) => {
  console.error(`[workspace-command] erro: ${error?.message || String(error)}`);
  process.exitCode = 1;
});
