import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { ZavorthAgentKernelSnapshotService } from '../../src/services/ZavorthAgentKernelSnapshotService.js';

describe('ZavorthAgentKernelSnapshotService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-kernel-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('builds a canonical capability passport and LLM context block', () => {
    const home = path.join(root, 'home');
    const service = new ZavorthAgentKernelSnapshotService({
      now: () => new Date('2026-06-02T12:00:00.000Z'),
      env: {
        ZAVORTH_HOME: home,
        OPENAI_API_KEY: 'sk-this-secret-must-not-appear',
      },
      channelMeshService: {
        buildSnapshot: () => channelSnapshotStub(),
      },
      providerActivationService: {
        buildSnapshot: async () => providerActivationStub(),
      },
      profileManifestService: {
        compileProfileById: () => null,
      },
    });

    const snapshot = service.buildSnapshotSync({
      projectRoot: root,
      text: 'mude o skill governance para governed',
      channel: 'cli',
      profileId: 'personal',
      providerActivation: providerActivationStub(),
      modelProfile: {
        providerLabel: 'Gemini',
        modelLabel: 'gemini-2.5-flash',
      },
    });

    expect(snapshot.surface).toBe('agent-kernel-snapshot');
    expect(snapshot.capabilityPassport.install.isolated).toBe(true);
    expect(snapshot.capabilityPassport.providers.routes).toBe(102);
    expect(snapshot.capabilityPassport.providers.needsConnector).toBe(0);
    expect(snapshot.capabilityPassport.channels.total).toBe(3);
    expect(snapshot.intentDecision?.kind).toBe('zavorth_action');
    expect(snapshot.llmContextBlock).toContain('Agent Kernel Snapshot');
    expect(snapshot.llmContextBlock).toContain('routing rule');
    expect(snapshot.llmContextBlock).toContain('Daily Product rule');
    expect(snapshot.quietAutonomy.silentReceipts).toBe(true);
    expect(snapshot.quietAutonomy.rollbackRequired).toBe(true);
    expect(snapshot.quietAutonomy.requireApproval).toEqual(expect.arrayContaining([
      'secret',
      'external_send',
      'host_mutation',
    ]));
    expect(snapshot.llmContextBlock).not.toContain('sk-this-secret');
    expect(snapshot.cleanInstallCertification.status).not.toBe('blocked');
  });

  it('renders a compact text report for CLI/TUI surfaces', () => {
    const service = new ZavorthAgentKernelSnapshotService({
      now: () => new Date('2026-06-02T12:00:00.000Z'),
      env: { ZAVORTH_HOME: path.join(root, 'home') },
      channelMeshService: {
        buildSnapshot: () => channelSnapshotStub(),
      },
      profileManifestService: {
        compileProfileById: () => null,
      },
    });
    const snapshot = service.buildSnapshotSync({
      projectRoot: root,
      text: 'analise todo o repo',
      providerActivation: providerActivationStub(),
    });

    const rendered = service.renderText(snapshot);

    expect(rendered).toContain('[agent-kernel]');
    expect(rendered).toContain('providers routes=102');
    expect(rendered).toContain('Agent Kernel Snapshot');
  });
});

function providerActivationStub(): any {
  return {
    status: 'ready',
    summary: {
      routes: 102,
      executionReady: 102,
      liveReady: 4,
      needsCredentials: 82,
      needsBaseUrl: 5,
      needsConnector: 0,
    },
  };
}

function channelSnapshotStub(): any {
  return {
    generatedAt: '2026-06-02T12:00:00.000Z',
    summary: {
      total: 3,
      ready: 3,
      partial: 0,
      planned: 0,
      disabled: 0,
      configured: 1,
      sessionSendReady: 1,
      attachments: 1,
      groupPolicy: 1,
      liveReady: 1,
      catalogReadyButNotLive: 2,
      defaultRouteAllowed: 1,
    },
    entries: [],
    selected: null,
    featuredIds: [],
    liveCompletion: {
      channelSelectionRequiresLiveProof: true,
      catalogSupportIsNotLiveProof: true,
      sensitiveActionsRequireLiveProof: true,
      liveBridgeRequiresExplicitOperatorAction: true,
      rawSecretsSerialized: false,
      publicApiChannelActionEndpoint: '/api/v1/channels/:id/action',
      defaultRoutingPolicy: 'ready-and-live-proof',
      counts: {
        catalogReady: 3,
        liveReady: 1,
        catalogReadyButNotLive: 2,
        defaultRouteAllowed: 1,
      },
    },
    narrative: {
      headline: 'Channel Mesh ready.',
      operatorSummary: 'Three channels.',
    },
  };
}
