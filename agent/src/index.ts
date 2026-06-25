import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { t, initI18n, setLanguage, setTranslatorCallback } from './i18n.js';
import { ConfigService } from './ConfigService.js';
import { HotkeyService } from './HotkeyService.js';
import { MicGateService } from './MicGateService.js';
import { AgentVoiceFlowService } from './AgentVoiceFlowService.js';
import { GatewayCloudTtsService } from './GatewayCloudTtsService.js';
import { HybridTtsService } from './HybridTtsService.js';
import { EchoClientService } from './EchoClientService.js';
import type {
  EchoAgentPhysicalEvent,
  EchoAgentSurfaceState,
} from './EchoClientService.js';
import { OverlayService } from './OverlayService.js';
import { SystrayService } from './SystrayService.js';
import { TtsService } from './TtsService.js';
import { VoiceRecorderService } from './VoiceRecorderService.js';
import { WakeWordService } from './WakeWordService.js';
import { WhisperService } from './WhisperService.js';
import { ChimeService } from './ChimeService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DASHBOARD_URL = process.env.ZAVORTH_DASHBOARD_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.ZAVORTH_BACKEND_URL || 'http://localhost:3000';
const AGENT_API_NAMESPACE = parseAgentApiNamespace(process.env.ZAVORTH_AGENT_API_NAMESPACE);
const AGENT_SESSION_ID = process.env.ZAVORTH_AGENT_SESSION_ID;
const AGENT_SURFACE = process.env.ZAVORTH_AGENT_SURFACE || 'agent';
const AGENT_REQUESTED_BY = process.env.ZAVORTH_AGENT_REQUESTED_BY || 'zavorth-agent';
const WAKE_WORD = process.env.ZAVORTH_AGENT_WAKE_WORD || 'zavorth';
const HOTKEY = process.env.ZAVORTH_AGENT_HOTKEY || 'B';
const VOICE_LANGUAGE = process.env.ZAVORTH_AGENT_LANGUAGE || 'pt';
const TTS_VOICE = process.env.ZAVORTH_AGENT_TTS_VOICE || process.env.TTS_VOICE || 'en-US-GuyNeural';
const CLOUD_TTS_ENABLED = parseBooleanEnv(process.env.ZAVORTH_AGENT_CLOUD_TTS_ENABLED);
const CLOUD_TTS_BASE_URL = process.env.ZAVORTH_AGENT_CLOUD_TTS_BASE_URL
  || process.env.ZAVORTH_AI_GATEWAY_URL
  || BACKEND_URL;
const CLOUD_TTS_MODEL = process.env.ZAVORTH_AGENT_CLOUD_TTS_MODEL || 'gemini-3.1-flash-tts-preview';
const CLOUD_TTS_VOICE = process.env.ZAVORTH_AGENT_CLOUD_TTS_VOICE || 'Kore';
const CLOUD_TTS_RESPONSE_FORMAT = process.env.ZAVORTH_AGENT_CLOUD_TTS_RESPONSE_FORMAT || 'wav';
const CLOUD_TTS_TIMEOUT_MS = parseNumberEnv(process.env.ZAVORTH_AGENT_CLOUD_TTS_TIMEOUT_MS, 15000);
const CLOUD_TTS_API_KEY = process.env.ZAVORTH_AGENT_CLOUD_TTS_API_KEY || process.env.ZAVORTH_API_KEY || '';
const CHIMES_ENABLED = process.env.ZAVORTH_CHIMES === undefined || parseBooleanEnv(process.env.ZAVORTH_CHIMES);

async function main() {
  console.log('\nZavorth Agent v1.0');
  console.log(`Wake word: ${WAKE_WORD} | Hotkey: Win+${HOTKEY} | Mic gate: enabled\n`);

  const config = new ConfigService();
  initI18n(config.lang);

  const micGate = new MicGateService(1000);
  const wakeWord = new WakeWordService({ wakeWord: WAKE_WORD, threshold: 0.7 });
  const hotkey = new HotkeyService({ hotkey: HOTKEY });
  const recorder = new VoiceRecorderService({ maxDurationMs: 8000 });
  const whisper = new WhisperService({ language: config.lang === 'auto' ? VOICE_LANGUAGE : config.lang });
  const localTts = new TtsService({ voice: TTS_VOICE });
  const chime = new ChimeService({ enabled: config.chimesEnabled });
  const cloudTts = new GatewayCloudTtsService({
    enabled: CLOUD_TTS_ENABLED,
    baseUrl: CLOUD_TTS_BASE_URL,
    model: CLOUD_TTS_MODEL,
    voice: CLOUD_TTS_VOICE,
    responseFormat: CLOUD_TTS_RESPONSE_FORMAT,
    surface: AGENT_SURFACE,
    requestedBy: AGENT_REQUESTED_BY,
    sessionId: AGENT_SESSION_ID || undefined,
    apiKey: CLOUD_TTS_API_KEY,
    timeoutMs: CLOUD_TTS_TIMEOUT_MS,
  });
  const tts = new HybridTtsService({
    localTts,
    cloudTts,
  });
  const echoClient = new EchoClientService({
    baseUrl: BACKEND_URL,
    sessionId: AGENT_SESSION_ID,
    surface: AGENT_SURFACE,
    requestedBy: AGENT_REQUESTED_BY,
    apiNamespace: AGENT_API_NAMESPACE,
  });

  // Register remote LLM translator callback
  setTranslatorCallback(async (key, englishText, targetLang) => {
    const prompt = `Translate the following English phrase or word into target language "${targetLang}".
Provide ONLY the translation, with no explanation, formatting, or quotes.
Phrase: "${englishText}"`;
    const result = await echoClient.processIntent(prompt);
    if (result.success && result.response) {
      return result.response.replace(/^["']|["']$/g, '').trim();
    }
    throw new Error(result.response || 'LLM call failed');
  });
  const agentSurfaceContext = echoClient.getSurfaceContext();
  const overlay = new OverlayService();
  const systray = new SystrayService();

  let isProcessing = false;
  let ttsAvailable = false;
  let latestSurfaceState: EchoAgentSurfaceState | null = null;
  let lastAnnouncedPhysicalEventId: string | null = null;

  console.log(`[Agent] API ${echoClient.getApiNamespace()} | surface ${agentSurfaceContext.surface} | requestedBy ${agentSurfaceContext.requestedBy} | session ${agentSurfaceContext.sessionId}`);
  console.log('[Setup] Checking dependencies...');
  const whisperStatus = await whisper.isAvailable();
  console.log(`[Whisper] ${whisperStatus.available ? 'ok' : 'missing'} ${whisperStatus.method}`);

  const ttsStatus = await tts.isAvailable();
  ttsAvailable = ttsStatus.available;
  console.log(`[TTS] ${ttsStatus.available ? 'ok' : 'missing'} ${ttsStatus.method}`);
  if (CLOUD_TTS_ENABLED) {
    console.log(`[TTS] Cloud fallback active via ${CLOUD_TTS_MODEL} @ ${CLOUD_TTS_BASE_URL}`);
  }

  const updateConnectionStatus = async () => {
    const conn = await echoClient.checkConnection();
    const surfaceState = conn.backendOnline ? await echoClient.readSurfaceState(3) : null;
    if (surfaceState) {
      await announcePhysicalEvent(surfaceState.recentPhysicalEvents[0] || null);
    }
    latestSurfaceState = surfaceState;
    systray.updateState({
      backendOnline: conn.backendOnline,
      mode: isProcessing ? 'processing' : conn.backendOnline ? 'idle' : 'offline',
      detail: buildTrayDetail(conn, surfaceState),
      pendingApprovals: surfaceState?.summary.pendingApprovals || 0,
      lastRunId: surfaceState?.summary.lastRunId || null,
      lastStatus: surfaceState?.summary.lastStatus || null,
      configLang: config.lang,
    });
    return conn;
  };

  const announcePhysicalEvent = async (event: EchoAgentPhysicalEvent | null): Promise<void> => {
    if (!event || event.id === lastAnnouncedPhysicalEventId) {
      return;
    }
    lastAnnouncedPhysicalEventId = event.id;
    await overlay.showStatus(
      `Zavorth IoT (${event.severity.toUpperCase()})`,
      event.feedback,
    );
    if (ttsAvailable && (event.severity === 'warn' || event.severity === 'critical')) {
      try {
        const ttsAudioPath = await tts.speak(event.feedback);
        tts.cleanup(ttsAudioPath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[Agent] TTS IoT unavailable: ${message}`);
      }
    }
  };

  const initialConnection = await updateConnectionStatus();
  if (!initialConnection.backendOnline) {
    console.log(t('backend_offline'));
  }

  const voiceFlow = new AgentVoiceFlowService({
    recorder,
    whisper,
    echoClient,
    overlay,
    tts,
    chime,
    isTtsAvailable: () => ttsAvailable,
    onProcessingChange: (processing) => {
      isProcessing = processing;
    },
    onModeChange: (patch) => {
      systray.updateState(patch);
    },
    onEchoResult: (result) => {
      if (result.runId || result.traceId) {
        console.log(`[Agent] Echo run ${result.runId || '-'} | trace ${result.traceId || '-'} | status ${result.executionStatus || 'unknown'}`);
      }
    },
    onSurfaceState: (surfaceState) => {
      latestSurfaceState = surfaceState;
      systray.updateState({
        pendingApprovals: surfaceState.summary.pendingApprovals,
        lastRunId: surfaceState.summary.lastRunId,
        lastStatus: surfaceState.summary.lastStatus,
      });
    },
    onSettled: async () => {
      await updateConnectionStatus();
    },
  });

  async function handleActivation(mode: string): Promise<void> {
    const result = await voiceFlow.runActivation(mode);
    if (result.status === 'busy') {
      console.log(t('busy'));
      return;
    }
    if (result.status === 'empty-transcript') {
      console.log(t('no_speech'));
    }
    if (result.status === 'failed') {
      console.error(t('error_pipeline', { error: result.error || '' }));
    }
  }

  wakeWord.on('activated', (mode: string) => {
    void handleActivation(mode);
  });

  hotkey.on('activated', (mode: string) => {
    void handleActivation(mode);
  });

  wakeWord.on('unavailable', () => {
    console.log(t('wakeword_unavailable'));
  });

  micGate.on('mic:on', () => {
    console.log('[Agent] Microphone active. Enabling wake word and hotkey.');
    systray.updateState({ micActive: true });
    wakeWord.start();
    void hotkey.enable();
  });

  micGate.on('mic:off', () => {
    console.log(t('mic_off'));
    systray.updateState({ micActive: false, mode: 'idle' });
    wakeWord.stop();
    hotkey.disable();
  });

  systray.on('exit', () => shutdown());

  systray.on('change-lang', (newLang: string) => {
    console.log(`[Agent] Changing language to: ${newLang}`);
    config.lang = newLang;
    setLanguage(newLang);
    systray.updateState({ configLang: newLang });
    whisper.setLanguage(newLang === 'auto' ? VOICE_LANGUAGE : newLang);
    void updateConnectionStatus();
  });

  // Listen to configuration file updates (e.g. from backend API / dashboard settings)
  config.onChange((newConfig) => {
    console.log(`[Agent] Configuration file updated externally. Reloading lang=${newConfig.lang} chimes=${newConfig.chimesEnabled}`);
    setLanguage(newConfig.lang);
    systray.updateState({ configLang: newConfig.lang });
    whisper.setLanguage(newConfig.lang === 'auto' ? VOICE_LANGUAGE : newConfig.lang);
    chime.setEnabled(newConfig.chimesEnabled);
    void updateConnectionStatus();
  });

  systray.on('toggle-mic', () => {
    if (micGate.active) {
      micGate.stop();
      systray.updateState({ micActive: false });
      wakeWord.stop();
      hotkey.disable();
    } else {
      micGate.start();
    }
  });

  systray.on('status', async () => {
    const conn = await updateConnectionStatus();
    const state = latestSurfaceState;
    await overlay.showStatus(
      t('status_title'),
      t('status_format', {
        backend: conn.backendOnline ? 'online' : 'offline',
        ollama: conn.ollamaOnline ? conn.model : 'offline',
        mic: micGate.active ? t('mic_active') : t('mic_disabled'),
        approvals: state?.summary.pendingApprovals || 0,
        runId: shortId(state?.summary.lastRunId),
      }),
    );
    if (state) {
      await overlay.showEchoSurfaceState(state);
    }
  });

  systray.on('open-dashboard', () => {
    const command = process.platform === 'win32'
      ? `start "" "${DASHBOARD_URL}"`
      : process.platform === 'darwin'
        ? `open "${DASHBOARD_URL}"`
        : `xdg-open "${DASHBOARD_URL}"`;
    exec(command);
  });

  const connectionTimer = setInterval(() => {
    void updateConnectionStatus();
  }, 10000);

  console.log('[Agent] Starting monitoring...');
  await systray.start();
  micGate.start();

  const shutdown = () => {
    console.log('\n[Agent] Shutting down Zavorth Agent...');
    clearInterval(connectionTimer);
    micGate.stop();
    wakeWord.stop();
    hotkey.disable();
    systray.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('[Agent] Active. Press Ctrl+C to exit.');
}

function buildTrayDetail(
  conn: { ollamaOnline: boolean; model: string; latencyMs: number },
  state: EchoAgentSurfaceState | null,
): string {
  const model = conn.ollamaOnline ? `Ollama ${conn.model} ${conn.latencyMs}ms` : 'Ollama offline';
  if (!state) {
    return model;
  }
  return `${model} | approvals ${state.summary.pendingApprovals} | run ${shortId(state.summary.lastRunId)} | iot ${state.summary.physicalSignals}`;
}

function shortId(value: string | null | undefined): string {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '-';
  }
  return normalized.length <= 12 ? normalized : `${normalized.slice(0, 8)}...`;
}

function parseBooleanEnv(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function parseAgentApiNamespace(value: string | undefined): 'echo' | 'nexus' {
  return String(value || '').trim().toLowerCase() === 'nexus' ? 'nexus' : 'echo';
}

function parseNumberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

main().catch((error) => {
  console.error(`\n[FATAL] ${error.message}\n`);
  process.exit(1);
});
