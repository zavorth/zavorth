import fs from 'fs';
import path from 'path';

import {
  getChannelRows,
  getProviderRows,
} from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorthControlPageClient.utils';

const root = path.resolve(__dirname, '../../../');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('ZavorthControl provider and channel Runtime API v1 wiring', () => {
  it('prefers provider and channel rows from Runtime API v1 contracts', () => {
    const state = {
      runtimeApiV1: {
        contracts: {
          providers: {
            providers: [
              { id: 'openrouter', label: 'OpenRouter', readiness: 'ready' },
              { id: 'ollama', label: 'Ollama', readiness: 'needs_config' },
            ],
          },
          channels: {
            channels: [
              { id: 'telegram', label: 'Telegram', readiness: 'ready', actions: ['status'] },
              { id: 'whatsapp', label: 'WhatsApp', readiness: 'needs_setup', actions: ['login-qr'] },
            ],
          },
        },
      },
      agentRuntime: {
        providerCockpit: {
          providers: [{ id: 'legacy-provider', readiness: 'unknown' }],
        },
      },
    } as any;

    expect(getProviderRows(state).map((entry) => entry.id)).toEqual([
      'openrouter',
      'ollama',
      'legacy-provider',
    ]);
    expect(getChannelRows(state).map((entry) => entry.id)).toEqual([
      'telegram',
      'whatsapp',
    ]);
  });

  it('routes provider tests and channel actions through governed ZavorthControl actions', () => {
    const hook = read('src/ai-gateway/app/(zavorthControl)/control/useControlPageClient.ts');
    const main = read('src/ai-gateway/app/(zavorthControl)/control/zavorthControlPageClient.main.tsx');

    expect(hook).toContain('const handleProviderTest = async');
    expect(hook).toContain('action: "provider.test"');
    expect(hook).toContain('const handleChannelAction = async');
    expect(hook).toContain('action: "channel.action"');
    expect(hook).toContain('"/api/web/zavorthControl/actions"');
    expect(main).toContain('Provider Cockpit');
    expect(main).toContain('Channel Cockpit');
    expect(main).toContain('Test preview');
    expect(main).toContain('Readiness and tests from Runtime API v1');
  });
});
