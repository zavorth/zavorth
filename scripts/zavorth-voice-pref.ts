#!/usr/bin/env npx tsx
/**
 * CLI for Zavorth voice preference.
 *
 * Usage:
 *   npx tsx scripts/zavorth-voice-pref.ts get
 *   npx tsx scripts/zavorth-voice-pref.ts set --stt-provider openai --stt-model whisper-1 --language auto
 *   npx tsx scripts/zavorth-voice-pref.ts set --mode dictation --tts-enabled false
 *   npx tsx scripts/zavorth-voice-pref.ts clear
 *   npx tsx scripts/zavorth-voice-pref.ts resolve
 */

import {
  getVoicePreferenceService,
  type VoicePreferencePatch,
} from '../src/services/voice/VoicePreferenceService.js';
import type { VoiceInteractionMode } from '../src/contracts/voice/VoicePreferenceContract.js';

function readFlag(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx < 0) return null;
  return args[idx + 1] != null ? String(args[idx + 1]) : null;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const cmd = String(args[0] || 'get').toLowerCase();
  const service = getVoicePreferenceService();

  if (cmd === 'get' || cmd === 'show' || cmd === 'status') {
    console.log(service.describe());
    console.log('');
    console.log(JSON.stringify(service.get(), null, 2));
    return 0;
  }

  if (cmd === 'resolve') {
    const resolved = service.resolveStt();
    console.log(JSON.stringify(resolved, null, 2));
    return resolved.ok ? 0 : 2;
  }

  if (cmd === 'clear' || cmd === 'reset') {
    const next = service.clear();
    console.log('Voice preference cleared (STT unconfigured).');
    console.log(JSON.stringify(next, null, 2));
    return 0;
  }

  if (cmd === 'set') {
    const patch: VoicePreferencePatch = {};
    const sttProvider = readFlag(args, '--stt-provider');
    const sttModel = readFlag(args, '--stt-model');
    const language = readFlag(args, '--language') || readFlag(args, '--stt-language');
    const mode = readFlag(args, '--mode') as VoiceInteractionMode | null;
    const ttsProvider = readFlag(args, '--tts-provider');
    const ttsVoice = readFlag(args, '--tts-voice') || readFlag(args, '--voice-id');

    if (sttProvider) patch.stt = { ...(patch.stt || {}), provider: sttProvider as any };
    if (sttModel !== null) patch.stt = { ...(patch.stt || {}), model: sttModel };
    if (language) patch.stt = { ...(patch.stt || {}), language };
    if (mode) patch.mode = mode;
    if (ttsProvider) patch.tts = { ...(patch.tts || {}), provider: ttsProvider as any };
    if (hasFlag(args, '--tts-voice') || hasFlag(args, '--voice-id')) {
      patch.tts = { ...(patch.tts || {}), voiceId: ttsVoice };
    }
    if (hasFlag(args, '--tts-enabled')) {
      const v = readFlag(args, '--tts-enabled');
      patch.tts = {
        ...(patch.tts || {}),
        enabled: v === '1' || v === 'true' || v === 'yes',
      };
    }
    if (hasFlag(args, '--tts-disabled')) {
      patch.tts = { ...(patch.tts || {}), enabled: false, provider: 'none' };
    }
    // Conversation implies TTS enablement if a provider is set
    if (mode === 'conversation' && patch.tts?.enabled === undefined && (ttsProvider || ttsVoice)) {
      patch.tts = { ...(patch.tts || {}), enabled: true };
    }

    if (!patch.stt && !patch.tts && !patch.mode) {
      console.error(
        [
          'Nothing to set. Examples:',
          '  # Dictation only (text agent, no speak):',
          '  npx tsx scripts/zavorth-voice-pref.ts set --stt-provider openai --stt-model whisper-1 --mode dictation',
          '  # Conversation (agent may reply with voice you choose):',
          '  npx tsx scripts/zavorth-voice-pref.ts set --stt-provider openai --mode conversation --tts-enabled true --tts-provider edge-tts --tts-voice en-US-JennyNeural',
        ].join('\n'),
      );
      return 1;
    }

    const next = service.set(patch);
    console.log('Voice preference saved.');
    console.log(service.describe());
    console.log('');
    console.log(JSON.stringify(next, null, 2));
    return 0;
  }

  console.error(`Unknown command: ${cmd}`);
  console.error('Commands: get | set | clear | resolve');
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
