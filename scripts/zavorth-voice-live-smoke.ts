#!/usr/bin/env npx tsx
/**
 * Live-oriented voice smoke.
 *
 * Default: offline core checks (same as zavorth-voice-smoke) + media plane probe.
 * With --live: hits experience HTTP endpoints when ZAVORTH_EXPERIENCE_BASE_URL is set.
 *
 * Usage:
 *   npx tsx scripts/zavorth-voice-live-smoke.ts
 *   npx tsx scripts/zavorth-voice-live-smoke.ts --live
 *   npx tsx scripts/zavorth-voice-live-smoke.ts --live --base http://127.0.0.1:8787
 *
 * Auth (optional):
 *   ZAVORTH_MANAGEMENT_TOKEN / ZAVORTH_API_TOKEN
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeVoiceMediaPlane } from '../src/services/voice/VoiceMediaPlane.js';
import { normalizeVoiceLanguage } from '../src/services/voice/VoiceLanguage.js';
import {
  getVoiceWebRtcSignalingService,
  resetVoiceWebRtcSignalingForTests,
} from '../src/services/voice/VoiceWebRtcSignaling.js';

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

async function liveHttpSmoke(baseUrl: string, token: string | null): Promise<string[]> {
  const failures: string[] = [];
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
    headers['x-zavorth-management-token'] = token;
  }

  const get = async (p: string) => {
    const res = await fetch(`${baseUrl}${p}`, { headers });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json };
  };

  const post = async (p: string, body: Record<string, unknown>) => {
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
      json = { raw: text };
    }
    return { status: res.status, json };
  };

  // Preference GET
  try {
    const pref = await get('/api/experience/voice/preference');
    if (pref.status === 401 || pref.status === 403) {
      failures.push(`preference auth ${pref.status} (set ZAVORTH_MANAGEMENT_TOKEN if required)`);
    } else if (pref.status >= 500) {
      failures.push(`preference HTTP ${pref.status}`);
    } else {
      console.log(`  ✓ live GET preference (${pref.status})`);
    }
  } catch (e) {
    failures.push(`preference fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Media plane
  try {
    const plane = await get('/api/experience/voice/media-plane');
    if (plane.status >= 200 && plane.status < 300) {
      console.log(`  ✓ live GET media-plane (${plane.status})`);
    } else if (plane.status === 401 || plane.status === 403) {
      console.log(`  · media-plane auth ${plane.status} (skipped body)`);
    } else if (plane.status === 404) {
      console.log('  · media-plane route 404 (server may need restart to pick new route)');
    } else {
      failures.push(`media-plane HTTP ${plane.status}`);
    }
  } catch (e) {
    failures.push(`media-plane fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Metrics
  try {
    const metrics = await get('/api/experience/voice/metrics...limit=5');
    if (metrics.status >= 200 && metrics.status < 300) {
      console.log(`  ✓ live GET metrics (${metrics.status})`);
    } else if (metrics.status === 401 || metrics.status === 403) {
      console.log(`  · metrics auth ${metrics.status}`);
    } else {
      failures.push(`metrics HTTP ${metrics.status}`);
    }
  } catch (e) {
    failures.push(`metrics fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Duplex start with override (no real LLM)
  try {
    const started = await post('/api/experience/voice/duplex', {
      action: 'start',
      surface: 'desktop',
      agentReplyOverride: 'live-smoke-ok',
      sessionId: 'live-smoke-session',
    });
    if (started.status === 401 || started.status === 403) {
      console.log(`  · duplex start auth ${started.status}`);
    } else if (started.status >= 200 && started.status < 300) {
      const session = (started.json as { session?: { sessionId?: string } })?.session;
      const sid = session?.sessionId;
      console.log(`  ✓ live duplex start (${sid || 'ok'})`);
      if (sid) {
        const listened = await post('/api/experience/voice/duplex', {
          action: 'listen',
          sessionId: sid,
          transcript: 'live smoke hello',
        });
        if (listened.status >= 200 && listened.status < 300) {
          console.log('  ✓ live duplex listen override');
        } else {
          failures.push(`duplex listen HTTP ${listened.status}`);
        }
        await post('/api/experience/voice/duplex', { action: 'end', sessionId: sid });
        console.log('  ✓ live duplex end');
      }
    } else {
      failures.push(`duplex start HTTP ${started.status}`);
    }
  } catch (e) {
    failures.push(`duplex live failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return failures;
}

async function main(): Promise<number> {
  const live = hasFlag('--live');
  const base =
    readFlag('--base') ||
    process.env.ZAVORTH_EXPERIENCE_BASE_URL ||
    process.env.ZAVORTH_API_BASE_URL ||
    'http://127.0.0.1:8787';
  const token =
    process.env.ZAVORTH_MANAGEMENT_TOKEN ||
    process.env.ZAVORTH_API_TOKEN ||
    process.env.ZAVORTH_CONTROL_TOKEN ||
    null;

  console.log('Zavorth voice live smoke\n');

  // 1) Offline core smoke
  console.log('1) Offline core smoke');
  const offline = spawnSync('npx', ['tsx', 'scripts/zavorth-voice-smoke.ts'], {
    cwd: root,
    encoding: 'utf8',
    shell: true,
  });
  if (offline.status !== 0) {
    console.error(offline.stdout);
    console.error(offline.stderr);
    console.error('Offline smoke failed.');
    return 1;
  }
  console.log('  ✓ offline smoke passed\n');

  // 2) Media plane probe (local process)
  console.log('2) Media plane probe');
  const plane = await probeVoiceMediaPlane(true);
  console.log(`  mode=${plane.mode}`);
  console.log(`  ${plane.reason}`);
  if (plane.installHint) console.log(`  hint: ${plane.installHint}`);
  console.log(`  features: ${JSON.stringify(plane.features)}`);
  console.log('');

  // 3) local WebRTC auto-answer quick check
  console.log('3) local signaling');
  resetVoiceWebRtcSignalingForTests();
  const rtc = getVoiceWebRtcSignalingService();
  const sig = rtc.create({ surface: 'live-smoke' });
  const offer = [
    'v=0',
    'o=- 0 0 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'm=audio 9 UDP/TLS/RTP/SAVPF 111',
    'a=sendrecv',
    'a=rtpmap:111 opus/48000/2',
  ].join('\r\n');
  rtc.setOffer(sig.signalId, offer);
  const answered = rtc.autoAnswer(sig.signalId);
  if (!answered.answerSdp?.includes('recvonly')) {
    console.error('  ✗ auto-answer missing recvonly');
    return 1;
  }
  console.log('  ✓ webrtc auto-answer');
  console.log(`  language sample: ${normalizeVoiceLanguage('pt-BR').whisper}`);
  console.log('');

  if (!live) {
    console.log('Live HTTP skipped (pass --live to hit experience API).');
    console.log(`Would use base=${base}`);
    console.log('\nLIVE-SMOKE OK (offline + media plane).');
    return 0;
  }

  console.log(`4) Live HTTP against ${base}`);
  const failures = await liveHttpSmoke(base.replace(/\/$/, ''), token);
  if (failures.length) {
    console.error('\nLIVE HTTP issues:');
    for (const f of failures) console.error(` - ${f}`);
    console.error(
      '\nTip: start experience API, set ZAVORTH_EXPERIENCE_BASE_URL and token if required.',
    );
    // Non-zero only if connection totally failed; auth-only issues are soft
    const hard = failures.some((f) => /fetch failed|ECONNREFUSED|ENOTFOUND/i.test(f));
    return hard ? 2 : 0;
  }

  console.log('\nLIVE-SMOKE OK (offline + media plane + live HTTP).');
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
