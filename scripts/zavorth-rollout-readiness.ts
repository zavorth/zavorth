import { ZavorthRolloutReadinessControlPlaneService } from '../src/services/ZavorthRolloutReadinessControlPlaneService.js';

function readFlag(argv: string[], name: string): string | null {
  const normalizedName = name.replace(/^--/, '');
  const inline = argv.find((entry) => entry.startsWith(`--${normalizedName}=`));
  if (inline) {
    return inline.split('=').slice(1).join('=').trim() || null;
  }
  const index = argv.findIndex((entry) => entry === `--${normalizedName}`);
  if (index >= 0 && argv[index + 1]) {
    return String(argv[index + 1]).trim() || null;
  }
  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const profile = readFlag(argv, 'profile');
  const scope = readFlag(argv, 'scope');
  const refresh = argv.includes('--refresh');
  const includeSources = argv.includes('--include-sources') || argv.includes('--full');
  const requirePass = argv.includes('--require-pass');
  const service = new ZavorthRolloutReadinessControlPlaneService();
  const snapshot = await service.buildSnapshot({ profile, scope, refresh, includeSources });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    console.log('[rollout-readiness] read consolidada do rollout persistente');
    console.log(await service.renderReport({ profile, scope, refresh }));
  }

  if (requirePass && !snapshot.gate.canProceed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[rollout-readiness] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
