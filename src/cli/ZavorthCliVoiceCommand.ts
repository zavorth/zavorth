import type { ZavorthCliFlags, ZavorthCliRuntime, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';
import { formatCliEventCard, formatCliSuccessEventCard } from './ZavorthCliEventCards.js';
import { LocalVoiceTTS } from '../voice/LocalVoiceTTS.js';
import { LocalVoiceDictation } from '../voice/LocalVoiceDictation.js';
import { VoiceConsentService } from '../voice/VoiceConsentService.js';
import { VoiceStatusService } from '../voice/VoiceStatusService.js';
import { VoiceWakeRuntimeService } from '../services/VoiceWakeRuntimeService.js';
import path from 'node:path';
import fs from 'node:fs';
import { asErrorLike } from '../utils/errorLike';

type VoiceCommandParams = {
  runtime: ZavorthCliRuntime;
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  args: string;
  writer: CliWriter;
};

/**
 * `zavorth voice` CLI command family.
 *
 * Subcommands:
 *   status  — pipeline status (consent, device, recording state)
 *   listen  — continuous mic → Whisper → agent runtime
 *   speak   — text-to-speech output
 *   arm     — arm wake word detector
 *   disarm  — disarm wake word
 *   consent — show/accept voice privacy consent
 *   doctor  — check prerequisites (Whisper binary, model, mic, TTS)
 */
export async function handleZavorthCliVoiceCommand(
  params: VoiceCommandParams,
): Promise<CliExecutionResult | null> {
  const { commandName, args, writer } = params;

  if (commandName !== 'voice') {
    return null;
  }

  const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  const subcommand = String(tokens[0] || '').trim().toLowerCase() || 'status';
  const subArgs = tokens.slice(1).join(' ').trim();

  switch (subcommand) {
    case 'status':
      return voiceStatus(writer);
    case 'speak':
      return voiceSpeak(subArgs, writer);
    case 'listen':
      return voiceListen(writer);
    case 'arm':
      return voiceArm(subArgs, writer);
    case 'disarm':
      return voiceDisarm(writer);
    case 'consent':
      return voiceConsent(subArgs, writer);
    case 'doctor':
      return voiceDoctor(writer);
    default:
      return voiceHelp(writer);
  }
}

async function voiceStatus(writer: CliWriter): Promise<CliExecutionResult> {
  const tts = new LocalVoiceTTS();
  const statusService = new VoiceStatusService();
  const pipeline = statusService.getStatus();

  const lines = [
    formatCliEventCard({ title: '🎙️ Voice Pipeline Status', tone: 'info' }),
    '',
    `  Phase:        ${pipeline.phase}`,
    `  Consented:    ${pipeline.consented ? '✅ Yes' : '❌ No'}`,
    `  Device Ready: ${pipeline.hasDevice ? '✅ Yes' : '❌ No'}`,
    `  Recording:    ${pipeline.isRecording ? '🔴 Active' : '⚪ Inactive'}`,
    `  TTS:          ${tts.isAvailable() ? `✅ Available (${tts.getToolName()})` : '❌ Not available'}`,
    `  Last Error:   ${pipeline.lastError || 'None'}`,
    `  Updated:      ${pipeline.updatedAt}`,
    '',
  ];
  writer.line(lines.join('\n'));
  return { ok: true, handled: true, output: lines, error: null };
}

async function voiceSpeak(text: string, writer: CliWriter): Promise<CliExecutionResult> {
  if (!text) {
    writer.line('Usage: zavorth voice speak <text>');
    return { ok: false, handled: true, output: ['Missing text.'], error: 'No text provided.' };
  }

  const tts = new LocalVoiceTTS();
  if (!tts.isAvailable()) {
    const msg = 'No TTS tool available. Run `zavorth voice doctor` for details.';
    writer.line(formatCliEventCard({ title: msg, tone: 'danger' }));
    return { ok: false, handled: true, output: [msg], error: msg };
  }

  writer.line(`🔊 Speaking: "${text.length > 80 ? text.slice(0, 77) + '...' : text}"`);
  try {
    await tts.speak(text);
    writer.line(formatCliSuccessEventCard({ title: 'Speech completed.' }));
    return { ok: true, handled: true, output: ['Done.'], error: null };
  } catch (error: unknown) {
    const err = asErrorLike(error);
    const msg = `TTS error: ${err?.message || String(err)}`;
    writer.line(formatCliEventCard({ title: msg, tone: 'danger' }));
    return { ok: false, handled: true, output: [msg], error: msg };
  }
}

async function voiceListen(writer: CliWriter): Promise<CliExecutionResult> {
  const dictation = new LocalVoiceDictation();
  const micCmd = process.env.ZAVORTH_VOICE_MIC_COMMAND;

  if (!micCmd) {
    const msg = 'Continuous listening requires ZAVORTH_VOICE_MIC_COMMAND to be configured.\nRun `zavorth voice doctor` for setup instructions.';
    writer.line(formatCliEventCard({ title: msg, tone: 'warning' }));
    return { ok: false, handled: true, output: [msg], error: msg };
  }

  writer.line(formatCliEventCard({ title: '🎙️ Listening... Press Ctrl+C to stop.', tone: 'info' }));

  try {
    await dictation.startContinuousMicrophoneRecord((transcript) => {
      writer.line(`📝 ${transcript}`);
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    const msg = `Listen error: ${err?.message || String(err)}`;
    writer.line(formatCliEventCard({ title: msg, tone: 'danger' }));
    return { ok: false, handled: true, output: [msg], error: msg };
  }

  return { ok: true, handled: true, output: ['Listening session ended.'], error: null };
}

async function voiceArm(subArgs: string, writer: CliWriter): Promise<CliExecutionResult> {
  const ttlMatch = subArgs.match(/--ttl\s+(\d+)/);
  const ttlMs = ttlMatch ? parseInt(ttlMatch[1], 10) * 1000 : undefined;

  const stateFile = path.join(process.cwd(), 'data', 'runtime', 'voice-wake-state.json');
  const svc = new VoiceWakeRuntimeService({ stateFile });
  const session = svc.arm(ttlMs);

  writer.line(formatCliSuccessEventCard({ title: `Wake word armed until ${session.armedUntil}.` }));
  return { ok: true, handled: true, output: [`Armed until ${session.armedUntil}`], error: null };
}

async function voiceDisarm(writer: CliWriter): Promise<CliExecutionResult> {
  const stateFile = path.join(process.cwd(), 'data', 'runtime', 'voice-wake-state.json');
  const svc = new VoiceWakeRuntimeService({ stateFile });
  svc.disarm('Disarmed via CLI.');

  writer.line(formatCliSuccessEventCard({ title: 'Wake word disarmed.' }));
  return { ok: true, handled: true, output: ['Disarmed.'], error: null };
}

async function voiceConsent(subArgs: string, writer: CliWriter): Promise<CliExecutionResult> {
  const consentService = new VoiceConsentService();
  const userId = 'cli-operator';

  if (subArgs === 'accept') {
    consentService.accept({ userId });
    writer.line(formatCliSuccessEventCard({ title: 'Voice privacy consent accepted. You can now use voice features.' }));
    return { ok: true, handled: true, output: ['Consent accepted.'], error: null };
  }

  if (subArgs === 'revoke') {
    try {
      consentService.revoke(userId);
      writer.line(formatCliEventCard({ title: 'Voice consent revoked. Voice capture is disabled.', tone: 'warning' }));
    } catch {
      writer.line('No active consent to revoke.');
    }
    return { ok: true, handled: true, output: ['Consent revoked.'], error: null };
  }

  const record = consentService.getStatus(userId);
  const lines = [
    formatCliEventCard({ title: '🔒 Voice Privacy Consent', tone: 'info' }),
    '',
    `  Status:   ${record.status}`,
    `  Scope:    ${record.scope}`,
    `  Version:  ${record.version}`,
    '',
    '  Privacy guarantees:',
    '    • All processing is local (Whisper.cpp)',
    '    • No raw audio is persisted',
    '    • Only transcription receipts are stored',
    '    • Microphone indicator required when active',
    '    • Auto-disarm after TTL expires',
    '',
    '  To accept: zavorth voice consent accept',
    '  To revoke: zavorth voice consent revoke',
    '',
  ];
  writer.line(lines.join('\n'));
  return { ok: true, handled: true, output: lines, error: null };
}

async function voiceDoctor(writer: CliWriter): Promise<CliExecutionResult> {
  const tts = new LocalVoiceTTS();
  const whisperBinary = process.env.ZAVORTH_WHISPER_BINARY || null;
  const whisperModel = process.env.ZAVORTH_WHISPER_MODEL_PATH || path.join(process.cwd(), 'models', 'whisper', 'ggml-tiny.bin');
  const micCommand = process.env.ZAVORTH_VOICE_MIC_COMMAND || null;

  const checks = [
    {
      label: 'TTS Output',
      ok: tts.isAvailable(),
      detail: tts.isAvailable() ? `Available via ${tts.getToolName()}` : 'No TTS tool found. macOS: say, Windows: System.Speech, Linux: espeak',
    },
    {
      label: 'Whisper Binary',
      ok: whisperBinary ? fs.existsSync(whisperBinary) : false,
      detail: whisperBinary
        ? fs.existsSync(whisperBinary)
          ? `Found: ${whisperBinary}`
          : `Not found: ${whisperBinary}`
        : 'Set ZAVORTH_WHISPER_BINARY to your whisper.cpp binary path',
    },
    {
      label: 'Whisper Model',
      ok: fs.existsSync(whisperModel),
      detail: fs.existsSync(whisperModel)
        ? `Found: ${whisperModel}`
        : `Not found: ${whisperModel} — download from https://huggingface.co/ggerganov/whisper.cpp`,
    },
    {
      label: 'Microphone Command',
      ok: !!micCommand,
      detail: micCommand
        ? `Configured: ${micCommand}`
        : 'Set ZAVORTH_VOICE_MIC_COMMAND for continuous listening',
    },
  ];

  const lines = [
    formatCliEventCard({ title: '🩺 Voice Doctor', tone: 'info' }),
    '',
  ];

  let allOk = true;
  for (const check of checks) {
    const icon = check.ok ? '✅' : '❌';
    lines.push(`  ${icon} ${check.label}`);
    lines.push(`     ${check.detail}`);
    lines.push('');
    if (!check.ok) allOk = false;
  }

  if (allOk) {
    lines.push(formatCliSuccessEventCard({ title: 'All voice prerequisites satisfied.' }));
  } else {
    lines.push(formatCliEventCard({ title: 'Some voice features are not available. See details above.', tone: 'warning' }));
  }

  writer.line(lines.join('\n'));
  return { ok: allOk, handled: true, output: lines, error: allOk ? null : 'Some checks failed.' };
}

async function voiceHelp(writer: CliWriter): Promise<CliExecutionResult> {
  const lines = [
    formatCliEventCard({ title: '🎙️ Zavorth Voice', tone: 'info' }),
    '',
    '  Usage: zavorth voice <subcommand>',
    '',
    '  Subcommands:',
    '    status   — Pipeline status (consent, device, recording state)',
    '    speak    — Speak text aloud via OS-native TTS',
    '    listen   — Continuous microphone → Whisper transcription',
    '    arm      — Arm wake word detector (--ttl <seconds>)',
    '    disarm   — Disarm wake word detector',
    '    consent  — Voice privacy consent (accept | revoke)',
    '    doctor   — Check voice prerequisites',
    '',
    '  Environment variables:',
    '    ZAVORTH_WHISPER_BINARY       Path to whisper.cpp binary',
    '    ZAVORTH_WHISPER_MODEL_PATH   Path to Whisper GGML model file',
    '    ZAVORTH_VOICE_MIC_COMMAND    External mic/transcription worker',
    '',
  ];
  writer.line(lines.join('\n'));
  return { ok: true, handled: true, output: lines, error: null };
}
