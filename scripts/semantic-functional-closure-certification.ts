import { ZavorthSemanticFunctionalClosureCertificationService } from '../src/services/ZavorthSemanticFunctionalClosureCertificationService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const requirePass = args.includes('--require-pass');
const releaseGateOnly = args.includes('--release-gate');
const rootDir = readArg('--root-dir');

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthSemanticFunctionalClosureCertificationService({
    rootDir: rootDir || undefined,
  });
  const snapshot = await service.buildSnapshot();

  if (asJson) {
    console.log(JSON.stringify(releaseGateOnly ? {
      status: snapshot.status,
      releaseAllowed: snapshot.summary.releaseAllowed,
      gaps: snapshot.summary.gaps,
      releaseBlockers: snapshot.summary.releaseBlockers,
      p0Items: snapshot.summary.p0Items,
      p1Items: snapshot.summary.p1Items,
      p2Items: snapshot.summary.p2Items,
      contractVersion: snapshot.contractVersion,
      semanticPhase: snapshot.semanticPhase,
    } : snapshot, null, 2));
  } else if (releaseGateOnly) {
    console.log(service.formatReleaseGateText(snapshot));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (requirePass && snapshot.status !== 'passed') {
    process.exitCode = 1;
  }
}

function readArg(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) {
    return direct.slice(name.length + 1);
  }
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}
