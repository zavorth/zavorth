import { SecurityEngine } from '../../src/tool-runtime/security/SecurityEngine';
import { SystemOpenAppTool } from '../../src/tool-runtime/tools/os/SystemOpenAppTool';
import { HomeAssistantBridge } from '../../src/tool-runtime/tools/iot/HomeAssistantBridge';
import { MQTTPublisher } from '../../src/tool-runtime/tools/iot/MQTTPublisher';
import { PlaywrightActionTool } from '../../src/tool-runtime/tools/browser/PlaywrightActionTool';

describe('SecurityEngine', () => {
  it('blocks destructive intent before tool execution', () => {
    expect(() => {
      SecurityEngine.authorizeExecution('por favor rode rm -rf /', new SystemOpenAppTool(), {
        appName: 'notepad.exe',
      });
    }).toThrow(/SanitizationBlock/);
  });

  it('blocks non-whitelisted local apps and unsafe args', () => {
    expect(() => {
      SecurityEngine.authorizeExecution('abrir app', new SystemOpenAppTool(), {
        appName: 'malware.exe',
      });
    }).toThrow(/whitelist/);

    expect(() => {
      SecurityEngine.authorizeExecution('abrir navegador', new SystemOpenAppTool(), {
        appName: 'chrome.exe',
        args: ['https://example.com/"bad"'],
      });
    }).toThrow(/argumento inseguro/);
  });

  it('blocks shells and terminal launchers even if requested as apps', async () => {
    for (const appName of ['powershell.exe', 'cmd.exe', 'wt.exe', 'terminal', 'pwsh']) {
      expect(() => {
        SecurityEngine.authorizeExecution('abrir terminal', new SystemOpenAppTool(), {
          appName,
        });
      }).toThrow(/blocked|bloqueado|whitelist|allowlist/i);

      const result = await new SystemOpenAppTool().execute({ appName });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/blocked|bloqueado|security policy/i);
    }
  });

  it('blocks external MQTT brokers', () => {
    expect(() => {
      SecurityEngine.authorizeExecution('publicar mqtt', new MQTTPublisher(), {
        broker: 'mqtt://broker.hivemq.com:1883',
        topic: 'casa/sala/luz',
        payload: 'ON',
      });
    }).toThrow(/localhost|private|local|nao e local/i);
  });

  it('blocks external browser targets unless explicitly allowlisted', () => {
    expect(() => {
      SecurityEngine.authorizeExecution('abrir site externo', new PlaywrightActionTool(), {
        action: 'navigate',
        url: 'https://example.com',
      });
    }).toThrow(/ZAVORTH_PLAYWRIGHT_ALLOWED_HOSTS/);
  });

  it('allows expanded smart-home domains and local hostnames', () => {
    expect(() => {
      SecurityEngine.authorizeExecution('travar porta', new HomeAssistantBridge(), {
        entity_id: 'lock.front_door',
        action: 'lock',
      });
    }).not.toThrow();

    expect(() => {
      SecurityEngine.authorizeExecution('publicar mqtt local', new MQTTPublisher(), {
        broker: 'mqtt://homeassistant.local:1883',
        topic: 'casa/sala/luz',
        payload: 'ON',
      });
    }).not.toThrow();
  });

  it('blocks external Home Assistant URLs before network calls', async () => {
    const oldUrl = process.env.HOME_ASSISTANT_URL;
    const oldToken = process.env.HOME_ASSISTANT_TOKEN;
    process.env.HOME_ASSISTANT_URL = 'https://example.com';
    process.env.HOME_ASSISTANT_TOKEN = 'test-token';
    const fetchSpy = jest.spyOn(global, 'fetch' as any);

    try {
      const result = await new HomeAssistantBridge().execute({
        entity_id: 'light.sala',
        action: 'turn_on',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/private|local|rede privada/i);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      if (oldUrl === undefined) {
        delete process.env.HOME_ASSISTANT_URL;
      } else {
        process.env.HOME_ASSISTANT_URL = oldUrl;
      }
      if (oldToken === undefined) {
        delete process.env.HOME_ASSISTANT_TOKEN;
      } else {
        process.env.HOME_ASSISTANT_TOKEN = oldToken;
      }
    }
  });

  it('blocks external MQTT brokers inside the tool too', async () => {
    const result = await new MQTTPublisher().execute({
      broker: 'mqtt://broker.hivemq.com:1883',
      topic: 'casa/sala/luz',
      payload: 'ON',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/blocked by security|bloqueado por seguranca/i);
  });
});
