import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentVoiceFlowService } from './AgentVoiceFlowService.js';
import { GatewayCloudTtsService } from './GatewayCloudTtsService.js';
import { HybridTtsService } from './HybridTtsService.js';
import { EchoClientService } from './EchoClientService.js';
import type {
  EchoAgentResult,
  EchoAgentSurfaceState,
} from './EchoClientService.js';

const events: string[] = [];

await smokeOnlineVoiceFlow();
await smokeCloudVoiceFallbackFlow();
await smokeConnectionFallbackFlow();

console.log(JSON.stringify({
  ok: true,
  suite: 'agent:smoke:voice',
  events: events.length,
}, null, 2));

async function smokeOnlineVoiceFlow(): Promise<void> {
  const audioPath = path.join(os.tmpdir(), `zavorth-agent-voice-${process.pid}-${Date.now()}.wav`);
  const ttsPath = path.join(os.tmpdir(), `zavorth-agent-tts-${process.pid}-${Date.now()}.mp3`);
  let cleanedAudio = false;
  let cleanedTts = false;
  let processingTransitions = 0;
  let surfaceStateRendered = false;

  const state = buildSurfaceState();
  const flow = new AgentVoiceFlowService({
    recorder: {
      record: async () => {
        events.push('online:record');
        fs.writeFileSync(audioPath, 'sample audio');
        return audioPath;
      },
      cleanup: (filePath) => {
        events.push('online:cleanup-audio');
        cleanedAudio = filePath === audioPath;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      },
    },
    chime: {
      playStart: () => events.push('online:chime:start'),
      playStop: () => events.push('online:chime:stop'),
      playError: () => events.push('online:chime:error'),
    },
    whisper: {
      transcribe: async (filePath) => {
        events.push('online:transcribe');
        assert.equal(filePath, audioPath);
        return 'turn on the living room light';
      },
    },
    echoClient: {
      processIntent: async (prompt) => {
        events.push('online:echo-execute');
        assert.equal(prompt, 'turn on the living room light');
        return {
          success: true,
          response: 'Approval pending to turn on the light.',
          toolsUsed: ['home_assistant'],
          permissionsRequested: ['perm-agent-voice'],
          durationMs: 34,
          executionStatus: 'approval_required',
          traceId: 'trace-agent-voice',
          runId: 'run-agent-voice',
          sessionId: 'agent-voice-session',
          approvalId: 'perm-agent-voice',
          artifactId: null,
          correlation: {
            traceId: 'trace-agent-voice',
            runId: 'run-agent-voice',
            sessionId: 'agent-voice-session',
            approvalId: 'perm-agent-voice',
            artifactId: null,
          },
          runContext: {
            traceId: 'trace-agent-voice',
            runId: 'run-agent-voice',
            sessionId: 'agent-voice-session',
            surface: 'agent',
            requestedBy: 'zavorth-agent-voice-smoke',
            profile: 'IOT',
          },
        };
      },
      readSurfaceState: async () => {
        events.push('online:surface-state');
        return state;
      },
    },
    overlay: {
      showListening: async (mode) => {
        events.push(`online:listening:${mode}`);
      },
      showProcessing: async (transcript) => {
        events.push('online:processing');
        assert.equal(transcript, 'turn on the living room light');
      },
      showResult: async (response, success, durationMs) => {
        events.push('online:result');
        assert.equal(success, true);
        assert.equal(response, 'Approval pending to turn on the light.');
        assert.equal(durationMs, 34);
      },
      showEchoSurfaceState: async (renderedState) => {
        events.push('online:render-state');
        surfaceStateRendered = renderedState.summary.pendingApprovals === 1;
      },
    },
    tts: {
      speak: async (text) => {
        events.push('online:tts');
        assert.equal(text, 'Approval pending to turn on the light.');
        fs.writeFileSync(ttsPath, 'sample tts');
        return ttsPath;
      },
      cleanup: (filePath) => {
        events.push('online:cleanup-tts');
        cleanedTts = filePath === ttsPath;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      },
    },
    isTtsAvailable: () => true,
    onModeChange: async (patch) => {
      events.push(`online:mode:${patch.mode}`);
    },
    onProcessingChange: async () => {
      processingTransitions += 1;
    },
  });

  const result = await flow.runActivation('voice-smoke');
  assert.equal(result.status, 'completed');
  assert.equal(result.transcript, 'turn on the living room light');
  assert.equal(result.echoResult?.runId, 'run-agent-voice');
  assert.equal(result.surfaceState?.summary.pendingApprovals, 1);
  assert.equal(flow.isProcessing, false);
  assert.equal(cleanedAudio, true);
  assert.equal(cleanedTts, true);
  assert.equal(surfaceStateRendered, true);
  assert.equal(processingTransitions, 2);
  assert.ok(events.includes('online:chime:start'));
  assert.ok(events.includes('online:chime:stop'));
  assert(!fs.existsSync(audioPath), 'audio fixture should be cleaned');
  assert(!fs.existsSync(ttsPath), 'tts fixture should be cleaned');
}

async function smokeConnectionFallbackFlow(): Promise<void> {
  const offlineClient = new EchoClientService({
    baseUrl: 'http://127.0.0.1:9',
    timeoutMs: 250,
    sessionId: 'agent-offline-session',
    surface: 'agent',
    requestedBy: 'zavorth-agent-voice-smoke',
  });

  const connection = await offlineClient.checkConnection();
  assert.equal(connection.backendOnline, false);
  assert.equal(connection.ollamaOnline, false);

  const offlineResult = await offlineClient.processIntent('agent offline test', 'VOICE');
  assert.equal(offlineResult.success, false);
  assert.match(offlineResult.response, /Connection failure|took too long|Connection with backend|took too long/i);

  const audioPath = path.join(os.tmpdir(), `zavorth-agent-offline-${process.pid}-${Date.now()}.wav`);
  let cleanedAudio = false;
  let showedFallbackResult = false;

  const flow = new AgentVoiceFlowService({
    recorder: {
      record: async () => {
        events.push('offline:record');
        fs.writeFileSync(audioPath, 'sample offline audio');
        return audioPath;
      },
      cleanup: (filePath) => {
        events.push('offline:cleanup-audio');
        cleanedAudio = filePath === audioPath;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      },
    },
    chime: {
      playStart: () => events.push('offline:chime:start'),
      playStop: () => events.push('offline:chime:stop'),
      playError: () => events.push('offline:chime:error'),
    },
    whisper: {
      transcribe: async () => {
        events.push('offline:transcribe');
        return 'agent offline test';
      },
    },
    echoClient: {
      processIntent: async () => {
        events.push('offline:echo-fallback-result');
        return offlineResult;
      },
      readSurfaceState: async () => {
        events.push('offline:surface-state-failed');
        throw new Error('offline state unavailable');
      },
    },
    overlay: {
      showListening: async () => {
        events.push('offline:listening');
      },
      showProcessing: async () => {
        events.push('offline:processing');
      },
      showResult: async (response, success) => {
        events.push('offline:result');
        showedFallbackResult = success === false && response === offlineResult.response;
      },
      showEchoSurfaceState: async () => {
        throw new Error('surface state should not render when offline fallback is active');
      },
    },
    tts: {
      speak: async () => {
        throw new Error('tts should stay disabled in offline fallback smoke');
      },
      cleanup: () => undefined,
    },
    isTtsAvailable: () => false,
  });

  const result = await flow.runActivation('voice-smoke-offline');
  assert.equal(result.status, 'completed');
  assert.equal(result.echoResult?.success, false);
  assert.equal(result.surfaceState, null);
  assert.equal(cleanedAudio, true);
  assert.equal(showedFallbackResult, true);
  assert.equal(flow.isProcessing, false);
  assert.ok(events.includes('offline:chime:start'));
  assert.ok(events.includes('offline:chime:stop'));
  assert(!fs.existsSync(audioPath), 'offline audio fixture should be cleaned');
}

async function smokeCloudVoiceFallbackFlow(): Promise<void> {
  const audioPath = path.join(os.tmpdir(), `zavorth-agent-cloud-${process.pid}-${Date.now()}.wav`);
  let cleanedAudio = false;
  let cloudPlayerUsed = false;
  let cloudRequestUsed = false;
  let systemFallbackUsed = false;
  let cloudTtsPath = '';

  const cloudTts = new GatewayCloudTtsService({
    enabled: true,
    baseUrl: 'http://localhost:3000',
    model: 'gemini-3.1-flash-tts-preview',
    voice: 'Kore',
    responseFormat: 'wav',
    surface: 'agent',
    requestedBy: 'zavorth-agent-voice-smoke',
    sessionId: 'agent-voice-session',
    fetchImpl: async (input, init) => {
      events.push('cloud:fetch');
      cloudRequestUsed = true;
      assert.match(String(input), /api\/v2\/echo\/audio\/speech$|audio\/speech$/);
      assert.equal(init?.method, 'POST');
      const body = JSON.parse(String(init?.body || '{}'));
      assert.equal(body.model, 'gemini-3.1-flash-tts-preview');
      assert.equal(body.voice, 'Kore');
      assert.equal(body.input, 'Fallback cloud voice active.');
      if (String(input).includes('/api/v2/echo/audio/speech')) {
        assert.equal(body.surface, 'agent');
        assert.equal(body.requestedBy, 'zavorth-agent-voice-smoke');
        assert.equal(body.sessionId, 'agent-voice-session');
      }
      return new Response(Buffer.from('sample cloud audio'), {
        status: 200,
        headers: { 'content-type': 'audio/wav' },
      });
    },
    audioPlayer: async (filePath) => {
      events.push('cloud:play');
      cloudPlayerUsed = true;
      cloudTtsPath = filePath;
    },
  });

  const tts = new HybridTtsService({
    localTts: {
      speak: async () => {
        throw new Error('legacy local speak should not run before cloud fallback');
      },
      speakEdge: async () => {
        events.push('cloud:local-edge-failed');
        throw new Error('edge-tts missing');
      },
      speakSystemFallback: async () => {
        events.push('cloud:system-fallback');
        systemFallbackUsed = true;
        return '';
      },
      cleanup: () => undefined,
      isAvailable: async () => ({ available: true, method: 'sapi-fallback' }),
    },
    cloudTts,
  });

  const flow = new AgentVoiceFlowService({
    recorder: {
      record: async () => {
        events.push('cloud:record');
        fs.writeFileSync(audioPath, 'sample cloud audio');
        return audioPath;
      },
      cleanup: (filePath) => {
        events.push('cloud:cleanup-audio');
        cleanedAudio = filePath === audioPath;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      },
    },
    chime: {
      playStart: () => events.push('cloud:chime:start'),
      playStop: () => events.push('cloud:chime:stop'),
      playError: () => events.push('cloud:chime:error'),
    },
    whisper: {
      transcribe: async () => {
        events.push('cloud:transcribe');
        return 'activate cloud fallback';
      },
    },
    echoClient: {
      processIntent: async () => {
        events.push('cloud:echo');
        return {
          success: true,
          response: 'Fallback cloud voice active.',
          toolsUsed: [],
          durationMs: 21,
          executionStatus: 'completed',
        };
      },
      readSurfaceState: async () => {
        events.push('cloud:surface-state');
        return buildSurfaceState();
      },
    },
    overlay: {
      showListening: async () => {
        events.push('cloud:listening');
      },
      showProcessing: async () => {
        events.push('cloud:processing');
      },
      showResult: async () => {
        events.push('cloud:result');
      },
      showEchoSurfaceState: async () => {
        events.push('cloud:render-state');
      },
    },
    tts,
    isTtsAvailable: () => true,
  });

  const result = await flow.runActivation('voice-cloud-fallback');
  assert.equal(result.status, 'completed');
  assert.equal(result.echoResult?.response, 'Fallback cloud voice active.');
  assert.equal(cloudRequestUsed, true);
  assert.equal(cloudPlayerUsed, true);
  assert.equal(systemFallbackUsed, false);
  assert.equal(cleanedAudio, true);
  assert.ok(events.includes('cloud:chime:start'));
  assert.ok(events.includes('cloud:chime:stop'));
  assert.ok(cloudTtsPath, 'cloud tts file should be generated');
  assert.equal(fs.existsSync(cloudTtsPath), false, 'cloud tts file should be cleaned by the flow');
}

function buildSurfaceState(): EchoAgentSurfaceState {
  const echoResult = buildHistoryResult();
  return {
    context: {
      sessionId: 'agent-voice-session',
      surface: 'agent',
      requestedBy: 'zavorth-agent-voice-smoke',
    },
    pendingPermissions: [{
      id: 'perm-agent-voice',
      action: 'home_assistant',
      resource: '{"entity_id":"light.sala"}',
      reason: 'Voice smoke approval.',
      status: 'pending',
      requestedAt: '2026-04-18T12:00:00.000Z',
      kind: 'intent',
      toolName: 'home_assistant',
      category: 'IOT',
      surface: 'agent',
      requestedBy: 'zavorth-agent-voice-smoke',
      approvalId: 'perm-agent-voice',
      correlation: echoResult.correlation,
      runContext: echoResult.runContext,
    }],
    recentHistory: [{
      id: 'exec-agent-voice',
      timestamp: '2026-04-18T12:00:00.000Z',
      prompt: 'turn on the living room light',
      status: 'approval_required',
      finalResponse: 'Approval pending to turn on the light.',
      durationMs: 34,
      toolsUsed: ['home_assistant'],
      toolStates: [{
        toolName: 'home_assistant',
        securityDecision: 'permission_required',
        lifecycle: {
          mode: 'event-bridge',
          status: 'pending',
          details: { mode: 'event-bridge', status: 'pending' },
        },
        artifact: null,
        policy: {
          scope: 'private-network',
          details: { scope: 'private-network' },
        },
      }],
      correlation: echoResult.correlation,
      runContext: echoResult.runContext,
      traceId: 'trace-agent-voice',
      runId: 'run-agent-voice',
    }],
    recentPhysicalEvents: [{
      id: 'ha-event-voice',
      source: 'iot_home_assistant',
      timestamp: '2026-04-18T12:00:02.000Z',
      entityId: 'lock.front_door',
      oldState: 'locked',
      newState: 'unlocked',
      feedback: 'Attention: lock.front_door changed to unlocked.',
      severity: 'critical',
    }],
    summary: {
      pendingApprovals: 1,
      recentRuns: 1,
      lastRunId: 'run-agent-voice',
      lastTraceId: 'trace-agent-voice',
      lastStatus: 'approval_required',
      lastPrompt: 'turn on the living room light',
      lastResponse: 'Approval pending to turn on the light.',
      lastSurface: 'agent',
      lastCapabilityStatus: 'pending',
      physicalSignals: 1,
      lastPhysicalEventId: 'ha-event-voice',
      lastPhysicalFeedback: 'Attention: lock.front_door changed to unlocked.',
      lastPhysicalSeverity: 'critical',
    },
  };
}

function buildHistoryResult(): {
  correlation: NonNullable<EchoAgentResult['correlation']>;
  runContext: NonNullable<EchoAgentResult['runContext']>;
} {
  return {
    correlation: {
      traceId: 'trace-agent-voice',
      runId: 'run-agent-voice',
      sessionId: 'agent-voice-session',
      approvalId: 'perm-agent-voice',
      artifactId: null,
    },
    runContext: {
      traceId: 'trace-agent-voice',
      runId: 'run-agent-voice',
      sessionId: 'agent-voice-session',
      surface: 'agent',
      requestedBy: 'zavorth-agent-voice-smoke',
      profile: 'IOT',
    },
  };
}
