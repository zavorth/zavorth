import { ZavorthGovernanceControlPlaneService } from '../src/services/ZavorthGovernanceControlPlaneService.js';

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
  const limit = Number(readFlag('--limit') || 8);
  const service = new ZavorthGovernanceControlPlaneService();
  const snapshot = service.buildSnapshot({ limit });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    console.log('[zavorth-governance] leitura consolidada da Wave 7');
    console.log(`[zavorth-governance] postura: ${snapshot.summary.posture}`);
    console.log(`[zavorth-governance] resumo: ${snapshot.narrative.operatorSummary}`);
    console.log(`[zavorth-governance] tenants: ${snapshot.summary.tenants} | shared: ${snapshot.summary.sharedTenants} | onboarding: ${snapshot.summary.pendingOnboarding}`);
    console.log(`[zavorth-governance] trust: MCP ${snapshot.summary.mcpProfile} | approvals ${snapshot.summary.pendingApprovals} | high-risk ${snapshot.summary.highRiskCapabilities}`);
    console.log(`[zavorth-governance] proximo passo: ${snapshot.narrative.nextAction}`);
    if (snapshot.actions.length > 0) {
      console.log('[zavorth-governance] acoes sugeridas:');
      for (const action of snapshot.actions) {
        console.log(`- ${action.label}${action.command ? ` | ${action.command}` : ''}`);
      }
    }
  }

  if (requirePass && snapshot.summary.posture === 'critical') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[zavorth-governance] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
