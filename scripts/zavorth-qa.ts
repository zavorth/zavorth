import { ZavorthQaControlPlaneService, type ZavorthQaProfile } from '../src/services/ZavorthQaControlPlaneService.js';

function readFlag(name: string): string | null {
  const argv = process.argv.slice(2);
  const index = argv.findIndex((entry) => entry === name);
  if (index >= 0 && argv[index + 1]) {
    return String(argv[index + 1]).trim() || null;
  }
  const inline = argv.find((entry) => entry.startsWith(`${name}=`));
  if (inline) {
    return String(inline.split('=').slice(1).join('=')).trim() || null;
  }
  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const requirePass = argv.includes('--require-pass');
  const requestedProfile = String(readFlag('--profile') || 'alpha').trim().toLowerCase();
  const profile = requestedProfile === 'beta' ? 'beta' : 'alpha';
  const service = new ZavorthQaControlPlaneService();
  const snapshot = service.buildSnapshot({ profile: profile as ZavorthQaProfile });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    console.log('[zavorth-qa] leitura consolidada do QA');
    console.log(`[zavorth-qa] perfil: ${snapshot.profile}`);
    console.log(`[zavorth-qa] postura: ${snapshot.summary.posture}`);
    console.log(`[zavorth-qa] arquitetura: ${snapshot.architecture.gate}`);
    console.log(`[zavorth-qa] resumo: ${snapshot.narrative.operatorSummary}`);
    console.log(`[zavorth-qa] release pronto: ${snapshot.summary.releaseReady ? 'sim' : 'nao'}`);
    console.log(`[zavorth-qa] proximo passo: ${snapshot.narrative.nextAction}`);
    if (snapshot.actions.length > 0) {
      console.log('[zavorth-qa] acoes sugeridas:');
      for (const action of snapshot.actions) {
        console.log(`- ${action.label}${action.command ? ` | ${action.command}` : ''}`);
      }
    }
  }

  if (requirePass && !snapshot.summary.releaseReady) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[zavorth-qa] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
