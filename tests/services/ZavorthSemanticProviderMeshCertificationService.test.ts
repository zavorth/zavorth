import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ProviderFactory } from '../../src/providers/ProviderFactory.js';
import { ZavorthSemanticProviderMeshCertificationService } from '../../src/services/ZavorthSemanticProviderMeshCertificationService.js';

describe('ZavorthSemanticProviderMeshCertificationService S3', () => {
  const now = () => new Date('2026-05-05T16:00:00.000Z');
  let tempRoot: string;
  let sourceRoot: string;
  let zavorthRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-semantic-provider-mesh-'));
    sourceRoot = path.join(tempRoot, 'source');
    zavorthRoot = path.join(tempRoot, 'zavorth');
    createFixtureSource(sourceRoot);
    createFixtureZavorth(zavorthRoot);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    ProviderFactory.clearCache();
  });

  it('certifies S3 Provider Mesh semantics without live IO or secret serialization', () => {
    const snapshot = new ZavorthSemanticProviderMeshCertificationService({
      now,
      sourceRoot,
      zavorthRoot,
    }).buildSnapshot();

    expect(snapshot.status).toBe('passed');
    expect(snapshot.semanticPhase).toBe('S3');
    expect(snapshot.providerMeshStatus).toBe('passed');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      semanticClaims: 34,
      gaps: 0,
      packagesCertified: 7,
      adaptersCertified: 6,
      credentialRoutesCertified: 9,
      providerFactoryRoutesCertified: 6,
      credentialScenariosPassed: 3,
      liveIoPerformed: false,
      enabledByDefault: false,
      secretValuesSerialized: false,
      sourceCodeCopied: false,
    }));
    expect(snapshot.summary.receiptBackedClaims).toBe(snapshot.summary.semanticClaims);
    expect(snapshot.summary.adapterStatuses).toEqual(expect.objectContaining({
      'anthropic-direct': 'ready',
      'anthropic-vertex': 'owner_decision_required',
      'bedrock-claude': 'owner_decision_required',
      'google-genai': 'ready',
      'provider-proxy-network': 'ready',
      'local-openai-compatible': 'ready',
    }));
    expect(snapshot.policy).toEqual(expect.objectContaining({
      explicitProviderSelectionRequired: true,
      managedCloudRoutesOwnerGated: true,
      localModelsUseProviderMeshOnly: true,
      noProviderBypass: true,
      noProviderApiSpoofing: true,
      noSecretSerialization: true,
      noLiveIoDuringCertification: true,
    }));
  });

  it('keeps provider package and adapter decisions explicit by semantic status', () => {
    const snapshot = new ZavorthSemanticProviderMeshCertificationService({
      now,
      sourceRoot,
      zavorthRoot,
    }).buildSnapshot();

    expect(packageClaim(snapshot, '@anthropic-ai/sdk')).toEqual(expect.objectContaining({
      status: 'covered',
      priority: 'P0',
    }));
    expect(packageClaim(snapshot, '@aws-sdk/client-bedrock-runtime')).toEqual(expect.objectContaining({
      status: 'covered',
      priority: 'P0',
    }));
    expect(adapterClaim(snapshot, 'anthropic-direct')).toEqual(expect.objectContaining({
      status: 'covered',
      runtimeStatus: 'ready',
    }));
    expect(adapterClaim(snapshot, 'anthropic-vertex')).toEqual(expect.objectContaining({
      status: 'owner-gated',
      runtimeStatus: 'owner_decision_required',
    }));
    expect(adapterClaim(snapshot, 'bedrock-claude')).toEqual(expect.objectContaining({
      status: 'owner-gated',
      runtimeStatus: 'owner_decision_required',
    }));
    expect(adapterClaim(snapshot, 'local-openai-compatible')).toEqual(expect.objectContaining({
      status: 'replaced',
      runtimeStatus: 'ready',
    }));
    expect(snapshot.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'provider-bypass-policy',
        status: 'rejected',
        expectedBehavior: 'The architecture must reject provider API impersonation.',
      }),
      expect.objectContaining({
        kind: 'provider-bypass-policy',
        status: 'rejected',
        expectedBehavior: 'The architecture must reject provider bypass paths.',
      }),
    ]));
  });

  it('certifies credential scenarios and redacts secret values', () => {
    const snapshot = new ZavorthSemanticProviderMeshCertificationService({
      now,
      sourceRoot,
      zavorthRoot,
    }).buildSnapshot();
    const scenarios = Object.fromEntries(snapshot.credentialScenarios.map((scenario) => [scenario.id, scenario]));

    expect(scenarios['missing-api-key']).toEqual(expect.objectContaining({
      status: 'passed',
      providerId: 'anthropic-direct',
      secretValuesSerialized: false,
    }));
    expect(scenarios['configured-api-key-redacted']).toEqual(expect.objectContaining({
      status: 'passed',
      providerId: 'anthropic-direct',
      secretValuesSerialized: false,
    }));
    expect(JSON.stringify(scenarios['configured-api-key-redacted'])).not.toContain('secret-value');
    expect(scenarios['optional-local-route']).toEqual(expect.objectContaining({
      status: 'passed',
      providerId: 'local-openai-compatible',
    }));
    expect(snapshot.claims.filter((claim) => claim.kind === 'credential-route')).toHaveLength(9);
  });

  it('certifies local model and network policy without provider API impersonation', () => {
    const snapshot = new ZavorthSemanticProviderMeshCertificationService({
      now,
      sourceRoot,
      zavorthRoot,
    }).buildSnapshot();

    expect(snapshot.localModelPolicy).toEqual(expect.objectContaining({
      noAnthropicApiImpersonationForLocalModels: true,
      openAiCompatibleRoutes: ['ollama', 'lmstudio', 'vllm', 'custom-openai-compatible'],
    }));
    expect(snapshot.networkPolicy).toEqual(expect.objectContaining({
      noNetworkWithoutProviderSelection: true,
      noSecretValuesInReceipts: true,
    }));
    expect(snapshot.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'local-model-policy',
        status: 'covered',
      }),
      expect.objectContaining({
        kind: 'network-policy',
        status: 'covered',
      }),
    ]));
  });

  it('formats a readable S3 operator summary', () => {
    const service = new ZavorthSemanticProviderMeshCertificationService({
      now,
      sourceRoot,
      zavorthRoot,
    });
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth Semantic Provider Mesh Certification - S3');
    expect(text).toContain('Status: passed');
    expect(text).toContain('Next: S4 - Channel Mesh Semantics');
  });
});

type Snapshot = ReturnType<ZavorthSemanticProviderMeshCertificationService['buildSnapshot']>;

function packageClaim(snapshot: Snapshot, packageName: string) {
  const claim = snapshot.claims.find((entry) =>
    entry.kind === 'package-coverage' && entry.packageName === packageName,
  );
  if (!claim) {
    throw new Error(`missing package claim ${packageName}`);
  }
  return claim;
}

function adapterClaim(snapshot: Snapshot, providerId: string) {
  const claim = snapshot.claims.find((entry) =>
    entry.kind === 'adapter-runtime' && entry.providerId === providerId,
  );
  if (!claim) {
    throw new Error(`missing adapter claim ${providerId}`);
  }
  return claim;
}

function createFixtureSource(root: string): void {
  fs.mkdirSync(path.join(root, 'extensions', 'providers'), { recursive: true });
  writeJson(path.join(root, 'package.json'), {
    name: 'source-fixture',
    dependencies: {
      '@anthropic-ai/sdk': '^0.81.0',
      '@anthropic-ai/vertex-sdk': '^0.16.0',
      '@aws-sdk/client-bedrock-runtime': '^3.900.0',
      '@google/genai': '^1.30.0',
      'proxy-agent': '^6.5.0',
      'https-proxy-agent': '^7.0.6',
      undici: '^7.16.0',
    },
  });
  fs.writeFileSync(path.join(root, 'extensions', 'providers', 'providers.ts'), [
    "import Anthropic from '@anthropic-ai/sdk';",
    "import AnthropicVertex from '@anthropic-ai/vertex-sdk';",
    "import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';",
    "import { GoogleGenAI } from '@google/genai';",
    "import { ProxyAgent } from 'proxy-agent';",
    "import { HttpsProxyAgent } from 'https-proxy-agent';",
    "import { fetch } from 'undici';",
    'export const providers = { Anthropic, AnthropicVertex, BedrockRuntimeClient, GoogleGenAI, ProxyAgent, HttpsProxyAgent, fetch };',
  ].join('\n'));
}

function createFixtureZavorth(root: string): void {
  fs.mkdirSync(path.join(root, 'src', 'adapters', 'providers'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'services'), { recursive: true });
  writeJson(path.join(root, 'package.json'), {
    name: 'zavorth-fixture',
    dependencies: {
      '@anthropic-ai/sdk': '^0.81.0',
      '@anthropic-ai/vertex-sdk': '^0.16.0',
      '@aws-sdk/client-bedrock-runtime': '^3.900.0',
      '@google/genai': '^1.30.0',
      'proxy-agent': '^6.5.0',
      'https-proxy-agent': '^7.0.6',
      undici: '^7.16.0',
    },
  });
  for (const file of [
    'AnthropicDirectProviderAdapter.ts',
    'AnthropicVertexProviderAdapter.ts',
    'BedrockClaudeProviderAdapter.ts',
    'GoogleGenAiProviderAdapter.ts',
  ]) {
    fs.writeFileSync(path.join(root, 'src', 'adapters', 'providers', file), 'export {};');
  }
  fs.writeFileSync(path.join(root, 'src', 'services', 'SourceProviderMeshExpansionService.ts'), 'export {};');
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
