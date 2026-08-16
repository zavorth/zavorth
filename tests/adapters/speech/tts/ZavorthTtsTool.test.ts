import path from 'path';
import os from 'os';
import fs from 'fs';
import { ZavorthTtsTool } from '../../../../src/tools/ZavorthTtsTool';
import { TtsBackendRegistry } from '../../../../src/adapters/speech/tts/TtsBackendRegistry';
import type { ISpeechSynthesisAdapter, TtsSynthesizeOutput } from '../../../../src/adapters/speech/tts/SpeechSynthesisContract';

const AUDIO = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);

function fakeAdapter(providerId: string, available = true): ISpeechSynthesisAdapter {
  return {
    providerId,
    transport: 'http',
    modelId: null,
    defaultVoiceId: providerId === 'azure' ? 'en-US-GuyNeural' : null,
    isAvailable: () => available,
    listVoices: () => [
      { id: 'en-US-GuyNeural', name: 'Guy', language: 'en-US', gender: 'male' },
    ],
    async synthesize(input): Promise<TtsSynthesizeOutput> {
      return {
        audio: AUDIO,
        format: 'wav',
        contentType: 'audio/wav',
        providerEvidence: {
          providerId: input.voiceId ? `${providerId}:${input.voiceId}` : providerId,
          modelId: null,
          metadata: { transport: 'http' },
        },
      };
    },
  };
}

type FakePolicyInput = { ttsReplyDesired: boolean };
type FakePolicyResult = { ok: boolean; reason?: string; provider?: 'edge-tts' | 'gemini' | 'local'; voiceId?: string | null };

function toolWithPolicy(
  policy: (_input: FakePolicyInput) => FakePolicyResult,
  registry?: TtsBackendRegistry,
): ZavorthTtsTool {
  const reg = registry || (() => {
    const r = new TtsBackendRegistry();
    r.registerAdapter(fakeAdapter('local'));
    r.registerAdapter(fakeAdapter('azure'));
    return r;
  })();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-tts-test-'));
  return new ZavorthTtsTool({ storageDir: dir, registry: reg, voicePolicy: policy });
}

describe('ZavorthTtsTool (registry-based)', () => {
  it('still registers as zavorth_tts', () => {
    const tool = toolWithPolicy(() => ({ ok: true, provider: 'local' }));
    expect(tool.name).toBe('zavorth_tts');
  });

  it('speaks with an explicit backend bypassing the voice policy', async () => {
    const tool = toolWithPolicy(() => ({ ok: false, reason: 'tts_not_configured' }));
    const result = await tool.execute({ action: 'speak', backend: 'local', text: 'hello', voice_id: 'default' });
    expect(result).toContain('Audio generated successfully');
    expect(result).toContain('Backend: local');
    const fileMatch = result.match(/File: (.+)/);
    expect(fileMatch).not.toBeNull();
    expect(fs.existsSync(fileMatch![1])).toBe(true);
    fs.rmSync(fileMatch![1], { force: true });
  });

  it('refuses the default path when the voice policy rejects', async () => {
    const tool = toolWithPolicy(() => ({ ok: false, reason: 'tts_not_configured' }));
    const result = await tool.execute({ action: 'speak', text: 'hello' });
    expect(result).toContain('voice policy');
  });

  it('uses the policy-mapped backend when the policy approves', async () => {
    const tool = toolWithPolicy(() => ({ ok: true, provider: 'azure', voiceId: 'en-US-GuyNeural' }));
    const result = await tool.execute({ action: 'speak', text: 'oi' });
    expect(result).toContain('Backend: azure');
  });

  it('falls back to the default backend when the policy provider is unavailable', async () => {
    const registry = new TtsBackendRegistry();
    registry.registerAdapter(fakeAdapter('local'));
    const tool = toolWithPolicy(
      () => ({ ok: true, provider: 'edge-tts', voiceId: null }),
      registry,
    );
    const result = await tool.execute({ action: 'speak', text: 'x' });
    expect(result).toContain('Backend: local');
  });

  it('lists voices from the adapter', async () => {
    const tool = toolWithPolicy(() => ({ ok: true, provider: 'azure' }));
    const result = await tool.execute({ action: 'list_voices', backend: 'azure' });
    expect(result).toContain('en-US-GuyNeural');
  });

  it('lists backends from the registry', async () => {
    const tool = toolWithPolicy(() => ({ ok: true, provider: 'local' }));
    const result = await tool.execute({ action: 'list_backends' });
    expect(result).toContain('local');
    expect(result).toContain('azure');
  });

  it('rejects an unknown backend with a helpful error', async () => {
    const tool = toolWithPolicy(() => ({ ok: true, provider: 'local' }));
    const result = await tool.execute({ action: 'speak', backend: 'carrier-pigeon', text: 'hi' });
    expect(result).toContain('not supported');
  });

  it('set_default accepts legacy aliases', async () => {
    const tool = toolWithPolicy(() => ({ ok: true, provider: 'local' }));
    const result = await tool.execute({ action: 'set_default', backend: 'windows' });
    expect(result).toContain('local');
  });
});
