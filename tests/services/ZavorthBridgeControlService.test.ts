import fs from 'fs';
import { ZavorthBridgeControlService } from '../../src/services/ZavorthBridgeControlService';
import { config } from '../../src/config/index.js';

describe('ZavorthBridgeControlService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    config.zavorthBridgeStartNewConversationPerTask = false;
  });

  it('parses noisy script output by extracting the JSON payload', () => {
    const service = Object.create(ZavorthBridgeControlService.prototype) as any;

    const parsed = service.parseJsonPayload(
      'Starting ZavorthBridge...\n{"ok":true,"stage":"status"}\nDone.',
      'test output',
    );

    expect(parsed).toEqual({ ok: true, stage: 'status' });
  });

  it('returns an empty allowlist when the models file is malformed', async () => {
    const service = Object.create(ZavorthBridgeControlService.prototype) as any;
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs.promises, 'readFile').mockResolvedValue('{invalid json' as any);

    await expect(service.getAllowedModels()).resolves.toEqual([]);
  });

  it('keeps the current prompt conversation by default when stabilizing the surface', async () => {
    const service = Object.create(ZavorthBridgeControlService.prototype) as any;
    config.zavorthBridgeStartNewConversationPerTask = false;
    service.bridge = {
      isOnline: jest.fn().mockResolvedValue(true),
      readStatus: jest.fn().mockResolvedValue({ instanceId: 'bridge-1' }),
      supports: jest.fn().mockResolvedValue(true),
      startNewConversation: jest.fn().mockResolvedValue({ ok: true }),
      executeCommand: jest.fn().mockResolvedValue({ ok: true }),
    };

    await service.stabilizePromptSurface();

    expect(service.bridge.startNewConversation).not.toHaveBeenCalled();
    expect(service.bridge.executeCommand).toHaveBeenCalledWith(
      'zavorthBridge.openAgent',
      [],
      undefined,
      5000,
      'bridge-1',
    );
  });
});
