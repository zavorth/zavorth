import { SupervisedNodeInvokeAdapter } from '../../../src/adapters/overlord/SupervisedNodeInvokeAdapter.js';

describe('SupervisedNodeInvokeAdapter', () => {
  it('queues node invocations through the injected node service', async () => {
    const service = {
      invoke: jest.fn(() => ({
        ok: true,
        status: 'queued',
        nodeId: 'node-1',
        capabilityId: 'system.run',
        action: 'exec',
        reason: 'queued',
        transport: 'headless-host',
        commandHint: 'aguarde',
        queuedAt: '2026-04-11T10:00:00.000Z',
        invocationId: 'inv-1',
      })),
      preview: jest.fn(),
    };
    const adapter = new SupervisedNodeInvokeAdapter({
      nodeInvokeService: service as any,
    });

    const result = await adapter.execute(
      {
        capability: 'node.invoke',
        command: JSON.stringify({
          nodeId: 'node-1',
          capabilityId: 'system.run',
          action: 'exec',
          payload: { command: 'echo ok' },
        }),
        requestedBy: 'alice',
      },
      {
        runtimeTarget: 'node',
      } as any,
    );

    expect(service.invoke).toHaveBeenCalledWith(expect.objectContaining({
      nodeId: 'node-1',
      capabilityId: 'system.run',
      action: 'exec',
      requestedBy: 'alice',
    }));
    expect(result.ok).toBe(true);
    expect(result.metadata?.invocationId).toBe('inv-1');
  });

  it('supports preview mode for node invoke requests', async () => {
    const service = {
      invoke: jest.fn(),
      preview: jest.fn(() => ({
        ok: false,
        status: 'blocked',
        nodeId: 'node-1',
        capabilityId: 'files.write',
        action: 'write',
        reason: 'blocked',
        transport: 'headless-host',
        commandHint: 'allowlist',
        queuedAt: null,
      })),
    };
    const adapter = new SupervisedNodeInvokeAdapter({
      nodeInvokeService: service as any,
    });

    const result = await adapter.execute(
      {
        capability: 'node.invoke',
        command: JSON.stringify({
          mode: 'preview',
          nodeId: 'node-1',
          capabilityId: 'files.write',
          action: 'write',
        }),
      },
      {
        runtimeTarget: 'node',
      } as any,
    );

    expect(service.preview).toHaveBeenCalledTimes(1);
    expect(service.invoke).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('node_invoke_failed');
  });
});
