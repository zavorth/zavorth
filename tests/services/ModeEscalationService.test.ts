import fs from 'fs';
import os from 'os';
import path from 'path';
import { ModeEscalationService } from '../../src/services/ModeEscalationService';
import type { TaskResourceImpact } from '../../src/contracts/TaskResourcePlannerContract';
import { buildZavorthProductModeSnapshot } from '../../src/services/ProductModeService';

function createImpact(overrides: Partial<TaskResourceImpact> = {}): TaskResourceImpact {
  return {
    generatedAt: '2026-04-14T18:00:00.000Z',
    taskKind: 'chat',
    intent: 'edit code',
    heavy: false,
    approvalRequired: false,
    summary: 'Sem impacto pesado.',
    userFacingSummary: 'Posso seguir no core.',
    budget: {
      ramMb: 0,
      cpuPercent: 0,
      diskMb: 0,
      processCount: 0,
      externalExposure: 'none',
      recurring: false,
      companionDependencies: [],
      capabilityIds: [],
      fallback: 'Responder conceitualmente.',
      notes: [],
    },
    capabilityEstimates: [],
    companionEstimates: [],
    warnings: [],
    ...overrides,
  };
}

describe('ModeEscalationService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  function createStateFile(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mode-escalation-'));
    tempDirs.push(root);
    return path.join(root, 'state.json');
  }

  it('creates a pending escalation when chat mode receives a builder-style request', () => {
    const service = new ModeEscalationService({
      now: () => new Date('2026-04-14T18:00:00.000Z'),
      stateFilePath: createStateFile(),
      capabilityLifecycle: {
        getProductMode: () => 'chat',
        getProfile: () => 'core',
        buildProductModeSnapshot: () => buildZavorthProductModeSnapshot('chat', 'core'),
      } as any,
    });

    const result = service.evaluateChatRequest({
      sessionId: 'session-chat-1',
      message: 'edit this code and show me the diff',
      resourceImpact: createImpact(),
      requestedBy: 'web-user',
    });

    expect(result.allowed).toBe(false);
    expect(result.request).toEqual(expect.objectContaining({
      currentMode: expect.objectContaining({ id: 'chat' }),
      requiredMode: expect.objectContaining({ id: 'builder' }),
      status: 'pending',
    }));
    expect(result.snapshot.pendingRequest).toEqual(expect.objectContaining({
      id: result.request?.id,
    }));
  });

  it('approves a session grant and then allows the same request without changing the base product mode', () => {
    const service = new ModeEscalationService({
      now: () => new Date('2026-04-14T18:00:00.000Z'),
      stateFilePath: createStateFile(),
      capabilityLifecycle: {
        getProductMode: () => 'assistant',
        getProfile: () => 'core',
        buildProductModeSnapshot: () => buildZavorthProductModeSnapshot('assistant', 'core'),
      } as any,
    });

    const firstPass = service.evaluateChatRequest({
      sessionId: 'session-chat-2',
      message: 'edit this code and run the tests',
      resourceImpact: createImpact(),
      requestedBy: 'web-user',
    });
    const requestId = firstPass.request?.id;
    expect(requestId).toBeTruthy();

    const resolution = service.resolveRequest({
      requestId: String(requestId),
      decision: 'approve',
      scope: 'session',
      requestedBy: 'web-user',
    });

    expect(resolution.grant).toEqual(expect.objectContaining({
      scope: 'session',
      targetMode: 'builder',
    }));
    expect(resolution.snapshot.baseMode.id).toBe('assistant');
    expect(resolution.snapshot.effectiveMode.id).toBe('builder');

    const secondPass = service.evaluateChatRequest({
      sessionId: 'session-chat-2',
      message: 'edit this code and run the tests',
      resourceImpact: createImpact(),
      requestedBy: 'web-user',
    });

    expect(secondPass.allowed).toBe(true);
    expect(secondPass.snapshot.baseMode.id).toBe('assistant');
    expect(secondPass.snapshot.effectiveMode.id).toBe('builder');
  });

  it('consumes a once grant after one matching use', () => {
    const service = new ModeEscalationService({
      now: () => new Date('2026-04-14T18:00:00.000Z'),
      stateFilePath: createStateFile(),
      capabilityLifecycle: {
        getProductMode: () => 'chat',
        getProfile: () => 'core',
        buildProductModeSnapshot: () => buildZavorthProductModeSnapshot('chat', 'core'),
      } as any,
    });

    const request = service.evaluateChatRequest({
      sessionId: 'session-chat-3',
      message: 'edit this code',
      resourceImpact: createImpact(),
      requestedBy: 'web-user',
    }).request;

    service.resolveRequest({
      requestId: String(request?.id),
      decision: 'approve',
      scope: 'once',
      requestedBy: 'web-user',
    });

    const firstUse = service.evaluateChatRequest({
      sessionId: 'session-chat-3',
      message: 'edit this code',
      resourceImpact: createImpact(),
      requestedBy: 'web-user',
    });
    expect(firstUse.allowed).toBe(true);

    const secondUse = service.evaluateChatRequest({
      sessionId: 'session-chat-3',
      message: 'edit this code',
      resourceImpact: createImpact(),
      requestedBy: 'web-user',
    });
    expect(secondUse.allowed).toBe(false);
    expect(secondUse.request).toEqual(expect.objectContaining({
      status: 'pending',
    }));
  });
});
