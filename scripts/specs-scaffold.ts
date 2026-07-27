#!/usr/bin/env node

import { SpecDrivenDevelopmentService } from '../src/services/SpecDrivenDevelopmentService.js';

function readFlag(argv: string[], flag: string): string {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return '';
  }
  return String(argv[index + 1] || '').trim();
}

async function main() {
  const argv = process.argv.slice(2);
  const featureId = readFlag(argv, '--id');
  const title = readFlag(argv, '--title');

  if (!featureId || !title) {
    console.error('usage: npm run specs:scaffold -- --id <feature/id> --title <Titulo da feature>');
    process.exitCode = 1;
    return;
  }

  const service = new SpecDrivenDevelopmentService();
  const result = service.scaffoldFeature({ featureId, title });

  console.log(`Scaffold SDD created para ${result.featureId}`);
  console.log(`Directory: ${result.targetDir}`);
  if (result.filesCreated.length > 0) {
    console.log('Created files:');
    for (const file of result.filesCreated) {
      console.log(`- ${file}`);
    }
  }
  if (result.filesSkipped.length > 0) {
    console.log('Preserved files:');
    for (const file of result.filesSkipped) {
      console.log(`- ${file}`);
    }
  }
}

main().catch((error) => {
  console.error('[specs-scaffold] failure ao criar scaffold SDD.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
