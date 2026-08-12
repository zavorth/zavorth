import { ZavorthComputerControlPlaneService } from '../../../src/services/ZavorthComputerControlPlaneService';

describe('ZavorthComputerControlPlaneService', () => {
  it('builds read-only observe plans without desktop mutation', async () => {
    const service = new ZavorthComputerControlPlaneService();

    const snapshot = await service.execute({
      action: 'computer.observe',
      targetWindow: 'Notepad',
      screenText: 'Tela normal sem segredo',
      sourceSurface: 'telegram',
    });

    expect(snapshot.status).toBe('ready');
    expect(snapshot.policy.decision).toBe('allow_readonly');
    expect(snapshot.plan.mutationRequested).toBe(false);
    expect(snapshot.plan.steps.map((step) => step.kind)).toEqual([
      'focus-window',
      'list-elements',
      'screenshot',
    ]);
    expect(snapshot.safety.previewBeforeClickOrTyping).toBe(true);
    expect(snapshot.safety.liveMutationPerformed).toBe(false);
  });

  it('returns Watch Mode setup guidance when desktop live observe is not attached', async () => {
    const service = new ZavorthComputerControlPlaneService();

    const snapshot = await service.execute({
      action: 'computer.observe',
      targetWindow: 'Notepad',
      objective: 'olhe a janela',
    });
    const response = service.buildSurfaceResponse(snapshot);
    const serialized = JSON.stringify(response);

    expect(snapshot.watchMode.available).toBe(false);
    expect(response.metadata?.setupRequired).toBe(true);
    expect(serialized).toContain('Ativar observacao do computador');
    expect(serialized).toContain('/watchmode');
  });

  it.each([
    ['Windows PowerShell', 'terminal'],
    ['Executar', 'shell-launcher'],
    ['Bitwarden', 'password-manager'],
    ['Authenticator MFA', 'mfa-or-auth'],
  ])('blocks sensitive desktop target %s', async (targetWindow, risk) => {
    const service = new ZavorthComputerControlPlaneService();

    const snapshot = await service.execute({
      action: 'computer.observe',
      targetWindow,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.policy.decision).toBe('deny');
    expect(snapshot.hardBlocks.risks).toContain(risk);
    expect(snapshot.safety.liveMutationPerformed).toBe(false);
  });

  it('keeps click, type and key plans approval-first', async () => {
    const service = new ZavorthComputerControlPlaneService();

    const snapshot = await service.execute({
      action: 'computer.plan',
      targetWindow: 'Notepad',
      targetText: 'Salvar',
      payload: 'Texto aprovado',
      objective: 'clique, digite e pressione enter',
    });

    expect(snapshot.status).toBe('approval-required');
    expect(snapshot.policy.decision).toBe('require_owner_approval');
    expect(snapshot.plan.approvalRequired).toBe(true);
    expect(snapshot.plan.steps.map((step) => step.kind)).toEqual(expect.arrayContaining([
      'click-element',
      'type-text',
      'press-key',
    ]));
    expect(snapshot.safety.liveMutationPerformed).toBe(false);
  });

  it('redacts screen evidence through the vision control plane', async () => {
    const service = new ZavorthComputerControlPlaneService();
    const secret = 'sk-' + 'computerControlUnitSecret999';

    const snapshot = await service.execute({
      action: 'computer.observe',
      targetWindow: 'Notepad',
      screenText: `token=abc123456789 ${secret}`,
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.status).toBe('redacted');
    expect(snapshot.policy.decision).toBe('allow_with_redaction');
    expect(snapshot.vision.redaction.applied).toBe(true);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain('token=abc123456789');
    expect(serialized).toContain('[redacted-secret]');
  });

  it('delegates cancel to ComputerUseWatchModeService when attached', async () => {
    const stopRun = jest.fn(() => ({ runId: 'run-123' }));
    const service = new ZavorthComputerControlPlaneService({
      watchMode: {
        buildSnapshot: () => ({
          activeRun: { status: 'running' },
          policy: {
            strictApprovalDefault: true,
            allowedApps: ['Notepad'],
            allowedSites: [],
            defaultBudget: {
              maxIterations: 3,
              maxScreenshots: 9,
              maxDurationMs: 60000,
              idleTtlMs: 10000,
            },
          },
        }) as any,
        previewMutation: jest.fn(),
        pauseRun: jest.fn(),
        stopRun,
      },
    });

    const snapshot = await service.execute({
      action: 'computer.cancel',
      runId: 'run-123',
      actorId: 'owner',
    });

    expect(stopRun).toHaveBeenCalledWith('run-123', 'owner');
    expect(snapshot.watchMode.used).toBe(true);
    expect(snapshot.watchMode.runId).toBe('run-123');
    expect(snapshot.plan.status).toBe('cancelled-preview');
  });
});
