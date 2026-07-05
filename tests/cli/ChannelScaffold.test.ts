import { scaffoldChannel } from '../../src/cli/ChannelScaffoldCommand';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('ChannelScaffoldCommand', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'channel-scaffold-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Scaffold generation', () => {
    it('should create channel directory', () => {
      const result = scaffoldChannel(tempDir, { name: 'my-channel' });
      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'src', 'gateways', 'channels', 'my-channel'))).toBe(true);
    });

    it('should create adapter file', () => {
      const result = scaffoldChannel(tempDir, { name: 'my-channel' });
      expect(result.files).toContain('MyChannelChannelAdapter.ts');
      expect(fs.existsSync(path.join(tempDir, 'src', 'gateways', 'channels', 'my-channel', 'MyChannelChannelAdapter.ts'))).toBe(true);
    });

    it('should create gateway file', () => {
      const result = scaffoldChannel(tempDir, { name: 'my-channel' });
      expect(result.files).toContain('MyChannelGateway.ts');
      expect(fs.existsSync(path.join(tempDir, 'src', 'gateways', 'channels', 'my-channel', 'MyChannelGateway.ts'))).toBe(true);
    });

    it('should create capabilities config', () => {
      const result = scaffoldChannel(tempDir, { name: 'my-channel' });
      expect(result.files).toContain('capabilities.json');
      expect(fs.existsSync(path.join(tempDir, 'src', 'gateways', 'channels', 'my-channel', 'capabilities.json'))).toBe(true);
    });

    it('should create index file', () => {
      const result = scaffoldChannel(tempDir, { name: 'my-channel' });
      expect(result.files).toContain('index.ts');
      expect(fs.existsSync(path.join(tempDir, 'src', 'gateways', 'channels', 'my-channel', 'index.ts'))).toBe(true);
    });
  });

  describe('Adapter template content', () => {
    it('should contain channel name', () => {
      scaffoldChannel(tempDir, { name: 'my-channel' });
      const content = fs.readFileSync(
        path.join(tempDir, 'src', 'gateways', 'channels', 'my-channel', 'MyChannelChannelAdapter.ts'),
        'utf-8',
      );
      expect(content).toContain('my-channel');
      expect(content).toContain('MyChannelChannelAdapter');
    });

    it('should implement GatewayChannelAdapter', () => {
      scaffoldChannel(tempDir, { name: 'my-channel' });
      const content = fs.readFileSync(
        path.join(tempDir, 'src', 'gateways', 'channels', 'my-channel', 'MyChannelChannelAdapter.ts'),
        'utf-8',
      );
      expect(content).toContain('implements GatewayChannelAdapter');
    });

    it('should have onMessageReceived method', () => {
      scaffoldChannel(tempDir, { name: 'my-channel' });
      const content = fs.readFileSync(
        path.join(tempDir, 'src', 'gateways', 'channels', 'my-channel', 'MyChannelChannelAdapter.ts'),
        'utf-8',
      );
      expect(content).toContain('onMessageReceived');
    });

    it('should have sendMessage method', () => {
      scaffoldChannel(tempDir, { name: 'my-channel' });
      const content = fs.readFileSync(
        path.join(tempDir, 'src', 'gateways', 'channels', 'my-channel', 'MyChannelChannelAdapter.ts'),
        'utf-8',
      );
      expect(content).toContain('sendMessage');
    });
  });

  describe('Capabilities config', () => {
    it('should use custom max length', () => {
      scaffoldChannel(tempDir, { name: 'my-channel', maxLength: 2000 });
      const content = fs.readFileSync(
        path.join(tempDir, 'src', 'gateways', 'channels', 'my-channel', 'capabilities.json'),
        'utf-8',
      );
      expect(content).toContain('2000');
    });

    it('should enable buttons when specified', () => {
      scaffoldChannel(tempDir, { name: 'my-channel', supportsButtons: true });
      const content = fs.readFileSync(
        path.join(tempDir, 'src', 'gateways', 'channels', 'my-channel', 'capabilities.json'),
        'utf-8',
      );
      expect(content).toContain('"supportsButtons": true');
    });
  });

  describe('Name normalization', () => {
    it('should convert kebab-case to PascalCase', () => {
      const result = scaffoldChannel(tempDir, { name: 'my-custom-channel' });
      expect(result.files).toContain('MyCustomChannelChannelAdapter.ts');
    });

    it('should handle single word names', () => {
      const result = scaffoldChannel(tempDir, { name: 'telegram' });
      expect(result.files).toContain('TelegramChannelAdapter.ts');
    });
  });
});
