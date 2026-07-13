import { ZavorthPerceptionInvocationRouter } from '../../../src/services/ZavorthPerceptionInvocationRouter';

describe('ZavorthPerceptionInvocationRouter', () => {
  it('routes natural Android observation to the device bridge', () => {
    const router = new ZavorthPerceptionInvocationRouter();

    const plan = router.plan({
      text: 'olhe meu celular e diga se passou',
      channel: 'telegram',
      actorId: 'owner',
    });

    expect(plan.source).toBe('ZavorthPerceptionInvocationRouter');
    expect(plan.primaryRoute).toBe('android');
    expect(plan.commands.android?.action).toBe('device.observe');
    expect(plan.commands.android?.live).toBe(true);
    expect(plan.explanation.factsObserved.join('\n')).toContain('android');
    expect(plan.explanation.actionsExecuted).toContain('No live mutation was executed by the router.');
    expect(plan.activation.normalUserDoesNotNeedManualCommand).toBe(true);
    expect(plan.activation.hints).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'android-adb-setup',
        state: 'physical-step-if-missing',
      }),
    ]));
  });

  it('routes visual-only requests to the vision plane', () => {
    const router = new ZavorthPerceptionInvocationRouter();

    const plan = router.plan({
      text: 'confirme visualmente o resultado',
      channel: 'whatsapp',
    });

    expect(plan.primaryRoute).toBe('vision');
    expect(plan.commands.vision?.action).toBe('vision.inspect');
    expect(plan.commands.browser).toBeNull();
    expect(plan.commands.computer).toBeNull();
    expect(plan.commands.android).toBeNull();
  });

  it('routes browser PDF comparison to read-only perception subagents', () => {
    const router = new ZavorthPerceptionInvocationRouter();

    const plan = router.plan({
      text: 'abra o site https://example.com/report.pdf, leia o PDF e compare com a tela',
      channel: 'discord',
    });

    expect(plan.primaryRoute).toBe('subagent_perception');
    expect(plan.routes).toEqual(expect.arrayContaining(['subagent_perception', 'browser']));
    expect(plan.commands.browser?.action).toBe('browser.inspect');
    expect(plan.commands.subagent?.perceptionRoles).toEqual(expect.arrayContaining([
      'observer',
      'evidence-summarizer',
      'safety-reviewer',
    ]));
    expect(plan.commands.subagent?.runtimeRoleIds).toEqual(expect.arrayContaining(['researcher', 'auditor']));
  });

  it('routes desktop/app mutation to computer plan and approval-required status', () => {
    const router = new ZavorthPerceptionInvocationRouter();

    const plan = router.plan({
      text: 'resolva esse problema no app Notepad, mas me peca confirmacao antes de clicar',
      channel: 'signal',
    });

    expect(plan.status).toBe('approval-required');
    expect(plan.primaryRoute).toBe('computer');
    expect(plan.commands.computer?.action).toBe('computer.plan');
    expect(plan.approval.required).toBe(true);
    expect(plan.explanation.actionsBlocked.join('\n')).toContain('Mutation stays pending');
  });

  it('routes explicit subagent screen review without allowing mutation', () => {
    const router = new ZavorthPerceptionInvocationRouter();

    const plan = router.plan({
      text: 'use subagentes para revisar o que aparece na tela',
      channel: 'telegram',
    });

    expect(plan.primaryRoute).toBe('subagent_perception');
    expect(plan.commands.subagent?.readOnlyOnly).toBe(true);
    expect(plan.safety.subagentsReadOnlyOnly).toBe(true);
    expect(plan.surfaceCommands.some((command) => command.command.startsWith('/agents spawn'))).toBe(true);
  });

  it('denies sensitive perception control targets', () => {
    const router = new ZavorthPerceptionInvocationRouter();

    const plan = router.plan({
      text: 'olhe a tela do banco e clique para confirmar o pix',
      channel: 'telegram',
    });

    expect(plan.status).toBe('denied');
    expect(plan.primaryRoute).toBe('deny');
    expect(plan.approval.required).toBe(true);
    expect(plan.explanation.actionsBlocked.join('\n')).toContain('Tela sensivel detectada');
  });
});
