import { ZavorthPerceptionInvocationRouter } from '../../../src/services/ZavorthPerceptionInvocationRouter';

describe('ZavorthPerceptionInvocationRouter', () => {
  it('never keyword-activates perception from free text alone', () => {
    const router = new ZavorthPerceptionInvocationRouter();

    expect(router.canHandle('olhe meu celular e diga se passou')).toBe(false);
    expect(router.canHandle('use subagents to review the screen')).toBe(false);
    expect(router.canHandle('click the bank button')).toBe(false);

    const plan = router.plan({
      text: 'olhe meu celular e diga se passou',
      channel: 'telegram',
      actorId: 'owner',
    });

    expect(plan.source).toBe('ZavorthPerceptionInvocationRouter');
    // Free text alone → default vision / unknown, no mutation, no deny, no subagents.
    expect(plan.primaryRoute).toBe('vision');
    expect(plan.target.kind).toBe('unknown');
    expect(plan.target.mutationRequested).toBe(false);
    expect(plan.target.sensitive).toBe(false);
    expect(plan.commands.android).toBeNull();
    expect(plan.commands.subagent).toBeNull();
    expect(plan.explanation.actionsExecuted).toContain('No live mutation was executed by the router.');
  });

  it('routes structured Android observation to the device bridge', () => {
    const router = new ZavorthPerceptionInvocationRouter();

    const plan = router.plan({
      text: 'olhe meu celular e diga se passou',
      channel: 'telegram',
      actorId: 'owner',
      targetKind: 'android',
      liveRequested: true,
    });

    expect(plan.primaryRoute).toBe('android');
    expect(plan.commands.android?.action).toBe('device.observe');
    expect(plan.commands.android?.live).toBe(true);
    expect(plan.explanation.factsObserved.join('\n')).toContain('android');
    expect(plan.activation.normalUserDoesNotNeedManualCommand).toBe(true);
    expect(plan.activation.hints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'android-adb-setup',
          state: 'physical-step-if-missing',
        }),
      ]),
    );
  });

  it('routes structured visual-only requests to the vision plane', () => {
    const router = new ZavorthPerceptionInvocationRouter();

    const plan = router.plan({
      text: 'visually confirm the result',
      channel: 'whatsapp',
      targetKind: 'visual',
    });

    expect(plan.primaryRoute).toBe('vision');
    expect(plan.commands.vision?.action).toBe('vision.inspect');
    expect(plan.commands.browser).toBeNull();
    expect(plan.commands.computer).toBeNull();
    expect(plan.commands.android).toBeNull();
  });

  it('does not force subagents from free-text compare/review phrases', () => {
    const router = new ZavorthPerceptionInvocationRouter();

    const plan = router.plan({
      text: 'open https://example.com/report.pdf, read the PDF, and compare it with the screen',
      channel: 'discord',
    });

    expect(plan.primaryRoute).toBe('vision');
    expect(plan.routes).not.toContain('subagent_perception');
    expect(plan.commands.subagent).toBeNull();
    expect(plan.commands.browser).toBeNull();
  });

  it('routes structured browser + subagent review to read-only perception subagents', () => {
    const router = new ZavorthPerceptionInvocationRouter();

    const plan = router.plan({
      text: 'open https://example.com/report.pdf, read the PDF, and compare it with the screen',
      channel: 'discord',
      targetKind: 'browser',
      complexReview: true,
    });

    expect(plan.primaryRoute).toBe('subagent_perception');
    expect(plan.routes).toEqual(expect.arrayContaining(['subagent_perception', 'browser']));
    expect(plan.commands.browser?.action).toBe('browser.inspect');
    expect(plan.commands.subagent?.perceptionRoles).toEqual(
      expect.arrayContaining(['observer', 'evidence-summarizer', 'safety-reviewer']),
    );
    expect(plan.commands.subagent?.runtimeRoleIds).toEqual(expect.arrayContaining(['researcher', 'auditor']));
  });

  it('does not invent mutation from free-text click phrases', () => {
    const router = new ZavorthPerceptionInvocationRouter();

    const freeText = router.plan({
      text: 'resolva esse problema no app Notepad, mas me peca confirmation antes de clicar',
      channel: 'signal',
    });

    expect(freeText.status).toBe('ready');
    expect(freeText.target.mutationRequested).toBe(false);
    expect(freeText.approval.required).toBe(false);
    expect(freeText.primaryRoute).toBe('vision');
  });

  it('routes structured desktop mutation to computer plan and approval-required status', () => {
    const router = new ZavorthPerceptionInvocationRouter();

    const plan = router.plan({
      text: 'resolva esse problema no app Notepad, mas me peca confirmation antes de clicar',
      channel: 'signal',
      targetKind: 'desktop',
      mutationRequested: true,
    });

    expect(plan.status).toBe('approval-required');
    expect(plan.primaryRoute).toBe('computer');
    expect(plan.commands.computer?.action).toBe('computer.plan');
    expect(plan.approval.required).toBe(true);
    expect(plan.explanation.actionsBlocked.join('\n')).toContain('Mutation stays pending');
  });

  it('routes structured subagent screen review without allowing mutation', () => {
    const router = new ZavorthPerceptionInvocationRouter();

    const plan = router.plan({
      text: 'use subagents to review what appears on screen',
      channel: 'telegram',
      targetKind: 'visual',
      requestSubagents: true,
    });

    expect(plan.primaryRoute).toBe('subagent_perception');
    expect(plan.commands.subagent?.readOnlyOnly).toBe(true);
    expect(plan.safety.subagentsReadOnlyOnly).toBe(true);
    expect(plan.surfaceCommands.some((command) => command.command.startsWith('/agents spawn'))).toBe(true);
  });

  it('does not deny sensitive targets from free-text bank/pix keywords alone', () => {
    const router = new ZavorthPerceptionInvocationRouter();

    const freeText = router.plan({
      text: 'look at the bank screen and click to confirm the pix',
      channel: 'telegram',
    });

    expect(freeText.status).toBe('ready');
    expect(freeText.primaryRoute).toBe('vision');
    expect(freeText.target.sensitive).toBe(false);
    expect(freeText.target.mutationRequested).toBe(false);
  });

  it('denies sensitive perception control targets only when structured sensitive=true', () => {
    const router = new ZavorthPerceptionInvocationRouter();

    const plan = router.plan({
      text: 'look at the bank screen and click to confirm the pix',
      channel: 'telegram',
      targetKind: 'visual',
      mutationRequested: true,
      sensitive: true,
    });

    expect(plan.status).toBe('denied');
    expect(plan.primaryRoute).toBe('deny');
    expect(plan.approval.required).toBe(true);
    expect(plan.explanation.actionsBlocked.join('\n')).toContain('Sensitive screen flagged');
  });
});
