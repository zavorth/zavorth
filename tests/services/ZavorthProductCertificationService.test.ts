import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import {
  ZAVORTH_PRODUCT_CERTIFICATION_VERSION,
} from '../../src/contracts/ZavorthProductCertificationContract.js';
import { ZavorthProductCertificationService } from '../../src/services/ZavorthProductCertificationService.js';

describe('ZavorthProductCertificationService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-product-cert-'));
    seedDocs(root);
    fs.mkdirSync(path.join(root, 'src', 'services'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'services', 'ZavorthAppsSatelliteNodesService.ts'), 'export {}\n', 'utf8');
    fs.writeFileSync(path.join(root, 'src', 'services', 'VoiceWakeRuntimeService.ts'), 'export {}\n', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('builds a product-level certification without claiming missing credentials are failures', async () => {
    const service = new ZavorthProductCertificationService({
      projectRoot: root,
      env: {
        ZAVORTH_HOME: path.join(root, 'home'),
        OPENAI_API_KEY: 'sk-secret-that-must-not-leak',
      },
      now: () => new Date('2026-06-02T12:00:00.000Z'),
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.contractVersion).toBe(ZAVORTH_PRODUCT_CERTIFICATION_VERSION);
    expect(snapshot.surface).toBe('product-certification');
    expect(snapshot.status).not.toBe('blocked');
    expect(snapshot.productLanguage.positioning).toBe('local operating system for AI agents');
    expect(snapshot.gates.map((gate) => gate.id)).toEqual(expect.arrayContaining([
      'agent-kernel',
      'provider-mesh',
      'channel-mesh',
      'channel-live-canary',
      'long-session-smoke',
      'daily-tui',
      'clean-install',
      'quiet-autonomy',
      'satellite-voice',
      'public-docs',
      'release-hygiene',
    ]));
    expect(snapshot.userJourney.some((step) => step.command === 'zavorth ready --product')).toBe(true);
    expect(snapshot.safety).toMatchObject({
      noSilentRiskyMutation: true,
      missingCredentialsAreSetupState: true,
      llmReceivesCanonicalKernelSnapshot: true,
    });
    expect(JSON.stringify(snapshot)).not.toContain('sk-secret');
  });

  it('renders a concise product report for CLI users', async () => {
    const service = new ZavorthProductCertificationService({
      projectRoot: root,
      env: { ZAVORTH_HOME: path.join(root, 'home') },
      now: () => new Date('2026-06-02T12:00:00.000Z'),
    });

    const report = service.renderCli(await service.buildSnapshot());

    expect(report).toContain('Zavorth Product Certification');
    expect(report).toContain('local operating system for AI agents');
    expect(report).toContain('zavorth ready --product');
  });

  it('treats provider mesh as ready when at least one route has live proof and missing credentials are optional expansion', async () => {
    const service = new ZavorthProductCertificationService({
      projectRoot: root,
      env: { ZAVORTH_HOME: path.join(root, 'home') },
      now: () => new Date('2026-06-02T12:00:00.000Z'),
      providerActivation: {
        buildSnapshot: async () => ({
          contractVersion: '2026-05-17.provider-activation.v1',
          schemaVersion: 1,
          surface: 'provider-activation',
          generatedAt: '2026-06-02T12:00:00.000Z',
          status: 'ready',
          summary: {
            routes: 104,
            liveReady: 4,
            executionReady: 104,
            needsCredentials: 83,
            needsBaseUrl: 5,
            needsLiveProof: 17,
            needsConnector: 0,
            nativeAdapters: 16,
            openAiCompatibleAdapters: 72,
            mediaSpecificAdapters: 4,
            localRuntimeAdapters: 12,
            liveProbeAttempted: 4,
            liveProbePassed: 4,
            liveProbeFailed: 0,
            liveProbeBlocked: 0,
          },
          routes: [],
          adapterMatrix: {
            native: [],
            openai_compatible: [],
            aggregator: [],
            local_runtime: [],
            media_specific: [],
            configuration_only: [],
          },
          liveProofPlan: [],
          connectorBacklog: [],
          dashboardProjection: {
            route: '/dashboard',
            endpoint: '/api/providers/activation',
            executionAuthority: false,
            normalRenderMakesNoNetworkCalls: true,
          },
          safety: {
            noRawProviderSecrets: true,
            noHiddenLiveNetworkCalls: true,
            liveProofRequiresExplicitOperatorAction: true,
            nonCompatibleProvidersNeedTypedConnector: true,
            dashboardCannotExecuteProviderCalls: true,
          },
          commands: [],
          nextAction: 'Provider mesh has live proof.',
        }),
      },
    });

    const snapshot = await service.buildSnapshot();
    const gate = snapshot.gates.find((entry) => entry.id === 'provider-mesh');

    expect(gate).toMatchObject({
      status: 'ready',
      nextAction: null,
    });
    expect(gate?.summary).toContain('4 live-proved');
  });
});

function seedDocs(root: string): void {
  const docs = {
    'README.md': 'Zavorth is a local operating system for AI agents.\n',
    'docs/README.md': 'Public docs for installing and operating Zavorth.\n',
    'docs/quickstart.md': 'Run zavorth setup, start and open.\n',
    'docs/security.md': 'Security model.\n',
    'docs/provider-mesh.md': 'Provider setup and readiness.\n',
    'docs/channel-mesh.md': 'Channel setup and readiness.\n',
    'docs/product-certification.md': 'Product Certification checks daily readiness.\n',
  };
  for (const [file, content] of Object.entries(docs)) {
    const fullPath = path.join(root, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }
}
