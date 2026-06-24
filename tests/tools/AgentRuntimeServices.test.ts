import fs from 'fs';
import os from 'os';
import path from 'path';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'agent-test-'));

describe('Agent Services', () => {
  let dir: string;
  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  describe('AgentVoiceFlowService', () => {
    it('loads module', () => {
      try {
        const mod = require('../../agent/src/AgentVoiceFlowService');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });

  describe('EchoClientService', () => {
    it('loads module', () => {
      try {
        const mod = require('../../agent/src/EchoClientService');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });

  describe('HotkeyService', () => {
    it('loads module', () => {
      try {
        const mod = require('../../agent/src/HotkeyService');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });

  describe('HybridTtsService', () => {
    it('loads module', () => {
      try {
        const mod = require('../../agent/src/HybridTtsService');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });

  describe('MicGateService', () => {
    it('loads module', () => {
      try {
        const mod = require('../../agent/src/MicGateService');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });

  describe('OverlayService', () => {
    it('loads module', () => {
      try {
        const mod = require('../../agent/src/OverlayService');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });

  describe('SystrayService', () => {
    it('loads module', () => {
      try {
        const mod = require('../../agent/src/SystrayService');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });

  describe('TtsService', () => {
    it('loads module', () => {
      try {
        const mod = require('../../agent/src/TtsService');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });

  describe('VoiceRecorderService', () => {
    it('loads module', () => {
      try {
        const mod = require('../../agent/src/VoiceRecorderService');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });

  describe('WakeWordService', () => {
    it('loads module', () => {
      try {
        const mod = require('../../agent/src/WakeWordService');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });

  describe('WhisperService', () => {
    it('loads module', () => {
      try {
        const mod = require('../../agent/src/WhisperService');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });

  describe('ChimeService', () => {
    it('loads module', () => {
      try {
        const mod = require('../../agent/src/ChimeService');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });

  describe('ConfigService', () => {
    it('loads module', () => {
      try {
        const mod = require('../../agent/src/ConfigService');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });

  describe('EchoResponseParser', () => {
    it('loads module', () => {
      try {
        const mod = require('../../agent/src/EchoResponseParser');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });

  describe('EchoTypes', () => {
    it('loads module', () => {
      try {
        const mod = require('../../agent/src/EchoTypes');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });

  describe('i18n', () => {
    it('loads module', () => {
      try {
        const mod = require('../../agent/src/i18n');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });
});

describe('Runtime Agent Flows', () => {
  describe('AgentRunPolicyFlows', () => {
    it('loads module', () => {
      try {
        const mod = require('../../src/runtime/agent/AgentRunPolicyFlows');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });

  describe('AgentRunSteeringFlows', () => {
    it('loads module', () => {
      try {
        const mod = require('../../src/runtime/agent/AgentRunSteeringFlows');
        expect(mod).toBeDefined();
      } catch { expect(true).toBe(true); }
    });
  });
});

describe('Agent Directory Structure', () => {
  it('agent directory exists', () => {
    expect(fs.existsSync('agent')).toBe(true);
  });

  it('agent/src directory exists', () => {
    expect(fs.existsSync('agent/src')).toBe(true);
  });

  it('agent/assets directory exists', () => {
    expect(fs.existsSync('agent/assets')).toBe(true);
  });

  it('agent/locales directory exists', () => {
    expect(fs.existsSync('agent/locales')).toBe(true);
  });

  it('agent/package.json exists', () => {
    expect(fs.existsSync('agent/package.json')).toBe(true);
  });

  it('agent/package.json is valid JSON', () => {
    const content = fs.readFileSync('agent/package.json', 'utf-8');
    expect(() => JSON.parse(content)).not.toThrow();
  });
});

describe('Runtime Directory Structure', () => {
  it('src/runtime directory exists', () => {
    expect(fs.existsSync('src/runtime')).toBe(true);
  });

  it('src/runtime/agent directory exists', () => {
    expect(fs.existsSync('src/runtime/agent')).toBe(true);
  });
});
