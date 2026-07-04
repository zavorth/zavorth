import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import { LocalVoiceDictation } from '../../src/voice/LocalVoiceDictation';
import { VoiceConsentService } from '../../src/voice/VoiceConsentService';
import { VoiceProvisioningService } from '../../src/voice/VoiceProvisioningService';
import { VoiceStatusService } from '../../src/voice/VoiceStatusService';

function createFakeChild() {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdout.setEncoding = jest.fn();
  child.stderr.setEncoding = jest.fn();
  child.kill = jest.fn(() => {
    child.emit('close', 0);
  });
  return child;
}

function createInMemoryConsentStorage() {
  const store = new Map<string, import('../../src/voice/VoiceConsentService').ConsentRecord>();
  return {
    load: (userId: string) => store.get(userId) || null,
    save: (record: import('../../src/voice/VoiceConsentService').ConsentRecord) => {
      store.set(record.userId, record);
    },
  };
}

function createInMemoryDeviceStorage() {
  const store = new Map<string, import('../../src/voice/VoiceProvisioningService').VoiceDevice>();
  return {
    list: () => Array.from(store.values()),
    save: (device: import('../../src/voice/VoiceProvisioningService').VoiceDevice) => {
      store.set(device.id, device);
    },
    remove: (deviceId: string) => {
      store.delete(deviceId);
    },
  };
}

describe('Voice Pipeline E2E', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('full pipeline: consent -> provision -> transcribe', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-voice-e2e-'));
    tempDirs.push(root);

    const binaryPath = path.join(root, 'whisper-cli.exe');
    const modelPath = path.join(root, 'ggml-tiny.bin');
    fs.writeFileSync(binaryPath, 'binary', 'utf8');
    fs.writeFileSync(modelPath, 'model', 'utf8');

    const consentService = new VoiceConsentService(createInMemoryConsentStorage());
    const provisioningService = new VoiceProvisioningService(createInMemoryDeviceStorage());
    const statusService = new VoiceStatusService();

    expect(consentService.isConsented('user-1')).toBe(false);
    expect(provisioningService.hasProvisionedDevice()).toBe(false);
    expect(statusService.getStatus().phase).toBe('idle');

    consentService.accept({ userId: 'user-1' });
    expect(consentService.isConsented('user-1')).toBe(true);
    statusService.setConsented(true);

    const device = provisioningService.provision({
      deviceName: 'test-mic',
      platform: 'local',
      modelPath,
      binaryPath,
    });
    expect(provisioningService.hasProvisionedDevice()).toBe(true);
    statusService.setHasDevice(true);

    const spawn = jest.fn((command: string, args: string[]) => {
      const child = createFakeChild();
      process.nextTick(() => {
        const outputBase = String(args[args.indexOf('-of') + 1] || '').trim();
        fs.writeFileSync(`${outputBase}.txt`, 'hello zavorth\n', 'utf8');
        child.emit('close', 0);
      });
      return child;
    }) as any;

    const dictation = new LocalVoiceDictation(
      { modelPath, binaryPath, tempDir: root },
      { spawn },
    );

    statusService.setRecording(true);
    const transcript = await dictation.transcribeBuffer(Buffer.from('RIFF....DATA'));
    statusService.setRecording(false);

    expect(transcript).toBe('hello zavorth');
    expect(statusService.getStatus().phase).toBe('idle');
    expect(statusService.getStatus().consented).toBe(true);
    expect(statusService.getStatus().hasDevice).toBe(true);

    provisioningService.deactivate(device.id);
    expect(provisioningService.hasProvisionedDevice()).toBe(false);
  });

  it('blocks transcription without consent', async () => {
    const consentService = new VoiceConsentService(createInMemoryConsentStorage());
    expect(() => consentService.ensureConsented('user-1')).toThrow(/consent required/i);
  });

  it('blocks transcription without provisioned device', async () => {
    const provisioningService = new VoiceProvisioningService(createInMemoryDeviceStorage());
    expect(() => provisioningService.ensureProvisioned()).toThrow(/no provisioned voice device/i);
  });

  it('status service tracks phase transitions', () => {
    const statusService = new VoiceStatusService();
    const phases: string[] = [];
    statusService.subscribe((s) => phases.push(s.phase));

    statusService.setConsented(true);
    statusService.setHasDevice(true);
    statusService.setRecording(true);
    statusService.setRecording(false);
    statusService.setError('test error');
    statusService.setError(null);

    expect(phases).toEqual([
      'device-provisioning',
      'idle',
      'recording',
      'idle',
      'error',
      'idle',
    ]);
  });

  it('consent can be revoked', () => {
    const consentService = new VoiceConsentService(createInMemoryConsentStorage());
    consentService.accept({ userId: 'user-1' });
    expect(consentService.isConsented('user-1')).toBe(true);

    consentService.revoke('user-1');
    expect(consentService.isConsented('user-1')).toBe(false);
    expect(consentService.getStatus('user-1').status).toBe('revoked');
  });

  it('device provisioning lifecycle', () => {
    const provisioningService = new VoiceProvisioningService(createInMemoryDeviceStorage());
    expect(provisioningService.hasProvisionedDevice()).toBe(false);

    const device = provisioningService.provision({
      deviceName: 'mic-1',
      platform: 'local',
    });
    expect(provisioningService.hasProvisionedDevice()).toBe(true);
    expect(device.status).toBe('provisioned');
    expect(device.capabilities).toContain('transcription');

    const deactivated = provisioningService.deactivate(device.id);
    expect(deactivated.status).toBe('deactivated');
    expect(provisioningService.hasProvisionedDevice()).toBe(false);
  });
});
