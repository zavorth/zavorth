import { spawn, spawnSync } from 'child_process';
import { LocalVoiceTTS } from '../../src/voice/LocalVoiceTTS';

describe('LocalVoiceTTS', () => {
  describe('isAvailable', () => {
    it('returns true on macOS', () => {
      const tts = new LocalVoiceTTS({ platform: 'darwin' });
      expect(tts.isAvailable()).toBe(true);
    });

    it('returns true on Windows', () => {
      const tts = new LocalVoiceTTS({ platform: 'win32' });
      expect(tts.isAvailable()).toBe(true);
    });

    it('checks for espeak/spd-say on Linux', () => {
      const mockSpawnSync = jest.fn().mockReturnValue({ status: 0, stdout: '/usr/bin/espeak' });
      const tts = new LocalVoiceTTS({ platform: 'linux', spawnSync: mockSpawnSync as unknown as typeof spawnSync });
      expect(tts.isAvailable()).toBe(true);
      expect(mockSpawnSync).toHaveBeenCalledWith('which', ['espeak'], expect.any(Object));
    });

    it('returns false on unknown platform', () => {
      const tts = new LocalVoiceTTS({ platform: 'freebsd' });
      expect(tts.isAvailable()).toBe(false);
    });
  });

  describe('getToolName', () => {
    it('returns say for macOS', () => {
      const tts = new LocalVoiceTTS({ platform: 'darwin' });
      expect(tts.getToolName()).toBe('say');
    });

    it('returns powershell for Windows', () => {
      const tts = new LocalVoiceTTS({ platform: 'win32' });
      expect(tts.getToolName()).toBe('powershell');
    });

    it('returns null for unsupported platform', () => {
      const tts = new LocalVoiceTTS({ platform: 'sunos' });
      expect(tts.getToolName()).toBeNull();
    });
  });

  describe('speak', () => {
    it('resolves immediately for empty text', async () => {
      const tts = new LocalVoiceTTS({ platform: 'darwin' });
      await expect(tts.speak('')).resolves.toBeUndefined();
    });

    it('spawns say on macOS with correct args', async () => {
      const mockChild = {
        once: jest.fn((event, cb) => {
          if (event === 'close') setTimeout(() => cb(0), 0);
        }),
      };
      const mockSpawn = jest.fn().mockReturnValue(mockChild);
      const tts = new LocalVoiceTTS({ platform: 'darwin', spawn: mockSpawn as unknown as typeof spawn });

      await tts.speak('Hello world');

      expect(mockSpawn).toHaveBeenCalledWith(
        'say',
        ['Hello world'],
        expect.objectContaining({ stdio: 'ignore', windowsHide: true }),
      );
    });

    it('spawns powershell on Windows', async () => {
      const mockChild = {
        once: jest.fn((event, cb) => {
          if (event === 'close') setTimeout(() => cb(0), 0);
        }),
      };
      const mockSpawn = jest.fn().mockReturnValue(mockChild);
      const tts = new LocalVoiceTTS({ platform: 'win32', spawn: mockSpawn as unknown as typeof spawn });

      await tts.speak('Hello');

      expect(mockSpawn).toHaveBeenCalled();
      const [cmd] = mockSpawn.mock.calls[0];
      expect(cmd).toBe('powershell');
    });

    it('rejects on unsupported platform', async () => {
      const tts = new LocalVoiceTTS({ platform: 'freebsd' });
      await expect(tts.speak('Hello')).rejects.toThrow('No TTS tool available');
    });

    it('passes voice and rate options on macOS', async () => {
      const mockChild = {
        once: jest.fn((event, cb) => {
          if (event === 'close') setTimeout(() => cb(0), 0);
        }),
      };
      const mockSpawn = jest.fn().mockReturnValue(mockChild);
      const tts = new LocalVoiceTTS({ platform: 'darwin', spawn: mockSpawn as unknown as typeof spawn });

      await tts.speak('Test', { voice: 'Samantha', rate: 200 });

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--voice');
      expect(args).toContain('Samantha');
      expect(args).toContain('--rate');
    });
  });

  describe('getAvailableVoices', () => {
    it('returns empty array on unsupported platform', () => {
      const tts = new LocalVoiceTTS({ platform: 'freebsd' });
      expect(tts.getAvailableVoices()).toEqual([]);
    });

    it('parses macOS say --voice output', () => {
      const mockSpawnSync = jest.fn().mockReturnValue({
        stdout: 'Samantha   en_US  # American English\nDaniel     en_GB  # British English\n',
        status: 0,
      });
      const tts = new LocalVoiceTTS({ platform: 'darwin', spawnSync: mockSpawnSync as unknown as typeof spawnSync });
      const voices = tts.getAvailableVoices();
      expect(voices).toContain('Samantha');
      expect(voices).toContain('Daniel');
    });
  });
});
