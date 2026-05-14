import { buildNodeCapabilitiesRegistry } from '../../src/nodes/capabilities/NodeCapabilities.js';

describe('NodeCapabilities', () => {
  it('delegates supported capabilities to the host capability service', async () => {
    const capabilityService = {
      listSupportedCapabilityIds: jest.fn(() => ['screen.capture', 'clipboard.read', 'clipboard.write', 'notifications.send']),
      executeAssignment: jest.fn(async (assignment: { capabilityId: string }) => ({
        invocationId: 'inv-1',
        ok: true,
        resultSummary: `${assignment.capabilityId} ok`,
        stdout: null,
        stderr: null,
        exitCode: 0,
        data: { capabilityId: assignment.capabilityId },
      })),
    };

    const registry = buildNodeCapabilitiesRegistry({
      capabilityService: capabilityService as any,
    });
    const screen = registry.find((entry) => entry.id === 'screen.capture');
    const clipboardWrite = registry.find((entry) => entry.id === 'clipboard.write');
    const browserProxy = registry.find((entry) => entry.id === 'browser.proxy');

    expect(screen).toBeDefined();
    expect(clipboardWrite).toBeDefined();
    expect(browserProxy).toBeDefined();
    await expect(screen!.isAvailableOnHost()).resolves.toBe(true);
    await expect(clipboardWrite!.isAvailableOnHost()).resolves.toBe(true);
    await expect(browserProxy!.isAvailableOnHost()).resolves.toBe(false);
    await expect(screen!.execute({ target: 'primary' })).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        data: {
          capabilityId: 'screen.capture',
        },
      }),
    );
    expect(capabilityService.executeAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilityId: 'screen.capture',
        action: 'invoke',
      }),
    );
  });
});
