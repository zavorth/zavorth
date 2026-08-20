import type { IZavorthTool } from '../../types/IZavorthTool.js';
import { ZavorthActionCatalog } from '../../../runtime/actions/ZavorthActionCatalog.js';
import { ZavorthActionGateway } from '../../../runtime/actions/ZavorthActionGateway.js';
import type { ZavorthActionDefinition } from '../../../runtime/actions/ZavorthActionContracts.js';
import { ActionHarnessToolAdapter, toProviderSafeToolName } from './ActionHarnessToolAdapter.js';

export function buildVerifiedActionHarnessTools(gateway?: ZavorthActionGateway): IZavorthTool[] {
  const gw = gateway || new ZavorthActionGateway();
  const actions = new ZavorthActionCatalog()
    .list()
    .filter((action) => action.verificationStatus === 'verified')
    .filter((action) => action.surface.includes('llm'));

  assertUniqueToolNames(actions);

  return actions.map((action) => new ActionHarnessToolAdapter(action, gw));
}

function assertUniqueToolNames(actions: ZavorthActionDefinition[]): void {
  const seen = new Map<string, string>();
  for (const action of actions) {
    const name = toProviderSafeToolName(action.id);
    const previous = seen.get(name);
    if (previous) {
      throw new Error(`Duplicate LLM tool name "${name}" for actions "${previous}" and "${action.id}".`);
    }
    seen.set(name, action.id);
  }
}
