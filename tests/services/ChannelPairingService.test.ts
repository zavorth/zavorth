import fs from 'fs';
import path from 'path';
import { ZavorthChannelPairingService, getChannelPairingService } from '../../src/services/ZavorthChannelPairingService';
import { ZavorthChannelMessageMiddleware } from '../../src/services/ZavorthChannelMessageMiddleware';


describe('ZavorthChannelPairingService', () => {
  let service: ZavorthChannelPairingService;

  beforeEach(() => {
    service = getChannelPairingService();
    service.clearPairings();
  });

  afterAll(() => {
    service.clearPairings();
    const storagePath = path.resolve(__dirname, 'data', 'runtime', 'channel-pairing.json');
    if (fs.existsSync(storagePath)) {
      try {
        fs.unlinkSync(storagePath);
      } catch (error: unknown) {
        // Ignored
      }
    }
  });

  it('generates a valid pairing code that expires', () => {
    const code = service.generateCode(1000); // 1s expiration
    expect(code).toBeDefined();
    expect(code.length).toBe(6);
    expect(service.getActiveCode()).toBe(code);
  });

  it('fails pairing with invalid code or after expiration', async () => {
    const code = service.generateCode(10); // 10ms expiration
    await new Promise((r) => setTimeout(r, 20)); // wait for expiration
    expect(service.getActiveCode()).toBeNull();
    const success = service.pairUser('telegram', 'user123', code);
    expect(success).toBe(false);
  });

  it('pairs user successfully with valid code', () => {
    const code = service.generateCode(60000);
    const success = service.pairUser('telegram', 'user123', code);
    expect(success).toBe(true);
    expect(service.isUserPaired('telegram', 'user123')).toBe(true);
  });

  it('middleware intercepts unpaired remote channels', async () => {
    const middleware = new ZavorthChannelMessageMiddleware();
    
    // First: Unpaired user message blocked
    const blockResult = await middleware.processIncoming({
      text: 'hello',
      channelId: 'telegram',
      userId: 'unpaired_user',
    });
    expect(blockResult.handled).toBe(true);
    expect(blockResult.action).toBe('pairing_required');
    expect(blockResult.response?.text).toContain('Access Denied');

    // Second: Active code generated
    const activeCode = service.generateCode();

    // Third: Send active code to pair
    const pairResult = await middleware.processIncoming({
      text: activeCode,
      channelId: 'telegram',
      userId: 'unpaired_user',
    });
    expect(pairResult.handled).toBe(true);
    expect(pairResult.action).toBe('pairing_success');
    expect(pairResult.response?.text).toContain('paired successfully');

    // Fourth: Subsequent messages are not handled by pairing (delegated to commandless router)
    const normalResult = await middleware.processIncoming({
      text: 'hello',
      channelId: 'telegram',
      userId: 'unpaired_user',
    });
    expect(normalResult.action).not.toBe('pairing_required');
    expect(normalResult.action).not.toBe('pairing_success');
  });
});
