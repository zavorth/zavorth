import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { ZavorthRuntimeStateBusService } = await import(pathToFileURL(join(root, 'src/services/ZavorthRuntimeStateBusService.ts')).href);
const { ZavorthRuntimeCapabilitiesService } = await import(pathToFileURL(join(root, 'src/services/ZavorthRuntimeCapabilitiesService.ts')).href);
const { ZavorthProviderSetupService } = await import(pathToFileURL(join(root, 'src/services/ZavorthProviderSetupService.ts')).href);
const { ZavorthWorkspaceKnowledgeService } = await import(pathToFileURL(join(root, 'src/services/ZavorthWorkspaceKnowledgeService.ts')).href);

const tempDir = join(tmpdir(), `zavorth-product-e2e-${Date.now()}`);
const persistPath = join(tempDir, 'runtime-state.json');
mkdirSync(tempDir, { recursive: true });
const now = () => new Date('2026-06-10T20:30:00.000Z');

try {
  const bus = new ZavorthRuntimeStateBusService({ now, stateFilePath: persistPath, allowedWorkspaceRoots: [root] });
  const providers = new ZavorthProviderSetupService();
  const knowledgeService = new ZavorthWorkspaceKnowledgeService();

  const providerConnection = providers.toRuntimeConnection({
    providerId: 'openai',
    credentialRef: 'secret-ref:providers.openai.apiKey',
    allowDefaultRoute: true,
  });
  const providerResult = bus.dispatch({
    type: 'set-provider-connection',
    source: 'product-e2e',
    approved: true,
    payload: { providerConnection },
  });
  assert.equal(providerResult.ok, true);

  const routeResult = bus.dispatch({
    type: 'route-model',
    source: 'product-e2e',
    approved: true,
    connectedModelIds: ['openai:gpt-4.1'],
    payload: {
      dynamicRouting: {
        modelId: 'openai:gpt-4.1',
        providerId: 'openai',
        specId: 'coding',
        reason: 'Product E2E selected coding model from connected provider.',
      },
    },
  });
  assert.equal(routeResult.ok, true);

  const workspace = {
    id: 'zavorth',
    label: 'Zavorth',
    kind: 'project',
    path: root,
    confinement: 'project',
    locked: true,
  };
  const knowledge = knowledgeService.build({
    workspace,
    sources: [
      { id: 'readme', kind: 'document', label: 'README', path: join(root, 'README.md'), trusted: true },
      { id: 'web-note', kind: 'web', label: 'External planning page', trusted: true },
    ],
  });
  const knowledgeResult = bus.dispatch({
    type: 'set-workspace',
    source: 'product-e2e',
    approved: true,
    payload: { workspace },
  });
  assert.equal(knowledgeResult.ok, true);
  const ragResult = bus.dispatch({
    type: 'set-workspace-knowledge',
    source: 'product-e2e',
    approved: true,
    payload: { workspaceKnowledge: knowledge },
  });
  assert.equal(ragResult.ok, true);

  const skillResult = bus.dispatch({
    type: 'skill-lifecycle',
    source: 'product-e2e',
    approved: true,
    payload: {
      skill: {
        id: 'native:write-file',
        name: 'Write file',
        source: 'native',
        status: 'executing',
        lastReceiptId: null,
      },
    },
  });
  assert.equal(skillResult.ok, true);

  const streamResult = bus.dispatch({
    type: 'resume-stream',
    source: 'product-e2e',
    approved: true,
    payload: {
      streamSession: {
        sessionId: 'session-product-e2e',
        status: 'resumable',
        resumeToken: 'resume-product-e2e',
      },
    },
  });
  assert.equal(streamResult.ok, true);

  const capabilities = new ZavorthRuntimeCapabilitiesService({ now, runtimeStateBus: bus }).buildSnapshot();
  assert.equal(capabilities.providers.selectedModelId, 'openai:gpt-4.1');
  assert.equal(capabilities.workspace.id, 'zavorth');
  assert.equal(capabilities.workspaceKnowledge.ragSources.length, 2);
  assert.equal(capabilities.workspaceKnowledge.ragSources.find(source => source.id === 'web-note')?.trusted, false);
  assert.equal(capabilities.streamSession.resumable, true);

  writeFileSync(persistPath, JSON.stringify(bus.buildSnapshot(), null, 2));
  const restored = new ZavorthRuntimeStateBusService({ now, stateFilePath: persistPath, allowedWorkspaceRoots: [root] }).buildSnapshot();
  assert.equal(restored.projections.commandBar.selectedModelId, 'openai:gpt-4.1');
  assert.equal(restored.projections.workspaceKnowledge.workspaceId, 'zavorth');

  console.log(JSON.stringify({
    status: 'pass',
    checked: [
      'provider-setup',
      'model-route',
      'workspace-scope',
      'rag-untrusted-wrapping',
      'skill-lifecycle',
      'stream-resume',
      'runtime-restore',
    ],
  }, null, 2));
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
