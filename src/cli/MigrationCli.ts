import { MigrationUXService } from '../services/plugins/MigrationUXService.js';

export async function runMigrationUX(rawArgs: string[] = []): Promise<number> {
  const svc = new MigrationUXService();
  
  // Parse arguments
  const sourceArg = rawArgs.find((a) => !a.startsWith('--'));
  const dryRun = rawArgs.includes('--dry-run');
  const fromName = rawArgs.includes('--from');
  const fromIndex = rawArgs.indexOf('--from');
  const agentName = fromIndex >= 0 && rawArgs[fromIndex + 1] ? rawArgs[fromIndex + 1] : null;
  
  // Detect agent
  let detection = null;
  
  if (sourceArg) {
    // Direct path provided
    detection = svc.detectAgent(sourceArg);
  } else if (agentName) {
    // Name provided via --from
    detection = svc.detectFromName(agentName);
  }
  
  if (!detection) {
    console.log('=== Zavorth Migration ===');
    console.log('');
    console.log('Usage:');
    console.log('  zavorth migrate <path>           # Migrate from agent at path');
    console.log('  zavorth migrate --from <name>    # Auto-detect agent by name');
    console.log('  zavorth migrate --dry-run        # Preview without applying');
    console.log('');
    console.log('Supported agents:');
    console.log('  - legacy-python      (Python-style agent workspace)');
    console.log('  - legacy-typescript  (TypeScript-style agent workspace)');
    console.log('  - zavorth    (Zavorth)');
    console.log('  - claude     (Claude)');
    console.log('  - cursor     (Cursor)');
    console.log('  - generic    (Any agent)');
    console.log('');
    console.log('Examples:');
    console.log('  zavorth migrate /path/to/agent');
    console.log('  zavorth migrate --from legacy-typescript');
    console.log('  zavorth migrate /path/to/agent --dry-run');
    return 1;
  }
  
  console.log(`Detected: ${detection.name} (${detection.type})`);
  console.log(`Confidence: ${(detection.confidence * 100).toFixed(0)}%`);
  console.log(`Skills: ${detection.skills}`);
  console.log(`Providers: ${detection.providers}`);
  console.log('');
  
  // Plan migration
  const plan = svc.planMigration(detection);
  
  console.log(`Found ${plan.items.length} items to migrate`);
  console.log(`Estimated time: ${plan.estimatedTime}`);
  
  if (plan.warnings.length > 0) {
    console.log('');
    console.log('Warnings:');
    for (const warning of plan.warnings) {
      console.log(`  ${warning}`);
    }
  }
  
  if (dryRun) {
    console.log('');
    console.log('=== Dry Run (no changes) ===');
    for (const item of plan.items.slice(0, 20)) {
      console.log(`  [${item.type}] ${item.name}`);
    }
    if (plan.items.length > 20) {
      console.log(`  ... and ${plan.items.length - 20} more items`);
    }
    return 0;
  }
  
  // Execute migration
  console.log('');
  console.log('Migrating...');
  
  const result = svc.executeMigration(plan, {
    dryRun: false,
    onProgress: (item, index, total) => {
      process.stdout.write(`\r  ${index + 1}/${total}: ${item.name.slice(0, 40)}`);
    },
  });
  
  console.log('');
  console.log('');
  console.log(svc.generateReport(plan, result));
  
  return result.failed > 0 ? 1 : 0;
}
