#!/usr/bin/env node
import { ZavorthDailyCapabilityFlowService } from '../src/services/ZavorthDailyCapabilityFlowService.js';

const args = process.argv.slice(2);

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main(): Promise<void> {
  const service = new ZavorthDailyCapabilityFlowService();
  const snapshot = await service.buildSnapshot({
    profileId: readFlag('--profile'),
    runtimeTarget: readFlag('--target'),
    mcpSourcePath: readFlag('--mcp-source'),
    basePrompt: readFlag('--base-prompt'),
  });

  if (args.includes('--json')) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.renderText(snapshot));
  }
}

function readFlag(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1).trim() || null;
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1]?.trim() || null : null;
}
