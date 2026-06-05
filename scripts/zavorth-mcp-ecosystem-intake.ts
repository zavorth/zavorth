#!/usr/bin/env node
import { McpEcosystemIntakeService } from '../src/services/McpEcosystemIntakeService.js';

const args = process.argv.slice(2);
const sourcePath = readFlag('--source') || readPositional();

if (!sourcePath) {
  console.error('Usage: npm run zavorth:mcp-ecosystem-intake -- --source <path> [--json]');
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main(): Promise<void> {
  const service = new McpEcosystemIntakeService();
  const snapshot = await service.buildSnapshot({
    sourcePath: sourcePath as string,
    sourceLabel: readFlag('--label') || 'MCP ecosystem source',
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

function readPositional(): string | null {
  return args.find((arg) => !arg.startsWith('--')) || null;
}
