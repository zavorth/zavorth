import path from 'path';
import { CompanionDistributionService } from '../src/nodes/companion/CompanionDistributionService.js';
import { config } from '../src/config/index.js';

function parseOutputRoot(argv: string[]): string | undefined {
  const index = argv.findIndex((entry) => entry === '--output');
  if (index >= 0) {
    const value = String(argv[index + 1] || '').trim();
    return value ? path.resolve(value) : undefined;
  }
  return undefined;
}

async function main() {
  const outputRoot = parseOutputRoot(process.argv.slice(2));
  const bundle = new CompanionDistributionService({
    projectRoot: config.projectRoot,
  }).buildBundle(outputRoot);

  console.log('[companion-package] bundle pronto');
  console.log(`[companion-package] bundleDir: ${bundle.bundleDir}`);
  console.log(`[companion-package] files: ${bundle.files.length}`);
  console.log(`[companion-package] launcher: ${bundle.launcherPs1Path}`);
}

main().catch((error) => {
  console.error('[companion-package] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
