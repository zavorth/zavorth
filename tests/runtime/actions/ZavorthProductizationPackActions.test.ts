import { ZavorthEchoOrchestrator } from '../../../src/echo/orchestrator/ZavorthEchoOrchestrator';
import { ZavorthActionCatalog } from '../../../src/runtime/actions/ZavorthActionCatalog';
import { ZavorthActionGateway } from '../../../src/runtime/actions/ZavorthActionGateway';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';


const ACTION_IDS = [
  'plugins.sdk.status',
  'plugins.sdk.lifecycle',
  'channels.long_tail.status',
  'channels.long_tail.draft',
  'kanban.dispatch_multi_agent',
  'terminal.backends.status',
  'terminal.backends.execute',
  'voice.backends.status',
  'voice.synthesize_live',
  'interop.acp_codex.status',
  'packaging.nix_termux.status',
];

const TOOL_NAMES = [
  'plugins_sdk_status',
  'plugins_sdk_lifecycle',
  'channels_long_tail_status',
  'channels_long_tail_draft',
  'kanban_dispatch_multi_agent',
  'terminal_backends_status',
  'terminal_backends_execute',
  'voice_backends_status',
  'voice_synthesize_live',
  'interop_acp_codex_status',
  'packaging_nix_termux_status',
];

describe('Zavorth productization pack actions', () => {
  it('registers productization actions as verified LLM-facing actions', () => {
    const catalog = new ZavorthActionCatalog();

    for (const actionId of ACTION_IDS) {
      const action = catalog.get(actionId);
      expect(action).toEqual(expect.objectContaining({
        id: actionId,
        verificationStatus: 'verified',
        capabilityId: 'productization-packs',
      }));
      expect(action?.surface).toContain('llm');
    }
  });

  it('exposes productization actions to the Echo LLM tool surface', () => {
    const orchestrator = new ZavorthEchoOrchestrator({
      startBackgroundBridges: false,
      actionGateway: new ZavorthActionGateway(),
    });
    const toolNames = orchestrator.listRegisteredTools().map((tool) => tool.name);

    for (const toolName of TOOL_NAMES) {
      expect(toolNames).toContain(toolName);
    }
  });

  it('keeps mutating productization actions approval-gated', async () => {
    const gateway = new ZavorthActionGateway({ mutationPlane: null });

    for (const actionId of ['plugins.sdk.lifecycle', 'kanban.dispatch_multi_agent', 'terminal.backends.execute', 'voice.synthesize_live']) {
      const result = await gateway.apply(actionId, {
        lifecycle: 'enable',
        task: 'review this repository',
        backend: 'local',
        command: 'npm test',
        text: 'hello',
      });
      expect(result.status).toBe('approval_required');
    }
  });

  it('uses the existing live speech adapter to persist provider audio instead of a planning envelope', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-productization-'));
    const originalFetch = globalThis.fetch;
    process.env.ELEVENLABS_API_KEY = 'test-key';
    process.env.ELEVENLABS_TTS_URL = 'https://elevenlabs.example.test/tts';
    globalThis.fetch = jest.fn(async () => new Response(Buffer.from('fake-mp3-audio'), {
      status: 200,
      headers: { 'content-type': 'audio/mpeg' },
    })) as any;

    try {
      const gateway = new ZavorthActionGateway({ root });
      const synthesized = await gateway.apply('voice.synthesize_live', { text: 'ola mundo', backend: 'elevenlabs' }, {
        trustedOperatorConfirmation: true,
        sourceSurface: 'test',
      });
      expect(synthesized.status).toBe('applied');
      expect(synthesized.data?.liveAudioGenerated).toBe(true);
      expect(String(synthesized.data?.artifactPath)).toContain('.mp3');
      expect(fs.existsSync(String(synthesized.data?.artifactPath))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.ELEVENLABS_API_KEY;
      delete process.env.ELEVENLABS_TTS_URL;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports the shipped NixOS module and Termux installer as packaging artifacts', async () => {
    const root = path.resolve(__dirname, '../../../');
    const gateway = new ZavorthActionGateway({ root });
    const status = await gateway.status('packaging.nix_termux.status');
    expect(status.status).toBe('ok');
    expect(status.data?.nixosModule).toBe(true);
    expect(status.data?.termuxInstaller).toBe(true);
  });
});
