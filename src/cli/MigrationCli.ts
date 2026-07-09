import { MigrationUXService } from '../services/plugins/MigrationUXService.js';

export async function runMigrationUX(rawArgs: string[] = []): Promise<number> {
  const svc = new MigrationUXService();

  const positional = rawArgs.filter((a) => !a.startsWith('--'));
  const sourceArg = positional[0];
  const dryRun = rawArgs.includes('--dry-run') || rawArgs.includes('--preview') || !rawArgs.includes('--apply');
  const apply = rawArgs.includes('--apply');
  const consent = rawArgs.includes('--consent') || rawArgs.includes('--yes');
  const json = rawArgs.includes('--json');
  const fromIndex = rawArgs.indexOf('--from');
  const profileHint = fromIndex >= 0 && rawArgs[fromIndex + 1] ? rawArgs[fromIndex + 1] : null;

  let detection = null;

  if (sourceArg) {
    detection = svc.detectAgent(sourceArg);
  } else if (profileHint) {
    detection = svc.detectFromName(profileHint);
  } else if (rawArgs.includes('--auto')) {
    detection = svc.detectFromName('auto');
  }

  if (!detection) {
    const help = [
      '=== Zavorth Universal Workspace Import ===',
      '',
      'Import identity, memory, skills, plugins and config from any local',
      'agent/workspace home using structural fingerprints only.',
      '',
      'Usage:',
      '  zavorth migrate <path>                 # preview import from path',
      '  zavorth migrate <path> --apply --consent',
      '  zavorth migrate --auto                 # scan common home locations',
      '  zavorth migrate --from <profile-hint>  # structural hint (skills, memory, mixed, ...)',
      '  zavorth migrate <path> --json',
      '',
      'Structural profiles (not product brands):',
      '  identity-markdown-home',
      '  skill-centric-home',
      '  memory-centric-home',
      '  config-centric-home',
      '  plugin-centric-home',
      '  mixed-agent-home',
      '  opaque-or-empty',
      '',
      'Examples:',
      '  zavorth migrate ./my-agent-home --preview',
      '  zavorth migrate ./my-agent-home --apply --consent',
      '  zavorth migrate --auto --preview',
    ].join('\n');
    console.log(help);
    return 1;
  }

  const plan = svc.planMigration(detection);

  if (json && (dryRun || !apply)) {
    console.log(JSON.stringify(plan.snapshot, null, 2));
    return 0;
  }

  console.log(`Detected workspace: ${detection.name}`);
  console.log(`Path: ${detection.path}`);
  console.log(`Structural profile: ${detection.type}`);
  console.log(`Confidence: ${(detection.confidence * 100).toFixed(0)}%`);
  console.log(`Skills (dirs): ${detection.skills}`);
  console.log('');
  console.log(`Planned items: ${plan.items.length}`);
  console.log(`Estimated time: ${plan.estimatedTime}`);

  if (plan.warnings.length > 0) {
    console.log('');
    console.log('Warnings:');
    for (const warning of plan.warnings) console.log(`  ${warning}`);
  }

  if (!apply) {
    console.log('');
    console.log('=== Preview only (no changes) ===');
    for (const item of plan.items.slice(0, 30)) {
      console.log(`  [${item.type}] ${item.name}`);
    }
    if (plan.items.length > 30) {
      console.log(`  ... and ${plan.items.length - 30} more items`);
    }
    console.log('');
    console.log('Next: zavorth migrate <path> --apply --consent');
    return 0;
  }

  if (!consent) {
    console.log('');
    console.log('Apply requires --consent (or --yes). Refusing to mutate.');
    return 1;
  }

  console.log('');
  console.log('Importing...');
  const result = svc.executeMigration(plan, {
    dryRun: false,
    consent: true,
    onProgress: (item, index, total) => {
      process.stdout.write(`\r  ${index + 1}/${total}: ${item.name.slice(0, 40).padEnd(40, ' ')}`);
    },
  });
  console.log('');
  console.log('');
  if (json && result.snapshot) {
    console.log(JSON.stringify(result.snapshot, null, 2));
  } else {
    console.log(svc.generateReport(plan, result));
  }
  return result.failed > 0 ? 1 : 0;
}
