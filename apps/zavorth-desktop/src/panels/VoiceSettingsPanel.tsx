import { useCallback, useEffect, useState } from 'react';

function useStore<T>(store: { get(): T; subscribe(cb: (val: T) => void): () => void }): T {
  const [val, setVal] = useState(() => store.get());
  useEffect(() => store.subscribe(setVal), [store]);
  return val;
}
import {
  loadVoiceMediaPlane,
  loadVoiceMetrics,
  loadVoicePreference,
  playVoiceAudioBase64,
  saveVoicePreference,
  synthesizeVoiceTts,
  testVoiceConfig,
  type DesktopVoiceMediaPlane,
  type DesktopVoiceMetricsSnapshot,
  type DesktopVoicePreference,
} from '../apiClient';
import { errorMessage } from '../lib/errors';
import { useDuplexCall } from '../voice/useDuplexCall';
import { VoiceCallStatusBanner } from '../voice/VoiceCallStatusBanner';
import { $sessionId, setMessages } from '../store/session';
import { $runtimeCapabilities } from '../store/workspace';

const STT_PROVIDERS = [
  { id: 'none', label: 'None (disabled — type instead)' },
  { id: 'openai', label: 'OpenAI Whisper' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'groq', label: 'Groq Whisper' },
  { id: 'deepgram', label: 'Deepgram' },
  { id: 'whisper.cpp', label: 'local whisper.cpp' },
];

const TTS_PROVIDERS = [
  { id: 'none', label: 'None' },
  { id: 'edge-tts', label: 'Edge TTS (local)' },
  { id: 'gemini', label: 'Gemini TTS' },
];

const MODES = [
  { id: 'off', label: 'Off' },
  { id: 'dictation', label: 'Dictation (hear → same agent as typing)' },
  { id: 'conversation', label: 'Conversation (dictation + optional spoken reply)' },
];

function speakInBrowser(text: string, language: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return false;
  }
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = language && language !== 'auto' ? language : navigator.language || 'en-US';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
  return true;
}

/**
 * Desktop voice sovereignty UI — STT/TTS only from user choice.
 */
export function VoiceSettingsPanel() {
  const experienceSessionId = useStore($sessionId);
  const runtimeCapabilities = useStore($runtimeCapabilities);
  const workspacePath =
    String(
      (runtimeCapabilities as { workspace?: { path?: string; id?: string } } | null)?.workspace
        ?.path ||
        (runtimeCapabilities as { workspace?: { id?: string } } | null)?.workspace?.id ||
        '',
    ).trim() || null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [describe, setDescribe] = useState('');
  const [metrics, setMetrics] = useState<DesktopVoiceMetricsSnapshot | null>(null);
  const [mediaPlane, setMediaPlane] = useState<DesktopVoiceMediaPlane | null>(null);
  const [duplexLog, setDuplexLog] = useState<string>('');
  const [probeLog, setProbeLog] = useState<string>('');

  const [mode, setMode] = useState('off');
  const [sttProvider, setSttProvider] = useState('none');
  const [sttModel, setSttModel] = useState('');
  const [sttLanguage, setSttLanguage] = useState('auto');
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsProvider, setTtsProvider] = useState('none');
  const [ttsVoiceId, setTtsVoiceId] = useState('');

  const injectChat = useCallback((turn: { userText: string; agentText: string }) => {
    const now = new Date().toISOString();
    setMessages((current) => [
      ...current,
      {
        id: `voice-user-${Date.now()}`,
        role: 'user',
        content: turn.userText,
        at: now,
        title: 'Voice',
      },
      {
        id: `voice-agent-${Date.now() + 1}`,
        role: 'assistant',
        content: turn.agentText,
        at: now,
        title: 'Voice',
      },
    ]);
  }, []);

  const duplex = useDuplexCall({
    language: sttLanguage,
    experienceSessionId,
    workspace: workspacePath,
    injectChat,
    onNotice: (message) => setError(message),
    onLog: (raw) => setDuplexLog(raw),
  });

  const applyPreference = useCallback((pref: DesktopVoicePreference | undefined) => {
    if (!pref) return;
    setMode(String(pref.mode || 'off'));
    setSttProvider(String(pref.stt?.provider || 'none'));
    setSttModel(String(pref.stt?.model || ''));
    setSttLanguage(String(pref.stt?.language || 'auto'));
    setTtsEnabled(Boolean(pref.tts?.enabled));
    setTtsProvider(String(pref.tts?.provider || 'none'));
    setTtsVoiceId(String(pref.tts?.voiceId || ''));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prefRes, metricsRes, planeRes] = await Promise.all([
        loadVoicePreference(),
        loadVoiceMetrics(20).catch(() => null),
        loadVoiceMediaPlane().catch(() => null),
      ]);
      applyPreference(prefRes.preference);
      setDescribe(String(prefRes.describe || ''));
      setMetrics(metricsRes);
      setMediaPlane(planeRes);
      if (prefRes.resolve && prefRes.resolve.ok === false) {
        setStatus(String(prefRes.resolve.message || 'STT not configured'));
      } else if (prefRes.resolve?.ok) {
        setStatus(
          `STT ready (${prefRes.resolve.source}): ${(prefRes.resolve.providers || []).join(', ')}`,
        );
      } else {
        setStatus(null);
      }
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [applyPreference]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await saveVoicePreference({
        mode,
        stt: {
          provider: sttProvider,
          model: sttModel.trim() || null,
          language: sttLanguage.trim() || 'auto',
        },
        tts: {
          enabled: ttsEnabled,
          provider: ttsProvider,
          voiceId: ttsVoiceId.trim() || null,
        },
      });
      applyPreference(res.preference);
      setDescribe(String(res.describe || ''));
      setStatus('Saved.');
      await refresh();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveVoicePreference({ clear: true });
      await refresh();
      setStatus('Cleared — STT disabled until you choose a provider.');
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const runProbe = async (action: 'stt' | 'tts' | 'all') => {
    setTesting(true);
    setError(null);
    try {
      // Persist current form first so probe reflects what user selected
      await saveVoicePreference({
        mode,
        stt: {
          provider: sttProvider,
          model: sttModel.trim() || null,
          language: sttLanguage.trim() || 'auto',
        },
        tts: {
          enabled: ttsEnabled,
          provider: ttsProvider,
          voiceId: ttsVoiceId.trim() || null,
        },
      });
      const res = await testVoiceConfig({
        action,
        sampleText: 'Zavorth voice test. Configuration looks good.',
      });
      setProbeLog(JSON.stringify(res.result || res, null, 2));
      const sttOk = action === 'stt' ? res.result?.ok : res.result?.stt?.ok;
      const ttsOk = action === 'tts' ? res.result?.ok : res.result?.tts?.ok;
      if (action === 'stt') {
        setStatus(String(res.result?.message || (sttOk ? 'STT ok' : 'STT failed')));
      } else if (action === 'tts') {
        setStatus(String(res.result?.message || (ttsOk ? 'TTS ok' : 'TTS failed')));
        // Prefer backend edge-tts/gemini; fall back to browser speechSynthesis
        try {
          const synth = await synthesizeVoiceTts({
            text: res.result?.sampleText || 'Zavorth voice test.',
            language: sttLanguage,
            force: true,
            surface: 'desktop',
          });
          if (synth.result?.audioBase64 && synth.result.mimeType) {
            await playVoiceAudioBase64(synth.result.mimeType, synth.result.audioBase64);
            setStatus(`TTS ok via backend (${synth.result.provider || 'tts'})`);
          } else if (res.result?.ok && res.result.sampleText) {
            speakInBrowser(res.result.sampleText, sttLanguage);
          }
        } catch {
          if (res.result?.ok && res.result.sampleText) {
            speakInBrowser(res.result.sampleText, sttLanguage);
          }
        }
      } else {
        setStatus(
          `Probe: STT ${res.result?.stt?.ok ? 'ok' : 'fail'} · TTS ${res.result?.tts?.ok ? 'ok' : 'fail'}`,
        );
        if (res.result?.tts?.ok) {
          try {
            const synth = await synthesizeVoiceTts({
              text: res.result.tts.sampleText || 'Zavorth voice test.',
              language: sttLanguage,
              force: true,
              surface: 'desktop',
            });
            if (synth.result?.audioBase64 && synth.result.mimeType) {
              await playVoiceAudioBase64(synth.result.mimeType, synth.result.audioBase64);
            } else if (res.result.tts.sampleText) {
              speakInBrowser(res.result.tts.sampleText, sttLanguage);
            }
          } catch {
            if (res.result.tts.sampleText) {
              speakInBrowser(res.result.tts.sampleText, sttLanguage);
            }
          }
        }
      }
      await loadVoiceMetrics(20)
        .then(setMetrics)
        .catch(() => null);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="zvd-settings-card">Loading voice settings…</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="zvd-settings-card">
        <div className="zvd-settings-card-title">Voice (you choose)</div>
        <p className="zvd-settings-card-desc">
          No automatic cascade of STT models. Pick provider/model yourself. Dictation uses the same agent
          as typing; conversation may speak replies only if TTS is enabled below.
        </p>
        {status ? <p className="text-xs text-gray-500 mt-2">{status}</p> : null}
        {error ? <p className="text-xs text-red-500 mt-2">{error}</p> : null}
      </div>

      <div className="zvd-settings-form-group">
        <label>Mode</label>
        <select className="zvd-settings-select" value={mode} onChange={(e) => setMode(e.target.value)}>
          {MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="zvd-settings-card">
        <div className="zvd-settings-card-title">Speech-to-text (hear you)</div>
        <div className="zvd-settings-form-group">
          <label>STT provider</label>
          <select
            className="zvd-settings-select"
            value={sttProvider}
            onChange={(e) => setSttProvider(e.target.value)}
          >
            {STT_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="zvd-settings-form-group">
          <label>STT model (optional — provider default if empty)</label>
          <input
            className="zvd-settings-select"
            value={sttModel}
            onChange={(e) => setSttModel(e.target.value)}
            placeholder="e.g. whisper-1"
          />
        </div>
        <div className="zvd-settings-form-group">
          <label>Language</label>
          <input
            className="zvd-settings-select"
            value={sttLanguage}
            onChange={(e) => setSttLanguage(e.target.value)}
            placeholder="auto | pt | en | es"
          />
        </div>
      </div>

      <div className="zvd-settings-card">
        <div className="zvd-settings-card-title">Text-to-speech (agent speaks)</div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ttsEnabled}
            onChange={(e) => setTtsEnabled(e.target.checked)}
          />
          Enable TTS replies (conversation mode)
        </label>
        <div className="zvd-settings-form-group mt-3">
          <label>TTS provider</label>
          <select
            className="zvd-settings-select"
            value={ttsProvider}
            onChange={(e) => setTtsProvider(e.target.value)}
          >
            {TTS_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="zvd-settings-form-group">
          <label>Voice id</label>
          <input
            className="zvd-settings-select"
            value={ttsVoiceId}
            onChange={(e) => setTtsVoiceId(e.target.value)}
            placeholder="e.g. en-US-JennyNeural or Kore"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="zvd-settings-select" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save voice settings'}
        </button>
        <button type="button" className="zvd-settings-select" disabled={saving} onClick={() => void clear()}>
          Clear (disable STT)
        </button>
        <button type="button" className="zvd-settings-select" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <div className="zvd-settings-card">
        <div className="zvd-settings-card-title">Test configuration</div>
        <p className="zvd-settings-card-desc">
          Dry-run: validates STT resolve + TTS policy. TTS sample plays in the browser when ready.
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            type="button"
            className="zvd-settings-select"
            disabled={testing}
            onClick={() => void runProbe('stt')}
          >
            Test STT
          </button>
          <button
            type="button"
            className="zvd-settings-select"
            disabled={testing}
            onClick={() => void runProbe('tts')}
          >
            Test TTS
          </button>
          <button
            type="button"
            className="zvd-settings-select"
            disabled={testing}
            onClick={() => void runProbe('all')}
          >
            {testing ? 'Testing…' : 'Test all'}
          </button>
        </div>
        {probeLog ? (
          <pre className="text-xs bg-black/20 p-2 rounded mt-2 max-h-32 overflow-auto">{probeLog}</pre>
        ) : null}
      </div>

      {describe ? (
        <pre className="text-xs bg-black/20 p-3 rounded overflow-auto max-h-40 whitespace-pre-wrap">
          {describe}
        </pre>
      ) : null}

      <div className="zvd-settings-card">
        <div className="zvd-settings-card-title">Media plane</div>
        {mediaPlane ? (
          <ul className="text-xs space-y-1">
            <li>
              Mode: <strong>{mediaPlane.mode || '—'}</strong>
            </li>
            <li>{mediaPlane.reason}</li>
            {mediaPlane.installHint ? (
              <li className="text-gray-500">{mediaPlane.installHint}</li>
            ) : null}
          </ul>
        ) : (
          <p className="text-xs text-gray-500">Media plane info unavailable.</p>
        )}
      </div>

      <div className="zvd-settings-card">
        <div className="zvd-settings-card-title">Metrics</div>
        {metrics ? (
          <ul className="text-xs space-y-1">
            <li>
              STT: {metrics.stt?.ok ?? 0} ok / {metrics.stt?.fail ?? 0} fail · avg{' '}
              {metrics.stt?.avgLatencyMs ?? '—'} ms
            </li>
            <li>
              TTS: {metrics.tts?.ok ?? 0} ok / {metrics.tts?.fail ?? 0} fail · avg{' '}
              {metrics.tts?.avgLatencyMs ?? '—'} ms
            </li>
            <li>
              Dictation: {metrics.dictation?.ok ?? 0} ok / {metrics.dictation?.fail ?? 0} fail
            </li>
            <li>
              Duplex: {metrics.duplex?.sessions ?? 0} sessions / {metrics.duplex?.turns ?? 0} turns
            </li>
          </ul>
        ) : (
          <p className="text-xs text-gray-500">Metrics unavailable.</p>
        )}
      </div>

      <div className="zvd-settings-card">
        <div className="zvd-settings-card-title">Realtime duplex (VAD + WebRTC + agent)</div>
        <p className="zvd-settings-card-desc">
          Bound to Desktop thread session. MediaRecorder + browser VAD → server utterance assembly →
          Experience agent → backend TTS. RTCPeerConnection offer/auto-answer/ICE runs in parallel.
          Turns are injected into the chat transcript.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Thread: <code>{experienceSessionId || 'desktop-main'}</code>
          {workspacePath ? (
            <>
              {' '}
              · workspace: <code>{workspacePath}</code>
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            type="button"
            className="zvd-settings-select"
            disabled={duplex.active || duplex.busy}
            onClick={() => void duplex.start()}
          >
            Start call session
          </button>
          <button
            type="button"
            className="zvd-settings-select"
            disabled={!duplex.active}
            onClick={() => {
              const transcript = window.prompt('Manual listen turn (if mic unavailable):');
              if (transcript) void duplex.manualTurn(transcript);
            }}
          >
            Manual turn
          </button>
          <button
            type="button"
            className="zvd-settings-select"
            disabled={!duplex.active}
            onClick={() => void duplex.end()}
          >
            End
          </button>
        </div>
        {duplex.active ? (
          <div className="mt-3">
            <VoiceCallStatusBanner
              active={duplex.active}
              phase={duplex.phase}
              webrtcState={duplex.webrtcState}
              mediaMode={duplex.mediaMode}
              mediaPlane={duplex.mediaPlane}
              busy={duplex.busy}
              lastError={duplex.lastError}
              rms={duplex.rms}
              interim={duplex.interim}
              titleLabel="Voice call"
              endLabel="End"
              onEnd={() => void duplex.end()}
            />
            <p className="text-xs mt-2 text-gray-500">
              Session {duplex.sessionId?.slice(0, 8)}…
              {duplex.signalId ? ` · webrtc ${duplex.signalId.slice(0, 8)}…` : ''}
              {duplex.statusLabel ? ` · ${duplex.statusLabel}` : ''}
            </p>
          </div>
        ) : null}
        {duplexLog ? (
          <pre className="text-xs bg-black/20 p-2 rounded mt-2 max-h-32 overflow-auto">{duplexLog}</pre>
        ) : null}
      </div>
    </div>
  );
}
