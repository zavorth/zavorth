#!/usr/bin/env node

import { ReleaseUxWizardService } from '../src/services/ReleaseUxWizardService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
  const changelogOnly = argv.includes('--changelog');
  const service = new ReleaseUxWizardService();
  const snapshot = await service.buildSnapshot();

  if (asJson) {
    console.log(JSON.stringify(changelogOnly ? snapshot.wizard.changelog : snapshot, null, 2));
  } else if (changelogOnly) {
    console.log('[release-ux] Changelog operacional');
    console.log(`source: ${snapshot.wizard.changelog.source}`);
    for (const entry of snapshot.wizard.changelog.entries) {
      console.log(`- ${entry}`);
    }
  } else {
    console.log(await service.renderReport(snapshot));
  }

  if (requirePass && !snapshot.summary.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
