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
      summary: 'Browser control supervisionado pulado porque a stack local de browser nao esta pronta.',
      detail: doctor.error || null,
      error: doctor.error || null,
      operatorNextStep: doctor.recommendations[0] || 'Provisione playwright-core/playwright antes de validar o browser supervisionado.',
    };
  }

  const action = await input.executeSmokeAction({
    capability: 'browser.control',
    profile: 'dangerous',
    autonomyLevel: 5,
    approved: true,
    timeoutMs: 20_000,
    objective: 'Validar browser control supervisionado em alvo local.',
    command: JSON.stringify({
      action: 'navigate',
      url: probeUrl,
    }),
  });
  if (action.status !== 'completed') {
    return failFromSmokeAction(
      'browser.control',
      action,
      'Browser control supervisionado falhou ao navegar no alvo local do smoke.',
    );
  }

  const payload = parseSmokeJson(action.stdout);
  const resolvedUrl = String(payload?.url || '').trim();
  const title = String(payload?.title || '').trim();
  const urlLooksRight = resolvedUrl.startsWith(probeUrl.replace(/\/+$/, ''));
  if (!urlLooksRight) {
    return {
      capability: 'browser.control',
      status: 'failed',
      actionId: action.actionId,
      runtimeTarget: action.decision.runtimeTarget,
      summary: 'Browser control supervisionado respondeu, mas nao navegou para o alvo local esperado.',
      detail: action.stdout || null,
      error: action.errorMessage || 'URL retornada pelo browser nao bate com o alvo do smoke.',
      operatorNextStep: 'Revise a stack Playwright e a politica do browser supervisionado antes de usar navegacao real.',
    };
  }

  return {
    capability: 'browser.control',
    status: 'passed',
    actionId: action.actionId,
    runtimeTarget: action.decision.runtimeTarget,
    summary: `Browser control supervisionado navegou para ${resolvedUrl}.`,
    detail: title ? `Titulo observado: ${title}` : 'Navegacao local concluida.',
    error: null,
    operatorNextStep: null,
  };
}
