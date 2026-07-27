import {
  ZavorthCapabilityHubApiService,
  type CapabilityHubApiListInput,
} from '../src/services/ZavorthCapabilityHubApiService.js';
import type {
  CapabilityHubItemKind,
  CapabilityHubReadiness,
} from '../src/contracts/CapabilityHubContract.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const inspectId = readOption('--inspect') || readOption('--id');
const input: CapabilityHubApiListInput = {
  search: readOption('--search') || readOption('--query'),
  kind: readOption('--kind') as CapabilityHubItemKind | null,
  readiness: readOption('--readiness') as CapabilityHubReadiness | null,
  selectedId: inspectId,
};

const api = new ZavorthCapabilityHubApiService();

if (inspectId) {
  const result = api.inspect(inspectId);
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!result.found) {
    console.log(`Capability Hub: could not find "${inspectId}".`);
  } else {
    const item = result.item;
    console.log('Zavorth Capability Hub');
    console.log('');
    console.log(`${item?.id} [${item?.kind}/${item?.readiness}]`);
    console.log(item?.label);
    console.log(item?.summary);
    console.log('');
    console.log(`Governance: risk=${item?.governance.risk} approval=${item?.governance.requiresApproval} sandbox=${item?.governance.sandboxRequired}`);
    console.log(`Activation: live=${item?.activation.liveAllowed} configured=${item?.activation.configured} setup=${item?.activation.setupGuided}`);
    console.log(`Checks: ${item?.activation.readinessChecks.join(', ') || 'none'}`);
    if (result.related.length > 0) {
      console.log('');
      console.log('Related:');
      for (const related of result.related) {
        console.log(`- ${related.id} [${related.readiness}] ${related.label}`);
      }
    }
  }
} else {
  const snapshot = api.buildSnapshot(input);
  if (asJson) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(api.renderReport(input));
  }
}

function readOption(name: string): string | null {
  const index = args.indexOf(name);
  if (index < 0) {
    return null;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    return null;
  }
  return value;
}
