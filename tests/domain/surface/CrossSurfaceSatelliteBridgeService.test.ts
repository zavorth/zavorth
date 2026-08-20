import { CrossSurfaceSatelliteBridgeService } from '../../../src/domain/surface/infrastructure/CrossSurfaceSatelliteBridgeService.js';
import type { CompanionServerEvent } from '../../../src/contracts/SatelliteCompanionContract.js';

describe('CrossSurfaceSatelliteBridgeService', () => {
  let bridge: CrossSurfaceSatelliteBridgeService;
  const pairingToken = 'TEST99';

  beforeEach(() => {
    bridge = new CrossSurfaceSatelliteBridgeService(pairingToken);
  });

  it('authenticates remote device with correct pairing token and rejects invalid token', () => {
    const receivedEvents: CompanionServerEvent[] = [];
    const mockSend = (event: CompanionServerEvent) => receivedEvents.push(event);

    bridge.registerDevice('dev-1', mockSend);

    // 1. Invalid Token Attempt
    bridge.handleClientMessage('dev-1', {
      type: 'auth',
      pairingToken: 'WRONG1',
      deviceName: 'iPhone 15',
    });

    expect(bridge.getConnectedDevicesCount()).toBe(0);
    expect(receivedEvents[0].type).toBe('auth_failed');

    // 2. Valid Token Attempt
    bridge.handleClientMessage('dev-1', {
      type: 'auth',
      pairingToken: 'TEST99',
      deviceName: 'iPhone 15',
    });

    expect(bridge.getConnectedDevicesCount()).toBe(1);
    expect(receivedEvents[1].type).toBe('auth_success');
  });

  it('broadcasts tool permission requests and resolves when device grants approval', async () => {
    const receivedEvents: CompanionServerEvent[] = [];
    const mockSend = (event: CompanionServerEvent) => receivedEvents.push(event);

    bridge.registerDevice('dev-1', mockSend);
    bridge.handleClientMessage('dev-1', {
      type: 'auth',
      pairingToken: 'TEST99',
      deviceName: 'Pixel 9',
    });

    const permissionPromise = bridge.requestRemotePermission('run_command', { command: 'npm test' }, 'review', 5000);

    // Verify broadcast event was sent
    const permReq = receivedEvents.find((e) => e.type === 'permission_request');
    expect(permReq).toBeDefined();

    if (permReq && permReq.type === 'permission_request') {
      // Simulate mobile device clicking "allow"
      bridge.handleClientMessage('dev-1', {
        type: 'permission_response',
        requestId: permReq.requestId,
        decision: 'allow',
      });
    }

    const decision = await permissionPromise;
    expect(decision).toBe('allow');
  });

  it('relays steering prompt from companion app to registered agent listener', () => {
    const mockSend = jest.fn();
    bridge.registerDevice('dev-1', mockSend);
    bridge.handleClientMessage('dev-1', {
      type: 'auth',
      pairingToken: 'TEST99',
      deviceName: 'MacBook',
    });

    const steeringHandler = jest.fn();
    bridge.onSteeringPrompt(steeringHandler);

    bridge.handleClientMessage('dev-1', {
      type: 'steering_prompt',
      text: 'Pause and run linting first',
      priority: 'interrupt',
    });

    expect(steeringHandler).toHaveBeenCalledWith('Pause and run linting first', 'interrupt');
  });
});
