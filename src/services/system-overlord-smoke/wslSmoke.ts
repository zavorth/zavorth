import { failFromSmokeAction, readSmokeStringArrayMetadata, shouldSkipOptionalSmokeRuntime, skipFromSmokeAction } from './smokeActions.js';
import type { ExecuteSmokeAction, SystemOverlordSmokeItem } from './smokeTypes.js';

export async function runWslSmoke(input: {
  platform: NodeJS.Platform;
  executeSmokeAction: ExecuteSmokeAction;
}): Promise<SystemOverlordSmokeItem> {
  if (input.platform !== 'win32') {
    return {
      capability: 'wsl.exec',
      status: 'skipped',
      actionId: null,
      runtimeTarget: 'wsl',
      summary: 'WSL supervisionado pulado porque este host nao e Windows.',
      detail: `Host atual: ${input.platform}.`,
      error: null,
      operatorNextStep: 'Rode este smoke em um host Windows com WSL para validar wsl.exec de ponta a ponta.',
    };
  }

  const inspect = await input.executeSmokeAction({
    capability: 'wsl.exec',
    profile: 'trusted',
    autonomyLevel: 4,
    approved: true,
    timeoutMs: 15_000,
    objective: 'Inspecionar distros WSL disponiveis para execucao supervisionada.',
    command: JSON.stringify({
      action: 'inspect',
    }),
  });
  if (inspect.status !== 'completed') {
    if (shouldSkipOptionalSmokeRuntime('wsl.exec', inspect)) {
      return skipFromSmokeAction(
        'wsl.exec',
        inspect,
        'WSL supervisionado pulado porque o runtime WSL ainda nao esta pronto neste host.',
        'Instale/configure o WSL e ao menos uma distribuicao antes de usar wsl.exec supervisionado.',
      );
    }
    return failFromSmokeAction(
      'wsl.exec',
      inspect,
      'WSL supervisionado falhou ainda na etapa de inspeÃ§Ã£o do runtime.',
    );
  }

  const distributions = readSmokeStringArrayMetadata(inspect, 'distributions');
  const distribution = distributions[0] || '';
  if (!distribution) {
    return {
      capability: 'wsl.exec',
      status: 'skipped',
      actionId: inspect.actionId,
      runtimeTarget: inspect.decision.runtimeTarget,
      summary: 'WSL supervisionado pulado porque nenhuma distribuicao apareceu disponivel.',
      detail: inspect.stdout || null,
      error: null,
      operatorNextStep: 'Instale e inicialize ao menos uma distro WSL antes de usar wsl.exec supervisionado.',
    };
  }

  const exec = await input.executeSmokeAction({
    capability: 'wsl.exec',
    profile: 'trusted',
    autonomyLevel: 4,
    approved: true,
    timeoutMs: 15_000,
    objective: 'Executar pwd supervisionado dentro da distribuicao WSL.',
    command: JSON.stringify({
      action: 'exec',
      distribution,
      command: 'pwd',
    }),
  });
  if (exec.status !== 'completed') {
    return failFromSmokeAction(
      'wsl.exec',
      exec,
      `WSL supervisionado encontrou a distro ${distribution}, mas falhou ao executar pwd.`,
    );
  }

  return {
    capability: 'wsl.exec',
    status: 'passed',
    actionId: exec.actionId,
    runtimeTarget: exec.decision.runtimeTarget,
    summary: `WSL supervisionado executou pwd na distro ${distribution}.`,
    detail: String(exec.stdout || '').trim() || null,
    error: null,
    operatorNextStep: null,
  };
}
