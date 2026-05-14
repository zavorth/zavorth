import { ZavorthProviderPreferencePersistenceService } from '../src/services/ZavorthProviderPreferencePersistenceService.js';

const args = process.argv.slice(2);
const action = String(args[0] || 'preview').trim().toLowerCase();
const json = args.includes('--json');

function readFlag(name: string): string | null {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3).trim() || null;
  const index = args.indexOf(`--${name}`);
  if (index >= 0) return args[index + 1] || null;
  return null;
}

async function main(): Promise<void> {
  const service = new ZavorthProviderPreferencePersistenceService();
  const providerId = readFlag('provider') || readFlag('target') || (action === 'rollback' ? null : args.find((arg, index) => index > 0 && !arg.startsWith('--')));
  const common = {
    providerId,
    target: providerId,
    modelId: readFlag('model'),
    intent: readFlag('intent') || readFlag('profile'),
    approvalId: readFlag('approval-id'),
    confirm: args.includes('--confirm') || args.includes('--yes'),
    dryRun: args.includes('--dry-run') || args.includes('--preview'),
    requireLiveEvidence: args.includes('--require-live') || args.includes('--live-proof'),
    live: args.includes('--live'),
  };
  const snapshot = action === 'apply' || action === 'save' || action === 'persist'
    ? await service.apply(common)
    : action === 'rollback'
      ? await service.rollback({
        receiptId: readFlag('receipt') || args[1],
        approvalId: readFlag('approval-id'),
        confirm: args.includes('--confirm') || args.includes('--yes'),
        dryRun: args.includes('--dry-run') || args.includes('--preview'),
      })
      : await service.preview(common);

  process.stdout.write(json ? `${JSON.stringify(snapshot, null, 2)}\n` : service.renderText(snapshot));
  if (snapshot.status === 'denied') {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  process.stderr.write(`[provider-preference] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
