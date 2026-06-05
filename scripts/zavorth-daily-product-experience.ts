#!/usr/bin/env node
import { ZavorthDailyProductExperienceService } from '../src/services/ZavorthDailyProductExperienceService.js';

const args = process.argv.slice(2);

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthDailyProductExperienceService();
  const snapshot = await service.buildSnapshot({
    profile: readFlag('--profile'),
    intent: readFlag('--intent'),
    runtimeTarget: readFlag('--target'),
    mcpSourcePath: readFlag('--mcp-source'),
    basePrompt: readFlag('--base-prompt'),
  });

  if (args.includes('--json')) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  console.log(service.renderText(snapshot));
}

function readFlag(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) return undefined;
  return value;
}
