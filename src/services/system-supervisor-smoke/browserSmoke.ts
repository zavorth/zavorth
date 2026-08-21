import { failFromSmokeAction, parseSmokeJson } from './smokeActions.js';
import type {
  BrowserToolLike,
  ExecuteSmokeAction,
  SystemOverlordSmokeItem,
} from './smokeTypes.js';

export async function runBrowserSmoke(
  probeUrl: string,
  input: {
    browserTool: BrowserToolLike;
    executeSmokeAction: ExecuteSmokeAction;
  },
): Promise<SystemOverlordSmokeItem> {
  const doctor = await input.browserTool.diagnose();
  if (!doctor.ok) {
    return {
      capability: 'browser.control',
      status: 'skipped',
      actionId: null,
      runtimeTarget: 'browser',
      summary: 'Supervised browser control skipped because the local browser stack is not ready.',
      detail: doctor.error || null,
      error: doctor.error || null,
      operatorNextStep: doctor.recommendations[0] || 'Provision playwright-core/playwright before validating the supervised browser.',
    };
  }

  const action = await input.executeSmokeAction({
    capability: 'browser.control',
    profile: 'dangerous',
    autonomyLevel: 5,
    approved: true,
    timeoutMs: 20_000,
    objective: 'validate browser control supervised at alvo local.',
    command: JSON.stringify({
      action: 'navigate',
      url: probeUrl,
    }),
  });
  if (action.status !== 'completed') {
    return failFromSmokeAction(
      'browser.control',
      action,
      'Browser control supervised failed ao navegar no alvo local do smoke.',
    );
  }

  const payload = parseSmokeJson(action.stdout || null);
  const resolvedUrl = String(payload?.url || '').trim();
  const title = String(payload?.title || '').trim();
  const urlLooksRight = resolvedUrl.startsWith(probeUrl.replace(/\/+$/, ''));
  if (!urlLooksRight) {
    return {
      capability: 'browser.control',
      status: 'failed',
      actionId: action.actionId,
      runtimeTarget: action.decision.runtimeTarget,
      summary: 'Supervised browser control responded, but did not navigate to the expected local target.',
      detail: action.stdout || null,
      error: action.errorMessage || 'URL returned by browser does not match the smoke target.',
      operatorNextStep: 'Review the Playwright stack and supervised browser policy before real navigation.',
    };
  }

  return {
    capability: 'browser.control',
    status: 'passed',
    actionId: action.actionId,
    runtimeTarget: action.decision.runtimeTarget,
    summary: `Browser control supervised navegou para ${resolvedUrl}.`,
    detail: title ? `Observed title: ${title}` : 'Local navigation completed.',
    error: null,
    operatorNextStep: null,
  };
}
