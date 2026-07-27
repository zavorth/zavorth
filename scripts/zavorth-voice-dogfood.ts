#!/usr/bin/env npx tsx
/**
 * Practical live dogfood for Zavorth voice.
 *
 * Always:
 *   - offline smoke (spawn scripts/zavorth-voice-smoke.ts)
 *   - local media plane probe
 *
 * When API base is set (ZAVORTH_EXPERIENCE_BASE_URL / --base) OR --live:
 *   - GET preference, metrics, media-plane
 *   - POST duplex start (agentReplyOverride) → listen → end
 *   - POST voice/test stt + tts (dry-run probes)
 *
 * Paid STT (AudioTranscriptionService) only with --confirm-live-stt
 * when keys are present — never call paid APIs without that flag.
 *
 * Usage:
 *   npx tsx scripts/zavorth-voice-dogfood.ts
 *   npx tsx scripts/zavorth-voice-dogfood.ts --live
 *   npx tsx scripts/zavorth-voice-dogfood.ts --live --base http://127.0.0.1:8787
 *   npx tsx scripts/zavorth-voice-dogfood.ts --live --confirm-live-stt
 *
 * Auth (optional):
 *   ZAVORTH_MANAGEMENT_TOKEN / ZAVORTH_API_TOKEN / ZAVORTH_CONTROL_TOKEN
 *
 * Exit codes:
 *   0 — offline OK; soft auth / probe issues OK
 *   1 — offline smoke failed, or unexpected hard error
 *   2 — --live / base set and connection hard-failed (ECONNREFUSED, etc.)
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeVoiceMediaPlane } from '../src/services/voice/VoiceMediaPlane.js';
import { pcmInt16ToWav } from '../src/services/voice/VoicePcmWav.js';
import { AudioTranscriptionService } from '../src/services/AudioTranscriptionService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function readFlag(name: string): string | null {
  const i = process.argv.indexOf(name);
  if (i < 0) return null;
  return process.argv[i + 1] != null ? String(process.argv[i + 1]) : null;
}

function envTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  return v.length > 0 && v !== '0' && v.toLowerCase() !== 'false';
}

/** Detect keys that could enable live STT without calling any paid API. */
function detectSttKeys(): { present: boolean; names: string[] } {
  const candidates: Array<{ name: string; value: string | undefined }> = [
    { name: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY },
    { name: 'GROQ_API_KEY', value: process.env.GROQ_API_KEY },
    { name: 'DEEPGRAM_API_KEY', value: process.env.DEEPGRAM_API_KEY },
    { name: 'GEMINI_API_KEY', value: process.env.GEMINI_API_KEY },
    { name: 'GOOGLE_API_KEY', value: process.env.GOOGLE_API_KEY },
    { name: 'ZAVORTH_AUDIO_STT_PROVIDERS', value: process.env.ZAVORTH_AUDIO_STT_PROVIDERS },
    { name: 'ZAVORTH_AUDIO_STT_MODEL', value: process.env.ZAVORTH_AUDIO_STT_MODEL },
    { name: 'ZAVORTH_WHISPER_MODEL_PATH', value: process.env.ZAVORTH_WHISPER_MODEL_PATH },
  ];
  const names = candidates.filter((c) => envTruthy(c.value)).map((c) => c.name);
  return { present: names.length > 0, names };
}

type HttpResult = { status: number; json: unknown; softAuth: boolean; hardFail: boolean; label: string };

function isAuthStatus(status: number): boolean {
  return status === 401 || status === 403;
}

function isHardFetchError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /fetch failed|ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT|network/i.test(msg);
}

async function httpGet(
  baseUrl: string,
  p: string,
  headers: Record<string, string>,
  label: string,
): Promise<HttpResult> {
  try {
    const res = await fetch(`${baseUrl}${p}`, { headers });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 400) };
    }
    return {
      status: res.status,
      json,
      softAuth: isAuthStatus(res.status),
      hardFail: false,
      label,
    };
  } catch (e) {
    return {
      status: 0,
      json: { error: e instanceof Error ? e.message : String(e) },
      softAuth: false,
      hardFail: isHardFetchError(e),
      label,
    };
  }
}

async function httpPost(
  baseUrl: string,
  p: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  label: string,
): Promise<HttpResult> {
  try {
    const res = await fetch(`${baseUrl}${p}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 400) };
    }
    return {
      status: res.status,
      json,
      softAuth: isAuthStatus(res.status),
      hardFail: false,
      label,
    };
  } catch (e) {
    return {
      status: 0,
      json: { error: e instanceof Error ? e.message : String(e) },
      softAuth: false,
      hardFail: isHardFetchError(e),
      label,
    };
  }
}

function logHttpResult(r: HttpResult, okNote?: string): 'ok' | 'soft' | 'hard' | 'fail' {
  if (r.hardFail || r.status === 0) {
    console.log(`  ✗ ${r.label}: connection failed (${JSON.stringify(r.json)})`);
    return 'hard';
  }
  if (r.softAuth) {
    console.log(`  · ${r.label}: auth ${r.status} (soft — set ZAVORTH_MANAGEMENT_TOKEN if required)`);
    return 'soft';
  }
  if (r.status >= 200 && r.status < 300) {
    console.log(`  ✓ ${r.label} (${r.status})${okNote ? ` ${okNote}` : ''}`);
    return 'ok';
  }
  if (r.status === 404) {
    console.log(`  · ${r.label}: 404 (route missing — restart experience API?)`);
    return 'soft';
  }
  if (r.status >= 500) {
    console.log(`  ✗ ${r.label}: HTTP ${r.status}`);
    return 'fail';
  }
  console.log(`  · ${r.label}: HTTP ${r.status}`);
  return 'soft';
}

/** Short sine (or silence) WAV for optional STT dogfood — ≥1KB for AudioTranscriptionService. */
function generateTinySineWav(options?: {
  sampleRate?: number;
  durationMs?: number;
  freqHz?: number;
  silence?: boolean;
}): Buffer {
  const sampleRate = options?.sampleRate ?? 16_000;
  const durationMs = options?.durationMs ?? 400;
  const freqHz = options?.freqHz ?? 440;
  const n = Math.max(1, Math.floor((sampleRate * durationMs) / 1000));
  const samples = new Int16Array(n);
  if (!options?.silence) {
    const amp = 0.15 * 32767;
    for (let i = 0; i < n; i += 1) {
      samples[i] = Math.round(amp * Math.sin((2 * Math.PI * freqHz * i) / sampleRate));
    }
  }
  return pcmInt16ToWav(samples, { sampleRate, channels: 1 });
}

async function runOptionalLiveStt(): Promise<'ok' | 'skip' | 'fail'> {
  const confirm = hasFlag('--confirm-live-stt');
  const keys = detectSttKeys();

  if (!keys.present) {
    console.log('  · no STT keys in env (OPENAI_API_KEY / GROQ / DEEPGRAM / GEMINI / ZAVORTH_AUDIO_*)');
    return 'skip';
  }

  console.log(`  STT keys detected: ${keys.names.join(', ')}`);

  if (!confirm) {
    console.log('  · live STT skipped (pass --confirm-live-stt to call paid / local STT APIs)');
    return 'skip';
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-voice-dogfood-'));
  const wavPath = path.join(tmpDir, 'sine.wav');
  try {
    const wav = generateTinySineWav({ durationMs: 500, sampleRate: 16_000 });
    // Ensure ≥ MIN_AUDIO_BYTES (1024)
    const payload = wav.length >= 1024 ? wav : Buffer.concat([wav, Buffer.alloc(1024 ? wav.length)]);
    fs.writeFileSync(wavPath, payload);

    console.log(`  · calling AudioTranscriptionService on generated sine WAV (${payload.length} bytes)`);
    const stt = new AudioTranscriptionService();
    const result = await stt.transcribe({
      audio: payload,
      mimeType: 'audio/wav',
      fileName: 'dogfood-sine.wav',
      sessionId: 'voice-dogfood',
      language: 'auto',
    });

    if (result.ok) {
      console.log(
        `  ✓ live STT ok provider=${result.provider || '...'} model=${result.model || '...'} text=${JSON.stringify((result.text || '').slice(0, 80))}`,
      );
      return 'ok';
    }

    // Soft: keys present but provider refused / silence / not configured preference
    console.log(`  · live STT soft result: ${result.error || 'no transcript'} (attempts=${result.attempts.length})`);
    for (const a of result.attempts.slice(0, 5)) {
      console.log(`      ? ${a.provider}: ${a.status}${a.reason ? ` (${a.reason})` : ''}`);
    }
    return 'ok';
  } catch (e) {
    console.log(`  ✗ live STT hard error: ${e instanceof Error ? e.message : String(e)}`);
    return 'fail';
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

async function liveHttpDogfood(
  baseUrl: string,
  token: string | null,
): Promise<{ hard: boolean; fail: boolean; softAuth: boolean }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
    headers['x-zavorth-management-token'] = token;
  }

  let hard = false;
  let fail = false;
  let softAuth = false;

  const track = (r: HttpResult, note?: string) => {
    const kind = logHttpResult(r, note);
    if (kind === 'hard') hard = true;
    if (kind === 'fail') fail = true;
    if (kind === 'soft' && r.softAuth) softAuth = true;
    return kind;
  };

  // GET preference
  track(await httpGet(baseUrl, '/api/experience/voice/preference', headers, 'GET preference'));

  // GET metrics
  track(await httpGet(baseUrl, '/api/experience/voice/metrics...limit=5', headers, 'GET metrics'));

  // GET media-plane
  const plane = await httpGet(baseUrl, '/api/experience/voice/media-plane', headers, 'GET media-plane');
  if (plane.status >= 200 && plane.status < 300) {
    const mode = (plane.json as { plane?: { mode?: string }; mode?: string })?.plane?.mode
      || (plane.json as { mode?: string })?.mode;
    track(plane, mode ? `mode=${mode}` : undefined);
  } else {
    track(plane);
  }

  // POST duplex start → listen → end
  const started = await httpPost(
    baseUrl,
    '/api/experience/voice/duplex',
    headers,
    {
      action: 'start',
      surface: 'desktop',
      agentReplyOverride: 'dogfood-ok',
      sessionId: 'voice-dogfood-session',
    },
    'POST duplex start',
  );
  const startKind = track(started);
  if (startKind === 'ok') {
    const session = (started.json as { session?: { sessionId?: string } })?.session;
    const sid = session?.sessionId;
    if (sid) {
      const listened = await httpPost(
        baseUrl,
        '/api/experience/voice/duplex',
        headers,
        {
          action: 'listen',
          sessionId: sid,
          transcript: 'dogfood hello',
        },
        'POST duplex listen',
      );
      track(listened);
      const ended = await httpPost(
        baseUrl,
        '/api/experience/voice/duplex',
        headers,
        { action: 'end', sessionId: sid },
        'POST duplex end',
      );
      track(ended);
    } else {
      console.log('  · duplex start ok but no sessionId in body');
    }
  }

  // POST voice/test stt + tts (dry-run configuration probes)
  track(
    await httpPost(
      baseUrl,
      '/api/experience/voice/test',
      headers,
      { action: 'stt' },
      'POST voice/test stt',
    ),
  );
  track(
    await httpPost(
      baseUrl,
      '/api/experience/voice/test',
      headers,
      { action: 'tts', sampleText: 'Zavorth voice dogfood' },
      'POST voice/test tts',
    ),
  );

  return { hard, fail, softAuth };
}

function printChecklist(opts: {
  base: string;
  liveRan: boolean;
  keys: { present: boolean; names: string[] };
}): void {
  console.log('\n========== DOGFOOD CHECKLIST (human Desktop) ==========');
  console.log('1. Start experience API / Desktop if not already running');
  console.log(`   base: ${opts.base}`);
  console.log('2. Settings → Voice');
  console.log('   - Choose STT provider (e.g. openai / groq) + model');
  console.log('   - Save preference');
  console.log('   - Click Test (STT + TTS probes)');
  console.log('3. Open a chat thread');
  console.log('4. Mic button = dictation into the input (speak → text)');
  console.log('5. Phone button = full duplex call');
  console.log('   - Speak; after pause, agent should reply (spoken + in thread)');
  console.log('   - Watch phase / RMS banner');
  console.log('   - End call via Phone again or banner End');
  console.log('6. Optional: Discord/Telegram voice note if those channels are configured');
  if (opts.keys.present) {
    console.log(`7. STT keys on this machine: ${opts.keys.names.join(', ')}`);
    console.log('   Paid STT from this script only with --confirm-live-stt');
  } else {
    console.log('7. No STT API keys in env — configure keys or Desktop preference before live speech');
  }
  if (!opts.liveRan) {
    console.log('8. Re-run with --live when API is up:');
    console.log('   npx tsx scripts/zavorth-voice-dogfood.ts --live');
    console.log('   npx tsx scripts/zavorth-voice-dogfood.ts --live --base http://127.0.0.1:8787');
  }
  console.log('=======================================================');
}

async function main(): Promise<number> {
  const liveFlag = hasFlag('--live');
  const baseFromFlag = readFlag('--base');
  const baseFromEnv =
    process.env.ZAVORTH_EXPERIENCE_BASE_URL ||
    process.env.ZAVORTH_API_BASE_URL ||
    null;
  const base = (baseFromFlag || baseFromEnv || 'http://127.0.0.1:8787').replace(/\/$/, '');
  // Live HTTP when --live OR explicit base via flag/env (practical dogfood when API is known)
  const wantLive = liveFlag || Boolean(baseFromFlag) || Boolean(baseFromEnv);
  const token =
    process.env.ZAVORTH_MANAGEMENT_TOKEN ||
    process.env.ZAVORTH_API_TOKEN ||
    process.env.ZAVORTH_CONTROL_TOKEN ||
    null;

  console.log('Zavorth voice dogfood\n');

  // 1) Offline core smoke
  console.log('1) Offline core smoke (zavorth-voice-smoke.ts)');
  const offline = spawnSync('npx', ['tsx', 'scripts/zavorth-voice-smoke.ts'], {
    cwd: root,
    encoding: 'utf8',
    shell: true, // Windows PowerShell / cmd: resolve npx.cmd
  });
  if (offline.status !== 0) {
    if (offline.stdout) console.error(offline.stdout);
    if (offline.stderr) console.error(offline.stderr);
    console.error('Offline smoke failed — dogfood abort.');
    return 1;
  }
  console.log('  ✓ offline smoke passed\n');

  // 2) Media plane probe (local process)
  console.log('2) Media plane probe (local)');
  const plane = await probeVoiceMediaPlane(true);
  console.log(`  mode=${plane.mode}`);
  console.log(`  ${plane.reason}`);
  if (plane.installHint) console.log(`  hint: ${plane.installHint}`);
  console.log(`  features: ${JSON.stringify(plane.features)}`);
  console.log('');

  // 3) STT key detection (+ optional paid STT)
  console.log('3) STT key detection');
  const keys = detectSttKeys();
  const sttOutcome = await runOptionalLiveStt();
  console.log('');

  // 4) Live HTTP against experience API
  let liveRan = false;
  let hardLive = false;
  let softAuth = false;

  if (!wantLive) {
    console.log('4) Live HTTP skipped');
    console.log(`   Pass --live or set ZAVORTH_EXPERIENCE_BASE_URL / --base`);
    console.log(`   Would use base=${base}`);
    console.log('');
  } else {
    console.log(`4) Live HTTP against ${base}`);
    if (!token) {
      console.log('  · no management token in env (auth may soft-fail)');
    }
    const result = await liveHttpDogfood(base, token);
    hardLive = result.hard;
    softAuth = result.softAuth;
    liveRan = true;
    console.log('');
  }

  printChecklist({ base, liveRan, keys });

  if (sttOutcome === 'fail') {
    console.error('\nDOGFOOD: live STT hard failure (exit 1).');
    return 1;
  }

  if (hardLive) {
    console.error('\nDOGFOOD: hard connection failure against live API (exit 2).');
    console.error('Start experience API or fix --base / ZAVORTH_EXPERIENCE_BASE_URL.');
    return 2;
  }

  if (softAuth) {
    console.log('\nDOGFOOD OK (soft auth — set ZAVORTH_MANAGEMENT_TOKEN if you need full live paths).');
  } else if (liveRan) {
    console.log('\nDOGFOOD OK (offline + media plane + live HTTP).');
  } else {
    console.log('\nDOGFOOD OK (offline + media plane). Use --live for HTTP paths.');
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
