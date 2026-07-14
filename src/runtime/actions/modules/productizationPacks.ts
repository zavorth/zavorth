import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type {
  ZavorthActionDefinition,
  ZavorthActionHandlerInput,
  ZavorthActionModule,
  ZavorthActionResult,
  ZavorthActionSchema,
} from '../ZavorthActionContracts.js';
import { ZavorthExtensionPluginSdkService } from '../../../services/ZavorthExtensionPluginSdkService.js';

import { ZavorthTerminalBackendsService } from '../../../services/ZavorthTerminalBackendsService.js';
import { ZavorthSubagentRuntimeService } from '../../../agents/ZavorthSubagentRuntimeService.js';
import { HttpSpeechSynthesisLiveAdapter } from '../../../adapters/speech/SpeechVoiceLiveAdapters.js';
import { SpeechRuntimeService } from '../../../services/SpeechRuntimeService.js';
import { GeminiVoiceService } from '../../../providers/GeminiVoiceService.js';
import { config } from '../../../config/index.js';
import { asErrorLike } from '../../../utils/errorLike.js';

const SURFACE: ZavorthActionDefinition['surface'] = ['cli', 'zavorthControl', 'tui', 'api', 'channel', 'llm'];
const TEST_REFS = ['tests/runtime/actions/ZavorthProductizationPackActions.test.ts'];

const outputSchema: ZavorthActionSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    summary: { type: 'string' },
  },
};

const LONG_TAIL_CHANNELS = [
  'matrix',
  'nostr',
  'irc',
  'twitch',
  'wechat',
  'dingtalk',
  'feishu',
  'line',
];

const VOICE_BACKENDS = [
  { id: 'edge', env: 'msedge-tts (bundled dependency)', kind: 'local-cli' },
  { id: 'elevenlabs', env: 'ELEVENLABS_API_KEY', kind: 'network-provider' },
  { id: 'minimax', env: 'MINIMAX_API_KEY', kind: 'network-provider' },
  { id: 'neutts', env: 'ZAVORTH_NEUTTS_ENDPOINT', kind: 'local-or-network-endpoint' },
  { id: 'gemini', env: 'GEMINI_API_KEY', kind: 'network-provider' },
];

function text(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function configuredUrl(...names: string[]): string {
  for (const name of names) {
    const value = text(process.env[name]);
    if (value) return value;
  }
  return '';
}

function schema(properties: Record<string, unknown>, required: string[] = []): ZavorthActionSchema {
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
}

function result(input: {
  ok: boolean;
  actionId: string;
  operation: ZavorthActionResult['operation'];
  status: ZavorthActionResult['status'];
  summary: string;
  lines: string[];
  data?: Record<string, unknown>;
}): ZavorthActionResult {
  return input;
}

function block(input: ZavorthActionHandlerInput, summary: string, lines: string[] = [], data?: Record<string, unknown>): ZavorthActionResult {
  return result({
    ok: false,
    actionId: input.actionId,
    operation: input.operation,
    status: 'blocked',
    summary,
    lines: lines.length ? lines : [summary],
    data,
  });
}

function preview(input: ZavorthActionHandlerInput, summary: string, data: Record<string, unknown>): ZavorthActionResult | null {
  if (input.operation !== 'action.preview' && input.operation !== 'action.status') {
    return null;
  }
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: input.operation === 'action.preview' ? 'preview' : 'ok',
    summary,
    lines: Object.entries(data).slice(0, 10).map(([key, value]) => `${key}: ${String(value).slice(0, 260)}`),
    data,
  });
}

function base(
  input: Omit<ZavorthActionDefinition, 'capabilityId' | 'verificationStatus' | 'surface' | 'testRefs'>,
): ZavorthActionDefinition {
  return {
    ...input,
    capabilityId: 'productization-packs',
    verificationStatus: 'verified',
    surface: SURFACE,
    testRefs: TEST_REFS,
  };
}

function pluginSdk(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const action = text(input.args.action, 'status');
  const service = new ZavorthExtensionPluginSdkService({ cwd: input.root });
  const snapshot = service.execute({
    action: action as any,
    manifestPath: text(input.args.manifestPath, ''),
    manifestJson: text(input.args.manifestJson, ''),
    pluginId: text(input.args.pluginId || input.args.plugin, ''),
    lifecycle: text(input.args.lifecycle, ''),
    approvalId: text(input.approvalId || input.args.approvalId, ''),
    workspace: input.root,
  } as any);
  const mutating = action.includes('apply') || ['install', 'enable', 'disable', 'uninstall', 'upgrade'].includes(text(input.args.lifecycle).toLowerCase());
  if (mutating && input.operation !== 'action.apply') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: `Plugin SDK ${action} preview is ready.`,
      lines: service.formatSnapshotText(snapshot).split(/\r?\n/u).slice(0, 30),
      data: { snapshot, willMutate: snapshot.lifecycle.willMutateState, rawSecretsSerialized: false },
    });
  }
  if (mutating && input.operation === 'action.apply' && !input.approvalId && !input.trustedOperatorConfirmation) {
    return block(input, 'Plugin SDK lifecycle apply requires approval.', ['Provide approvalId or trusted operator confirmation.']);
  }
  return result({
    ok: snapshot.status !== 'blocked',
    actionId: input.actionId,
    operation: input.operation,
    status: snapshot.status === 'blocked' ? 'blocked' : input.operation === 'action.apply' ? 'applied' : 'ok',
    summary: `Plugin SDK ${snapshot.action}: ${snapshot.status}.`,
    lines: service.formatSnapshotText(snapshot).split(/\r?\n/u).slice(0, 30),
    data: { snapshot, rawSecretsSerialized: false },
  });
}

function longTailChannels(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const channel = text(input.args.channel, 'all').toLowerCase();
  const message = text(input.args.message || input.args.text);
  const configured = LONG_TAIL_CHANNELS.map((id) => {
    const envName = `ZAVORTH_${id.toUpperCase().replace(/[^A-Z0-9]/gu, '_')}_WEBHOOK_URL`;
    const legacyEnvName = `${id.toUpperCase().replace(/[^A-Z0-9]/gu, '_')}_WEBHOOK_URL`;
    return { id, envName, legacyEnvName, configured: Boolean(process.env[envName] || process.env[legacyEnvName]) };
  });

  if (input.operation === 'action.status' || input.operation === 'action.preview') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: `${configured.filter((entry) => entry.configured).length}/${configured.length} long-tail channel(s) configured.`,
      lines: configured.map((entry) => `${entry.id}: ${entry.configured ? 'configured' : `missing ${entry.envName}`}`),
      data: { channels: configured, targetChannel: channel, externalSend: Boolean(message), rawSecretsSerialized: false },
    });
  }

  if (input.operation !== 'action.apply') return block(input, `Unsupported operation for ${input.actionId}.`);

  const targetChannels = channel === 'all'
    ? configured.filter((entry) => entry.configured)
    : configured.filter((entry) => entry.id === channel);

  if (targetChannels.length === 0) {
    const missingEnv = channel === 'all'
      ? 'No long-tail channels have webhook URLs configured.'
      : `Channel "${channel}" is not configured. Set ${configured.find((e) => e.id === channel)?.envName || 'the webhook env var'}.`;
    return block(input, missingEnv, configured.map((e) => `${e.id}: ${e.configured ? 'ok' : `set ${e.envName}`}`));
  }

  if (!message) {
    return block(input, 'Missing message for channel draft.', ['Provide args.message or args.text.']);
  }

  const envelope = {
    preparedAt: new Date().toISOString(),
    targetChannels: targetChannels.map((entry) => entry.id),
    payload: {
      text: message,
      content: message,
      message,
      channelId: channel === 'all' ? 'broadcast' : channel,
      recipients: [],
      threadId: null,
      metadata: { source: 'zavorth-productization-pack', draft: true },
    },
    webhookUrls: targetChannels.map((entry) => ({
      channel: entry.id,
      envName: entry.envName,
      configured: true,
    })),
    liveSendRequiresApproval: true,
    nextStep: 'Call channels.send_approved with this envelope after operator approval.',
  };

  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'applied',
    summary: `Channel draft prepared for ${targetChannels.map((e) => e.id).join(', ')}. Envelope ready — live send requires approval.`,
    lines: [
      `Targets: ${targetChannels.map((e) => e.id).join(', ')}`,
      `Message preview: ${message.slice(0, 200)}`,
      'Live send: requires approval via channels.send_approved',
    ],
    data: { envelope, rawSecretsSerialized: false },
  });
}

async function kanbanDispatch(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const task = text(input.args.task || input.args.objective || input.args.title);
  if (!task) return block(input, 'Missing task for multi-agent Kanban dispatch.', ['Provide args.task.']);
  const mode = text(input.args.mode, 'review');
  const previewResult = preview(input, 'Kanban multi-agent dispatch preview.', {
    task,
    mode,
    roles: input.args.roles || ['planner', 'implementer', 'reviewer'],
    handoff: 'subagents.spawn',
  });
  if (previewResult) return previewResult;
  if (input.operation !== 'action.apply') return block(input, `Unsupported operation for ${input.actionId}.`);
  const runtime = new ZavorthSubagentRuntimeService({ projectRoot: input.root });
  const snapshot = await runtime.execute({
    action: 'subagents.spawn',
    task,
    mode,
    explicitSubagents: true,
    live: input.args.live === true,
    mockLive: input.args.mockLive === true,
    approvalId: input.approvalId || null,
    sourceSurface: input.sourceSurface || 'action-harness',
    actorId: input.actorId || null,
    persistState: input.args.persistState === true,
  });
  return result({
    ok: snapshot.status === 'completed' || snapshot.status === 'ready',
    actionId: input.actionId,
    operation: input.operation,
    status: snapshot.status === 'approval-required' ? 'approval_required' : snapshot.status === 'denied' ? 'blocked' : 'applied',
    summary: snapshot.runs.at(-1)?.summary || snapshot.timeline.at(-1)?.detail || `Subagent runtime ${snapshot.status}.`,
    lines: snapshot.timeline.slice(-12).map((event) => `${event.kind}: ${event.detail}`),
    data: { snapshot },
  });
}

function terminalBackends(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const service = new ZavorthTerminalBackendsService({ cwd: input.root });
  const snapshot = service.execute({
    action: input.operation === 'action.apply' ? 'terminal.execute' : 'terminal.status',
    backend: text(input.args.backend, ''),
    command: text(input.args.command, ''),
    workspace: input.root,
    timeoutMs: Number(input.args.timeoutMs || 30000),
    live: input.args.live === true && input.operation === 'action.apply',
    approvalId: input.approvalId || text(input.args.approvalId, ''),
    dockerImage: text(input.args.dockerImage, ''),
    sshHost: text(input.args.sshHost, ''),
  } as any);
  return result({
    ok: !['blocked', 'needs-configuration'].includes(snapshot.status),
    actionId: input.actionId,
    operation: input.operation,
    status: snapshot.status === 'executed' ? 'applied' : snapshot.status === 'blocked' ? 'blocked' : input.operation === 'action.preview' ? 'preview' : 'ok',
    summary: `${snapshot.selectedBackend}: ${snapshot.status}.`,
    lines: service.formatSnapshotText(snapshot).split(/\r?\n/u).slice(0, 32),
    data: { snapshot },
  });
}

async function voiceBackends(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const speechText = text(input.args.text || input.args.message);
  const backend = text(input.args.backend, 'auto').toLowerCase();
  const readiness = VOICE_BACKENDS.map((entry) => {
    let configured = false;
    if (entry.id === 'edge') {
      configured = true;
    } else if (entry.id === 'gemini') {
      configured = Boolean(process.env.GEMINI_API_KEY || process.env.AISTUDIO_API_KEY || config.geminiApiKey);
    } else if (entry.id === 'elevenlabs') {
      configured = Boolean(process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY);
    } else {
      configured = Boolean(process.env[entry.env]);
    }
    return {
      ...entry,
      configured,
    };
  });
  const previewResult = preview(input, 'Voice/TTS backend preview.', {
    backend,
    textPreview: speechText.slice(0, 240),
    configuredBackends: readiness.filter((entry) => entry.configured).map((entry) => entry.id),
    availableBackends: readiness.map((entry) => entry.id),
  });
  if (previewResult) return previewResult;
  if (!speechText) return block(input, 'Missing TTS text.', ['Provide args.text.']);
  if (input.operation !== 'action.apply') return block(input, `Unsupported operation for ${input.actionId}.`);

  const selected = readiness.find((entry) => entry.id === backend && entry.configured)
    || readiness.find((entry) => entry.configured);
  if (!selected) {
    return block(input, 'No live TTS backend is configured.', readiness.map((entry) => `${entry.id}: set ${entry.env}`));
  }

  const outDir = path.join(input.root, '.zavorth', 'artifacts', 'voice');
  await fsp.mkdir(outDir, { recursive: true });

  if (selected.id === 'edge') {
    try {
      // @ts-ignore
      const { MsEdgeTTS } = await import('msedge-tts');
      const tts = new MsEdgeTTS();
      const voiceName = text(input.args.voice, 'pt-BR-FranciscaNeural');
      await tts.setMetadata(voiceName, 'audio-24khz-48kbitrate-mono-mp3' as never);
      const artifactPath = path.join(outDir, `tts-${Date.now()}.mp3`);
      const { pipeline } = await import('node:stream/promises');
      const { createWriteStream } = await import('node:fs');
      const { audioStream } = tts.toStream(speechText);
      await pipeline(audioStream as any, createWriteStream(artifactPath));
      (tts as any).close?.();
      const stat = await fsp.stat(artifactPath);
      return result({
        ok: true,
        actionId: input.actionId,
        operation: input.operation,
        status: 'applied',
        summary: `Voice synthesized via Edge TTS (${voiceName}).`,
        lines: [`Backend: edge-tts`, `Voice: ${voiceName}`, `Artifact: ${artifactPath}`, `Size: ${stat.size} bytes`],
        data: { artifactPath, backend: 'edge', voice: voiceName, liveAudioGenerated: true, bytes: stat.size, rawSecretsSerialized: false },
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const msg = error instanceof Error ? err.message : String(error);
      return block(input, `Edge TTS synthesis failed: ${msg}`, [
        'Ensure msedge-tts is installed: npm install msedge-tts',
        `Voice used: ${text(input.args.voice, 'pt-BR-FranciscaNeural')}`,
      ]);
    }
  }

  if (selected.id === 'gemini') {
    try {
      const apiKey = String(process.env.GEMINI_API_KEY || process.env.AISTUDIO_API_KEY || config.geminiApiKey || '').trim();
      const service = new GeminiVoiceService({ tmpDir: outDir, apiKey });
      const synthesized = await service.synthesizeDetailed(speechText, { voiceName: text(input.args.voice, 'Kore') });
      if (!synthesized) return block(input, 'Gemini TTS did not return audio.', ['Check GEMINI_API_KEY and the configured Gemini voice model.']);
      return result({ ok: true, actionId: input.actionId, operation: input.operation, status: 'applied', summary: `Voice synthesized via Gemini (${synthesized.voiceName}).`, lines: [`Backend: gemini`, `Artifact: ${synthesized.filePath}`, `Size: ${synthesized.outputBytes} bytes`], data: { artifactPath: synthesized.filePath, backend: 'gemini', voice: synthesized.voiceName, liveAudioGenerated: true, bytes: synthesized.outputBytes, rawSecretsSerialized: false } });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      return block(input, `Gemini TTS synthesis failed: ${error instanceof Error ? err.message : String(error)}`);
    }
  }

  const voice = text(input.args.voice, 'default');
  const voiceConfig = selected.id === 'elevenlabs'
    ? { adapterId: 'elevenlabs-tts', providerId: 'elevenlabs', synthesizeUrl: configuredUrl('ELEVENLABS_TTS_URL') || `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(text(process.env.ELEVENLABS_VOICE_ID, voice))}`, apiKey: text(process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY), modelId: text(process.env.ELEVENLABS_TTS_MODEL, 'eleven_multilingual_v2'), voiceId: voice, requestStyle: 'elevenlabs' as const, authHeaderName: 'xi-api-key', authScheme: null }
    : selected.id === 'minimax'
      ? { adapterId: 'minimax-tts', providerId: 'minimax', synthesizeUrl: configuredUrl('MINIMAX_TTS_URL', 'ZAVORTH_MINIMAX_TTS_URL'), apiKey: text(process.env.MINIMAX_API_KEY), modelId: text(process.env.MINIMAX_TTS_MODEL, 'speech-2.8-hd'), voiceId: voice, requestStyle: 'json-text' as const }
      : { adapterId: 'neutts', providerId: 'neutts', synthesizeUrl: configuredUrl('ZAVORTH_NEUTTS_ENDPOINT'), apiKey: text(process.env.ZAVORTH_NEUTTS_API_KEY), modelId: text(process.env.ZAVORTH_NEUTTS_MODEL), voiceId: voice, requestStyle: 'json-text' as const };
  if (!voiceConfig.synthesizeUrl) return block(input, `${selected.id} TTS needs a live endpoint.`, [selected.id === 'minimax' ? 'Set MINIMAX_TTS_URL or ZAVORTH_MINIMAX_TTS_URL.' : 'Set the provider TTS endpoint environment variable.']);
  const runtime = new SpeechRuntimeService({ artifactDir: outDir, synthesizeAdapter: new HttpSpeechSynthesisLiveAdapter(voiceConfig) });
  const synthesized = await runtime.synthesizeLive({ text: speechText, voiceId: voice, format: 'mp3' });
  if (!synthesized.ok || !synthesized.audioArtifact) return block(input, `Live ${selected.id} TTS synthesis failed: ${synthesized.error || 'no audio artifact returned'}.`);
  return result({ ok: true, actionId: input.actionId, operation: input.operation, status: 'applied', summary: `Voice synthesized via ${selected.id}.`, lines: [`Backend: ${selected.id}`, `Artifact: ${synthesized.audioArtifact.storageRef}`], data: { artifactPath: synthesized.audioArtifact.storageRef, artifactId: synthesized.audioArtifact.artifactId, backend: selected.id, liveAudioGenerated: true, providerEvidence: synthesized.providerEvidence, rawSecretsSerialized: false } });
}

function acpCodex(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const acpFiles = [
    'src/gateway/channels/adapters/AcpGenericChannelAdapter.ts',
    'src/adapters/claude/AcpxBridgeRuntimeAdapter.ts',
    'src/ai-gateway/lib/acp/index.ts',
  ];
  const codexFiles = [
    'src/adapters/codex/CodexAppServerRpcAdapter.ts',
  ];
  const status = {
    acp: acpFiles.map((file) => ({ file, exists: fs.existsSync(path.join(input.root, file)) })),
    codex: codexFiles.map((file) => ({ file, exists: fs.existsSync(path.join(input.root, file)) })),
    packageCommand: 'zavorth acp channel status',
    codexCommand: 'zavorth codex status',
  };
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: input.operation === 'action.preview' ? 'preview' : 'ok',
    summary: 'ACP/Codex packaging readiness inspected.',
    lines: [
      ...status.acp.map((entry) => `ACP ${entry.exists ? 'ok' : 'missing'}: ${entry.file}`),
      ...status.codex.map((entry) => `Codex ${entry.exists ? 'ok' : 'missing'}: ${entry.file}`),
      `Next ACP: ${status.packageCommand}`,
      `Next Codex: ${status.codexCommand}`,
    ],
    data: status,
  });
}

function packaging(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const files = [
    'deploy/nix/flake.nix',
    'deploy/nix/nixos-module.nix',
    'deploy/termux/install.sh',
    'docs/protocol/runtime-api-v1.md',
  ].map((file) => ({ file, exists: fs.existsSync(path.join(input.root, file)) }));
  const termuxReady = fs.existsSync(path.join(input.root, 'src/services/RemoteMeshSandboxReadinessService.ts'));
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: input.operation === 'action.preview' ? 'preview' : 'ok',
    summary: `Packaging readiness: Nix=${files[0]?.exists ? 'present' : 'missing'}, Termux plane=${termuxReady ? 'present' : 'missing'}.`,
    lines: [
      ...files.map((entry) => `${entry.exists ? 'ok' : 'missing'}: ${entry.file}`),
      `Termux/PRoot readiness service: ${termuxReady ? 'present' : 'missing'}`,
      'NixOS module and Termux installer are included; run their documented smoke checks before a production deployment.',
    ],
    data: { files, termuxReady, nixosModule: files[1]?.exists === true, termuxInstaller: files[2]?.exists === true },
  });
}

export function createProductizationPacksActionModule(): ZavorthActionModule {
  const stringProp = { type: 'string' };
  return {
    id: 'productization-packs',
    manifestId: 'productization-packs',
    actions: [
      base({ id: 'plugins.sdk.status', title: 'Plugin SDK status', description: 'Inspect the public plugin SDK, manifest schema, permission review and local marketplace readiness.', aliases: ['plugin sdk', 'plugins sdk status', 'plugin marketplace'], domains: ['plugins', 'sdk'], risk: 'safe', effects: ['read'], scope: 'plugins', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: schema({ action: stringProp, manifestPath: stringProp, manifestJson: stringProp }), outputSchema, handler: pluginSdk }),
      base({ id: 'plugins.sdk.lifecycle', title: 'Plugin SDK lifecycle', description: 'Preview or apply a governed plugin lifecycle operation with manifest validation and receipts.', aliases: ['plugin lifecycle', 'install plugin', 'enable plugin'], domains: ['plugins', 'sdk'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['write'], scope: 'plugins', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ action: stringProp, pluginId: stringProp, lifecycle: stringProp, manifestPath: stringProp, manifestJson: stringProp }, ['lifecycle']), outputSchema, handler: pluginSdk }),
      base({ id: 'channels.long_tail.status', title: 'Long-tail channel status', description: 'Inspect Matrix, Nostr, IRC, Twitch, WeChat, DingTalk, Feishu and Line readiness.', aliases: ['matrix status', 'nostr status', 'twitch status', 'long tail channels'], domains: ['channels'], risk: 'safe', effects: ['read'], scope: 'channels', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: schema({ channel: stringProp }), outputSchema, handler: longTailChannels }),
      base({ id: 'channels.long_tail.draft', title: 'Long-tail channel draft', description: 'Prepare a long-tail channel send envelope without external delivery.', aliases: ['matrix draft', 'nostr draft', 'twitch draft'], domains: ['channels'], risk: 'safe', effects: ['read'], scope: 'channels', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: schema({ channel: stringProp, message: stringProp }, ['channel', 'message']), outputSchema, handler: longTailChannels }),
      base({ id: 'kanban.dispatch_multi_agent', title: 'Kanban multi-agent dispatch', description: 'Turn a Kanban item into a governed subagent dispatch with planner/implementer/reviewer handoff.', aliases: ['kanban multi agent', 'dispatch task to agents', 'task board dispatcher'], domains: ['kanban', 'subagents'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['write'], scope: 'tasks', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ task: stringProp, mode: stringProp, roles: { type: 'array' }, live: { type: 'boolean' }, mockLive: { type: 'boolean' }, persistState: { type: 'boolean' } }, ['task']), outputSchema, handler: kanbanDispatch }),
      base({ id: 'terminal.backends.status', title: 'Terminal backend status', description: 'Inspect Docker, SSH, WSL, Vercel Sandbox, Modal, Daytona and Singularity/Apptainer readiness.', aliases: ['terminal backends', 'sandbox backends', 'docker ssh modal daytona singularity'], domains: ['terminal', 'sandbox'], risk: 'safe', effects: ['read'], scope: 'workspace', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: schema({ backend: stringProp }), outputSchema, handler: terminalBackends }),
      base({ id: 'terminal.backends.execute', title: 'Terminal backend execute', description: 'Preview or execute a governed command through a configured terminal backend.', aliases: ['execute backend command', 'run in docker', 'run in sandbox backend'], domains: ['terminal', 'sandbox'], risk: 'danger', mutationDomain: 'sandbox', mutationRisk: 'high', effects: ['shell'], scope: 'workspace', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ backend: stringProp, command: stringProp, timeoutMs: { type: 'number' }, live: { type: 'boolean' }, dockerImage: stringProp, sshHost: stringProp }, ['backend', 'command']), outputSchema, handler: terminalBackends }),
      base({ id: 'voice.backends.status', title: 'Voice backend status', description: 'Inspect Edge, ElevenLabs, MiniMax, Neutts and Gemini TTS readiness.', aliases: ['tts backends', 'voice status', 'speech backends'], domains: ['voice', 'media'], risk: 'safe', effects: ['read'], scope: 'media', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: schema({ backend: stringProp }), outputSchema, handler: voiceBackends }),
      base({ id: 'voice.synthesize_live', title: 'Voice synthesize live', description: 'Prepare a governed live TTS envelope for a configured speech backend.', aliases: ['tts live', 'synthesize voice', 'text to speech live'], domains: ['voice', 'media'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['write', 'network'], scope: 'media', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: schema({ text: stringProp, voice: stringProp, backend: stringProp }, ['text']), outputSchema, handler: voiceBackends }),
      base({ id: 'interop.acp_codex.status', title: 'ACP/Codex packaging status', description: 'Inspect ACP and Codex adapter packaging readiness.', aliases: ['acp status', 'codex status', 'codex integration'], domains: ['interop', 'acp', 'codex'], risk: 'safe', effects: ['read'], scope: 'interop', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: schema({}), outputSchema, handler: acpCodex }),
      base({ id: 'packaging.nix_termux.status', title: 'Nix/Termux packaging status', description: 'Inspect Nix flake, NixOS module gap and Termux/PRoot packaging readiness.', aliases: ['nix termux status', 'nixos modules', 'termux support'], domains: ['packaging', 'nix', 'termux'], risk: 'safe', effects: ['read'], scope: 'packaging', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: schema({}), outputSchema, handler: packaging }),
    ],
  };
}
