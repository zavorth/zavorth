#!/usr/bin/env node

import { config } from '../src/config/index.js';
import { WorkspaceHookService } from '../src/services/WorkspaceHookService.js';
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
  const listOnly = argv.includes('--list');
  const dryRun = argv.includes('--dry-run');
  const workspace = getOptionValue(argv, '--workspace') || config.defaultWorkspace;
  const event = getOptionValue(argv, '--event') || '';

  const profileService = new WorkspaceProfileService();
  const hookService = new WorkspaceHookService();
  const profile = await profileService.getProfile(workspace);

  if (!profile) {
    throw new Error(`Could not resolve workspace: ${workspace}`);
  }

  const hooks = event
    ? hookService.getHooksForEvent(profile, event)
    : hookService.listHooks(profile);

  if (listOnly || !event) {
    if (hooks.length === 0) {
      console.log('[workspace-hook] No hook encontrado.');
      return;
    }

    console.log(`[workspace-hook] Workspace: ${workspace}`);
    for (const hook of hooks) {
      console.log(`[workspace-hook] ${hook.event}: ${hook.command}`);
    }
    return;
  }

  const report = await hookService.runHooksForEvent({
    workspace,
    source: profile,
    event,
    dryRun,
  });

  if (report.hooks.length === 0) {
    console.log(`[workspace-hook] No hook para o evento ${report.event}.`);
    return;
  }

  console.log(`[workspace-hook] Evento: ${report.event}`);
  console.log(`[workspace-hook] Workspace: ${report.workspace}`);
  for (const result of report.results) {
    console.log(
      `[workspace-hook] ${result.status} | ${result.command}${result.error ? ` | ${result.error}` : ''}`,
    );
  }

  if (!report.ok) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(`[workspace-hook] error: ${error?.message || String(error)}`);
  process.exitCode = 1;
});
