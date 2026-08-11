import { ZavorthAgentKernelSnapshotService } from '../src/services/ZavorthAgentKernelSnapshotService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const strict = args.includes('--strict');
const fast = args.includes('--fast');
const text = readArg('--text') || 'status do Zavorth';
const kind = (readArg('--kind') as any) || null;
const profileId = readArg('--profile') || process.env.ZAVORTH_PROFILE || null;

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

async function main(): Promise<void> {
  const service = new ZavorthAgentKernelSnapshotService();
  const snapshot = await service.buildSnapshot({
    text,
    kind,
    channel: 'cli',
    profileId,
    includeProviderActivation: !fast,
  });

  if (strict) {
    const failures = [
      snapshot.surface !== 'agent-kernel-snapshot' ? 'unexpected snapshot surface' : '',
      snapshot.capabilityPassport.providers.needsConnector > 0 ? 'provider connector backlog is not empty' : '',
      snapshot.cleanInstallCertification.status === 'blocked' ? 'clean install certification is blocked' : '',
      !snapshot.capabilityPassport.safety.noRawSecrets ? 'raw secret safety flag is disabled' : '',
      !snapshot.llmContextBlock.includes('routing rule') ? 'llm context block is missing routing rule' : '',
      !snapshot.intentDecision ? 'intent decision was not produced' : '',
    ].filter(Boolean);
    if (failures.length > 0) {
      throw new Error(`Agent Kernel check failed: ${failures.join('; ')}`);
    }
  }

  if (json) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }
}

function readArg(name: string): string | null {
  const index = args.indexOf(name);
  if (index >= 0) {
    return args[index + 1] || null;
  }
  const prefix = `${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}
