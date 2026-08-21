import { GatewayEventBus } from '../../src/gateway/events/GatewayEventBus';
import { ChannelPolicyManager } from '../../src/channels/policies/ChannelPolicyManager';
import { MatrixGateway } from '../../src/gateways/channels/simple/MatrixGateway';
import { ChannelGatewayFactory } from '../../src/gateways/ChannelGatewayFactory';
import path from 'node:path';
import os from 'node:os';

describe('WebhookGateway shared completeness bar', () => {
  function openPolicyManager() {
    const policyManager = new ChannelPolicyManager({
      policyFile: path.join(os.tmpdir(), `zavorth-policy-${Date.now()}.json`),
    });
    // Open access for hermetic smoke
    (policyManager as any).policies?.set?.('matrix', {
      channelId: 'matrix',
      isOpenAccess: true,
      allowedList: [],
      blockedList: [],
      updatedAt: new Date().toISOString(),
    });
    jest.spyOn(policyManager, 'verifyAccess').mockResolvedValue(true);
    return policyManager;
  }

  it('exposes doctor, command deck, mock I/O, redaction and continuity for Matrix', async () => {
    const gateway = new MatrixGateway({
      eventBus: new GatewayEventBus(),
      policyManager: openPolicyManager(),
    });
    await gateway.initialize();

    const doctor = gateway.doctorSnapshot();
    expect(doctor.channelId).toBe('matrix');
    expect(doctor.completeness.firstClass).toBe(true);
    expect(doctor.secretsRedacted).toBe(true);
    expect(doctor.allowlist.unauthorizedBlocked).toBe(true);

    const deck = gateway.commandDeckMin();
    expect(deck.map((entry) => entry.command)).toEqual(
      expect.arrayContaining(['/help', '/commands', '/status', '/gateway', '/channels', '/models']),
    );

    const help = gateway.handleCommandDeck('/help');
    expect(help).toContain('/status');

    const inbound = await gateway.mockInbound({
      body: 'hello matrix completeness',
      text: 'hello matrix completeness',
      sender: '@user:example.org',
      room_id: '!room:example.org',
    });
    expect(inbound.ok).toBe(true);
    expect(inbound.sessionKey).toContain('matrix:');

    const outbound = await gateway.mockOutbound('outbound proof', '!room:example.org');
    expect(outbound.ok).toBe(true);
    expect(['queued', 'delivered', 'failed']).toContain(outbound.status);

    expect(gateway.redactSecrets('token=supersecrettokenvalue1234567890')).toContain('***');
    expect(gateway.continuitySessionKey('u1', 's1')).toBe('matrix:u1:s1');
  });

  it('factory createFromId returns gateways with completeness for all ids', () => {
    const policyManager = openPolicyManager();
    jest.spyOn(policyManager, 'verifyAccess').mockResolvedValue(true);
    for (const id of ChannelGatewayFactory.listSupportedChannelIds()) {
      const gateway = ChannelGatewayFactory.createFromId(id, {
        eventBus: new GatewayEventBus(),
        policyManager,
      });
      expect(gateway).toBeTruthy();
      expect(gateway!.completenessReport().firstClass).toBe(true);
      expect(gateway!.doctorSnapshot().channelId).toBe(id);
    }
  });
});
