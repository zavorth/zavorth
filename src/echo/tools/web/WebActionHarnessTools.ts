import type { IZavorthTool } from '../../types/IZavorthTool.js';
import { ActionHarnessToolAdapter } from './ActionHarnessToolAdapter.js';
import { createWebBrowserActionModule } from '../../../runtime/actions/modules/webBrowser.js';
import { ZavorthActionGateway } from '../../../runtime/actions/ZavorthActionGateway.js';

/**
 * Builds IZavorthTool instances for all web/browser actions defined in the
 * Action Harness's webBrowser module. These tools are registered in the
 * EchoOrchestrator so the LLM can discover and invoke them via function calling.
 *
 * The LLM sees them as regular tools alongside OS/IOT tools — it decides
 * autonomously when to use them based on the user's natural language request.
 */
export function buildWebActionHarnessTools(gateway?: ZavorthActionGateway): IZavorthTool[] {
  const gw = gateway || new ZavorthActionGateway();
  const module = createWebBrowserActionModule();

  return module.actions
    .filter((action) => action.surface.includes('llm'))
    .map((action) => new ActionHarnessToolAdapter(action, gw));
}
