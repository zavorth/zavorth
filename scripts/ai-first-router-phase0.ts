import { AiFirstRouterMigrationInventoryService } from '../src/services/AiFirstRouterMigrationInventoryService.js';

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

async function main(): Promise<void> {
  const service = new AiFirstRouterMigrationInventoryService();
  const snapshot = service.buildSnapshot();

  if (hasFlag('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${service.renderMarkdown(snapshot)}\n`);
}

main().catch((error) => {
  console.error('[ai-first-router-phase0] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
