import {
  ADVANCED_CAPABILITY_IDS,
  ADVANCED_CHANNEL_IDS,
  ADVANCED_CHANNEL_PRIORITY,
  type ZavorthDistributedRuntimeActionSeverity,
  type ZavorthDistributedRuntimeCapabilityCoverage,
  type ZavorthDistributedRuntimeCard,
  type ZavorthDistributedRuntimeFocus,
  type ZavorthDistributedRuntimePosture,
  type ZavorthDistributedRuntimeSnapshot,
  type ZavorthDistributedRuntimeSurfaceEntry,
  type ChannelMeshSnapshot,
  type NodeMeshSnapshot,
  type ZavorthRemoteTransportSnapshot,
  type RuntimeAccessManifest,
} from './ZavorthDistributedRuntimeTypes.js';

export class ZavorthDistributedRuntimeSnapshotBuilder {
  public constructor(private readonly deps: {
    now: () => Date;
    workspaceRoot: string;
  }) {}

  public composeSnapshot(input: {
    selectedId: string | null;
    query: string | null;
    channels: ChannelMeshSnapshot;
    nodes: NodeMeshSnapshot;
    transports: ZavorthRemoteTransportSnapshot;
    manifest: RuntimeAccessManifest;
  }): ZavorthDistributedRuntimeSnapshot {
    const focusId = input.selectedId || input.query;
    const advancedChannels = Array.isArray(input.channels?.entries)
      ? this.prioritizeAdvancedChannels(
        input.channels.entries.filter(entry =>
          ADVANCED_CHANNEL_IDS.has(String(entry?.id || '').trim().toLowerCase())),
      )
      : [];
    const fleetCapabilities = this.buildFleetCapabilityCoverage(input.nodes);
    const surfaces = this.buildSurfaceEntries(input.manifest);
    const focus = this.buildFocus({
      focusId,
      channels: input.channels,
      nodes: input.nodes,
      transports: input.transports,
      surfaces,
    });
    const cards = this.buildCards({
      channels: input.channels,
      nodes: input.nodes,
      transports: input.transports,
      manifest: input.manifest,
      advancedChannels,
      fleetCapabilities,
    });
    const actions = this.buildActions({
      channels: input.channels,
      nodes: input.nodes,
      transports: input.transports,
      manifest: input.manifest,
      advancedChannels,
      fleetCapabilities,
      focus,
    });
    const summary = {
      posture: this.resolvePosture(cards, actions),
      totalChannels: Number(input.channels?.summary?.total || 0) || 0,
      readyChannels: Number(input.channels?.summary?.ready || 0) || 0,
      advancedChannels: advancedChannels.length,
      readyAdvancedChannels: advancedChannels.filter(entry => String(entry?.readiness || '') === 'ready').length,
      channelsWithAttachments: advancedChannels.filter(entry => entry?.features?.attachments).length,
      channelsWithThreads: advancedChannels.filter(entry => entry?.features?.threads).length,
      totalNodes: Number(input.nodes?.summary?.total || 0) || 0,
      pairedNodes: Number(input.nodes?.summary?.paired || 0) || 0,
      onlineNodes: Number(input.nodes?.summary?.online || 0) || 0,
      queuedInvocations: Number(input.nodes?.summary?.queued || 0) || 0,
      staleQueued: Number(input.nodes?.summary?.staleQueued || 0) || 0,
      maintenanceNodes: this.countMaintenanceNodes(input.nodes),
      advancedCapabilityCoverage: fleetCapabilities.filter((entry) => entry.supportedNodes > 0).length,
      advancedCapabilityTargets: fleetCapabilities.reduce((sum, entry) => sum + entry.supportedNodes, 0),
      totalTransports: Number(input.transports?.summary?.total || 0) || 0,
      readyTransports: Number(input.transports?.summary?.ready || 0) || 0,
      liveTransports: Number(input.transports?.summary?.live || 0) || 0,
      transportAttention: Number(input.transports?.summary?.attentionRequired || 0) || 0,
      totalSurfaces: surfaces.length,
      readySurfaces: surfaces.filter((entry) => entry.ready).length,
      primarySurfaceReady: surfaces.find((entry) => entry.primary)?.ready !== false,
      remoteReady: Boolean(input.manifest?.remote?.ready),
      warnings: Array.isArray(input.manifest?.warnings) ? input.manifest.warnings.length : 0,
      implementationReady: true,
      infrastructureState: this.resolveInfrastructureState(input.nodes, input.transports),
      infrastructureOfflineReason: this.resolveInfrastructureOfflineReason(input.nodes, input.transports),
    };

    return {
      generatedAt: this.deps.now().toISOString(),
      workspaceRoot: this.deps.workspaceRoot,
      selectedId: input.selectedId,
      query: input.query,
      focus,
      summary,
      cards,
      actions,
      advancedChannels,
      fleetCapabilities,
      surfaces,
      sourceSnapshots: {
        channels: input.channels,
        nodes: input.nodes,
        transports: input.transports,
        manifest: input.manifest,
      },
      narrative: {
        headline: 'Distributed runtime: distributed runtime and advanced surfaces',
        operatorSummary: this.buildOperatorSummary(summary, focus),
        nextAction: actions[0]?.label || 'review runtime channels, fleet, transports, and surfaces.',
      },
    };
  }

  public renderReport(snapshot: ZavorthDistributedRuntimeSnapshot): string {
    const lines = [
      'Distributed runtime: distributed runtime and advanced surfaces',
      '',
      snapshot.narrative.operatorSummary,
      `Postura: ${snapshot.summary.posture}.`,
      `Channels: ${snapshot.summary.readyChannels}/${snapshot.summary.totalChannels} ready | advanced ${snapshot.summary.readyAdvancedChannels}/${snapshot.summary.advancedChannels} | attachments ${snapshot.summary.channelsWithAttachments} | threads ${snapshot.summary.channelsWithThreads}.`,
      `Fleet: ${snapshot.summary.onlineNodes}/${snapshot.summary.totalNodes} online | paired ${snapshot.summary.pairedNodes} | queue ${snapshot.summary.queuedInvocations} | stale ${snapshot.summary.staleQueued} | advanced capability coverage ${snapshot.summary.advancedCapabilityCoverage}/${ADVANCED_CAPABILITY_IDS.length}.`,
      `Transports: ${snapshot.summary.readyTransports}/${snapshot.summary.totalTransports} ready | live ${snapshot.summary.liveTransports} | attention ${snapshot.summary.transportAttention}.`,
      `Surfaces: ${snapshot.summary.readySurfaces}/${snapshot.summary.totalSurfaces} ready | primaria ${snapshot.summary.primarySurfaceReady ? 'ok' : 'pending'} | remote ${snapshot.summary.remoteReady ? 'ok' : 'pending'}.`,
      `Implementation distribuida: ${snapshot.summary.implementationReady ? 'ready' : 'pending'} | infra ${snapshot.summary.infrastructureState}${snapshot.summary.infrastructureOfflineReason ? ` | ${snapshot.summary.infrastructureOfflineReason}` : ''}.`,
    ];

    if (snapshot.focus.kind && snapshot.focus.label) {
      lines.push(
        '',
        `Foco current: ${snapshot.focus.label} [${snapshot.focus.kind}]`,
        snapshot.focus.summary || 'without additional summary.',
        snapshot.focus.nextAction ? `next passo: ${snapshot.focus.nextAction}` : 'without next passo especifico.',
      );
    }

    lines.push(
      '',
      'Cards operacionais:',
      ...snapshot.cards.map((entry) =>
        `- ${entry.label}: ${entry.posture} | ${entry.summary}${entry.command ? ` | ${entry.command}` : ''}`),
    );

    if (snapshot.actions.length > 0) {
      lines.push(
        '',
        'Actions sugeridas:',
        ...snapshot.actions.map((entry) =>
          `- ${entry.label}: ${entry.reason}${entry.command ? ` | ${entry.command}` : ''}`),
      );
    }

    if (snapshot.advancedChannels.length > 0) {
      lines.push(
        '',
        'Advanced channels:',
        ...snapshot.advancedChannels.slice(0, 6).map(entry =>
          `- ${this.text(entry?.label, entry?.id || 'channel')}: ${this.text(entry?.readiness, 'unknown')} | ${this.text(entry?.summary, 'without summary.')}`),
      );
    }

    if (snapshot.fleetCapabilities.length > 0) {
      lines.push(
        '',
        'Capabilities da fleet:',
        ...snapshot.fleetCapabilities.map((entry) =>
          `- ${entry.label}: ${entry.supportedNodes} node(s) | ${entry.category}${entry.risky ? ' | sensitive' : ''}`),
      );
    }

    return lines.join('\n');
  }

  public buildFallbackManifest(): RuntimeAccessManifest {
    return {
      generatedAt: this.deps.now().toISOString(),
      summary: 'Manifest unavailable; using minimal fallback.',
      local: {
        ready: false,
        baseUrl: '',
        appUrl: '',
        zavorthControlUrl: '',
        apiBaseUrl: '',
        controlUrl: '',
        legacyAppUrl: null,
        classicUrl: null,
      },
      remote: {
        ready: false,
        baseUrl: null,
        appUrl: null,
        requiresHttps: false,
        controlUrl: null,
        legacyAppUrl: null,
        classicUrl: null,
      },
      auth: {
        required: false,
        source: 'missing',
        tokenFile: '',
        authorizedHost: null,
      },
      officialRemote: {
        ready: false,
        summary: 'Official remote access not available.',
        recommendedProvider: null,
        recommendedAction: null,
        appUrl: null,
        baseUrl: null,
        issues: [],
        nextSteps: [],
        command: '',
      },
      commands: {
        go: 'npm run ops:go',
        remoteGo: 'npm run ops:remote:go',
        install: '',
        launcher: '',
        startupLauncher: '',
        startupLauncherRemove: '',
        bootstrap: '',
        journey: '',
        channels: '',
        ready: '',
        start: '',
        access: '',
        remote: '',
        manifest: '',
        trust: '',
      },
      launchers: [],
      journey: [],
      surfaces: [
        {
          id: 'control',
          label: 'ZavorthControl',
          surface: 'web',
          primary: true,
          ready: false,
          entry: 'http://127.0.0.1:33333/zavorthControl',
          remoteEntry: null,
          description: 'Manifest unavailable; default surface not yet confirmed.',
        },
      ],
      guides: {
        local: [],
        remote: [],
      },
      legacyContainment: {
        contractVersion: 'legacy-surface-containment-v1',
        canonicalEntry: '/zavorthControl',
        frozenSurfaces: [],
        retiredSurfaces: ['/app', '/classic'],
        generatedAt: this.deps.now().toISOString(),
        summary: 'Legacy containment active with canonical /zavorthControl entry.',
        consolidation: {
          phase: 'legacy-contained',
          canonicalDocs: [],
          rule: 'All legacy features redirected to gateway contract, control plane, or zavorthControl.',
        },
        surfaces: [],
        policy: {
          productFeaturesMustLandIn: ['gateway contract', 'control plane', 'zavorthControl'],
          legacyFeatureFreeze: false,
          legacyRoutesRetired: true,
          compatibilityPreserved: false,
          fallbackPreserved: false,
        },
        links: {
          localControlUrl: '',
          localZavorthControlUrl: '',
          localLegacyAppUrl: null,
          localClassicUrl: null,
          remoteControlUrl: null,
          remoteZavorthControlUrl: null,
          remoteLegacyAppUrl: null,
          remoteClassicUrl: null,
        },
      },
      warnings: ['Access manifest unavailable at the moment.'],
      nextSteps: [],
    };
  }

  private buildCards(input: {
    channels: ChannelMeshSnapshot;
    nodes: NodeMeshSnapshot;
    transports: ZavorthRemoteTransportSnapshot;
    manifest: RuntimeAccessManifest;
    advancedChannels: ChannelMeshSnapshot['entries'];
    fleetCapabilities: ZavorthDistributedRuntimeCapabilityCoverage[];
  }): ZavorthDistributedRuntimeCard[] {
    const channelPosture = this.resolveChannelPosture(input.channels, input.advancedChannels);
    const nodePosture = this.resolveFleetPosture(input.nodes, input.fleetCapabilities);
    const transportPosture = this.resolveTransportPosture(input.transports);
    const surfacePosture = this.resolveSurfacePosture(input.manifest);
    const readyAdvancedChannels = input.advancedChannels.filter(entry => String(entry?.readiness || '') === 'ready').length;
    const advancedCoverage = input.fleetCapabilities.filter((entry) => entry.supportedNodes > 0).length;

    return [
      {
        id: 'channels',
        label: 'Advanced Channel Mesh',
        posture: channelPosture,
        summary:
          `${readyAdvancedChannels}/${input.advancedChannels.length} advanced channel(s) ready, `
          + `${Number(input.channels?.summary?.ready || 0) || 0}/${Number(input.channels?.summary?.total || 0) || 0} ready in the general contract.`,
        nextAction: this.pickChannelNextAction(input.advancedChannels),
        command: '/channels',
      },
      {
        id: 'fleet',
        label: 'Fleet e capabilities',
        posture: nodePosture,
        summary:
          `${Number(input.nodes?.summary?.online || 0) || 0}/${Number(input.nodes?.summary?.total || 0) || 0} node(s) online, `
          + `queue ${Number(input.nodes?.summary?.queued || 0) || 0}, stale ${Number(input.nodes?.summary?.staleQueued || 0) || 0}, `
          + `advanced capabilities ${advancedCoverage}/${ADVANCED_CAPABILITY_IDS.length}.`,
        nextAction: this.pickFleetNextAction(input.nodes, input.fleetCapabilities),
        command: '/nodes',
      },
      {
        id: 'transports',
        label: 'Remote transports',
        posture: transportPosture,
        summary:
          `${Number(input.transports?.summary?.ready || 0) || 0}/${Number(input.transports?.summary?.total || 0) || 0} ready, `
          + `${Number(input.transports?.summary?.live || 0) || 0} live, `
          + `${Number(input.transports?.summary?.attentionRequired || 0) || 0} needing attention.`,
        nextAction: this.pickTransportNextAction(input.transports),
        command: '/transports',
      },
      {
        id: 'surfaces',
        label: 'surfaces oficiais',
        posture: surfacePosture,
        summary:
          `${this.countReadySurfaces(input.manifest)}/${this.countTotalSurfaces(input.manifest)} ready, `
          + `primaria ${this.resolvePrimarySurfaceReady(input.manifest) ? 'ok' : 'pending'}, `
          + `remote ${input.manifest?.remote?.ready ? 'ok' : 'pending'}.`,
        nextAction: this.pickSurfaceNextAction(input.manifest),
        command: '/access',
      },
    ];
  }

  private buildActions(input: {
    channels: ChannelMeshSnapshot;
    nodes: NodeMeshSnapshot;
    transports: ZavorthRemoteTransportSnapshot;
    manifest: RuntimeAccessManifest;
    advancedChannels: ChannelMeshSnapshot['entries'];
    fleetCapabilities: ZavorthDistributedRuntimeCapabilityCoverage[];
    focus: ZavorthDistributedRuntimeFocus;
  }): Array<{
    id: string;
    label: string;
    severity: ZavorthDistributedRuntimeActionSeverity;
    command: string | null;
    reason: string;
  }> {
    const actions: Array<{
      id: string;
      label: string;
      severity: ZavorthDistributedRuntimeActionSeverity;
      command: string | null;
      reason: string;
    }> = [];

    const pendingAdvancedChannel = this.prioritizeAdvancedChannels(input.advancedChannels)
      .find(entry => this.isActionableAdvancedChannel(entry));
    if (pendingAdvancedChannel) {
      actions.push({
        id: 'advanced-channel-prepare',
        label: `Prepare ${this.text(pendingAdvancedChannel?.label, pendingAdvancedChannel?.id || 'channel')}`,
        severity: 'warn',
        command: this.firstActionCommand(pendingAdvancedChannel, 'prepare') || `/channels prepare ${pendingAdvancedChannel.id}`,
        reason: this.text(
          pendingAdvancedChannel?.operatorNextStep,
          pendingAdvancedChannel?.actionHint || 'An advanced mesh-known channel still lacks real readiness.',
        ),
      });
    }

    if ((Number(input.nodes?.summary?.total || 0) || 0) === 0) {
      actions.push({
        id: 'pair-first-node',
        label: 'Parear o primeiro node host',
        severity: 'warn',
        command: '/nodepair',
        reason: 'The distributed mesh has no visible node for remote capabilities yet.',
      });
    } else if ((Number(input.nodes?.summary?.staleQueued || 0) || 0) > 0) {
      actions.push({
        id: 'repair-node-queue',
        label: 'review queue antiga do Node Mesh',
        severity: 'warn',
        command: '/nodes',
        reason:
          `${Number(input.nodes?.summary?.staleQueued || 0) || 0} item(s) old ainda pedem maintenance ou release manual na fleet.`,
      });
    } else if (input.fleetCapabilities.filter((entry) => entry.supportedNodes > 0).length < 3) {
      actions.push({
        id: 'expand-fleet-capabilities',
        label: 'Ampliar capabilities da fleet',
        severity: 'info',
        command: '/nodes',
        reason: 'The fleet still covers too few advanced capabilities for browser, screen, file watch, and notifications.',
      });
    }

    const transportAction = Array.isArray(input.transports?.suggestedActions) ? input.transports.suggestedActions[0] : null;
    if ((Number(input.transports?.summary?.attentionRequired || 0) || 0) > 0) {
      actions.push({
        id: 'transport-attention',
        label: this.text(transportAction?.label, 'review remote transports'),
        severity: 'warn',
        command: this.nullableText(transportAction?.command) || '/transports',
        reason: this.text(
          transportAction?.reason,
          'At least one bridge, sidecar, or remote node-host needs attention before expanding rollout.',
        ),
      });
    }

    if (!input.manifest?.remote?.ready) {
      actions.push({
        id: 'remote-rollout',
        label: 'Fechar rollout remote oficial',
        severity: 'info',
        command: this.text(input.manifest?.commands?.remoteGo, 'npm run ops:remote:go'),
        reason: 'Official surfaces do not have fully validated official remote access yet.',
      });
    }

    if (input.focus.kind && input.focus.nextAction) {
      actions.unshift({
        id: 'focus-next-step',
        label: `Aprofundar ${input.focus.label || input.focus.id || input.focus.kind}`,
        severity: 'info',
        command: this.focusCommand(input.focus),
        reason: input.focus.nextAction,
      });
    }

    return actions.slice(0, 6);
  }

  private buildFleetCapabilityCoverage(nodes: NodeMeshSnapshot): ZavorthDistributedRuntimeCapabilityCoverage[] {
    const entries = Array.isArray(nodes?.entries) ? nodes.entries : [];
    const catalog = Array.isArray(nodes?.capabilityCatalog) ? nodes.capabilityCatalog : [];
    return ADVANCED_CAPABILITY_IDS.map((capabilityId) => {
      const descriptor = catalog.find(entry =>
        String(entry?.id || '').trim().toLowerCase() === capabilityId.toLowerCase())
        || this.buildFallbackCapabilityDescriptor(capabilityId);
      const supportedNodes = entries.filter(entry =>
        Array.isArray(entry?.capabilityIds)
        && entry.capabilityIds.some((item: string) => String(item || '').trim().toLowerCase() === capabilityId.toLowerCase()))
        .length;
      return {
        id: capabilityId,
        label: this.text(descriptor?.label, capabilityId),
        category: this.text(descriptor?.category, 'misc'),
        risky: Boolean(descriptor?.risky),
        supportedNodes,
        actionHint: this.nullableText(descriptor?.actionHint),
      };
    });
  }

  private buildSurfaceEntries(manifest: RuntimeAccessManifest): ZavorthDistributedRuntimeSurfaceEntry[] {
    const surfaces = Array.isArray(manifest?.surfaces) ? manifest.surfaces : [];
    return surfaces.map(entry => ({
      id: this.text(entry?.id, 'surface'),
      label: this.text(entry?.label, entry?.id || 'Surface'),
      primary: Boolean(entry?.primary),
      ready: Boolean(entry?.ready),
      surface: this.text(entry?.surface, 'unknown'),
      entry: this.text(entry?.entry, 'n/d'),
      remoteEntry: this.nullableText(entry?.remoteEntry),
      description: this.text(entry?.description, 'without descricao.'),
    }));
  }

  private buildFocus(input: {
    focusId: string | null;
    channels: ChannelMeshSnapshot;
    nodes: NodeMeshSnapshot;
    transports: ZavorthRemoteTransportSnapshot;
    surfaces: ZavorthDistributedRuntimeSurfaceEntry[];
  }): ZavorthDistributedRuntimeFocus {
    const target = this.nullableText(input.focusId);
    if (!target) {
      return {
        kind: null,
        id: null,
        label: null,
        summary: null,
        nextAction: null,
      };
    }
    const normalizedTarget = target.toLowerCase();
    const channel = Array.isArray(input.channels?.entries)
      ? input.channels.entries.find(entry =>
          this.matchesFocus(entry?.id, entry?.label, normalizedTarget))
      : null;
    if (channel) {
      return {
        kind: 'channel',
        id: this.nullableText(channel.id),
        label: this.nullableText(channel.label),
        summary: this.nullableText(channel.summary || channel.operatorSummary),
        nextAction: this.nullableText(channel.operatorNextStep || channel.actionHint),
      };
    }
    const node = Array.isArray(input.nodes?.entries)
      ? input.nodes.entries.find(entry =>
          this.matchesFocus(entry?.id, entry?.label, normalizedTarget))
      : null;
    if (node) {
      return {
        kind: 'node',
        id: this.nullableText(node.id),
        label: this.nullableText(node.label),
        summary: this.nullableText(node.trustLabel || node.nextAction),
        nextAction: this.nullableText(node.nextAction),
      };
    }
    const transport = Array.isArray(input.transports?.entries)
      ? input.transports.entries.find(entry =>
          this.matchesFocus(entry?.id, entry?.label, normalizedTarget))
      : null;
    if (transport) {
      return {
        kind: 'transport',
        id: this.nullableText(transport.id),
        label: this.nullableText(transport.label),
        summary: this.nullableText(transport.operatorSummary),
        nextAction: this.nullableText(transport.actionHint),
      };
    }
    const surface = input.surfaces.find((entry) => this.matchesFocus(entry.id, entry.label, normalizedTarget));
    if (surface) {
      return {
        kind: 'surface',
        id: surface.id,
        label: surface.label,
        summary: surface.description,
        nextAction: surface.remoteEntry || surface.entry,
      };
    }
    return {
      kind: null,
      id: null,
      label: null,
      summary: null,
      nextAction: null,
    };
  }

  private buildOperatorSummary(
    summary: ZavorthDistributedRuntimeSnapshot['summary'],
    focus: ZavorthDistributedRuntimeFocus,
  ): string {
    const focusPart = focus.kind && focus.label ? ` Foco current em ${focus.label} (${focus.kind}).`
      : '';
    return `${summary.readyChannels}/${summary.totalChannels} channel(s) ready, `
      + `${summary.onlineNodes}/${summary.totalNodes} node(s) online, `
      + `${summary.readyTransports}/${summary.totalTransports} transport(es) ready e `
      + `${summary.readySurfaces}/${summary.totalSurfaces} surface(s) oficial(is) ready.`
      + ` Advanced capability coverage ${summary.advancedCapabilityCoverage}/${ADVANCED_CAPABILITY_IDS.length}.`
      + ` remote ${summary.remoteReady ? 'ready' : 'pending'}.${focusPart}`;
  }

  private resolveChannelPosture(channels: ChannelMeshSnapshot, advancedChannels: ChannelMeshSnapshot['entries']): ZavorthDistributedRuntimePosture {
    const ready = Number(channels?.summary?.ready || 0) || 0;
    const total = Number(channels?.summary?.total || 0) || 0;
    const pendingAdvanced = advancedChannels.filter(entry => this.isActionableAdvancedChannel(entry)).length;
    if (total > 0 && ready === 0) {
      return 'critical';
    }
    if (pendingAdvanced > 0 || (Number(channels?.summary?.partial || 0) || 0) > 0) {
      return 'attention';
    }
    return 'healthy';
  }

  private resolveFleetPosture(
    nodes: NodeMeshSnapshot,
    fleetCapabilities: ZavorthDistributedRuntimeCapabilityCoverage[],
  ): ZavorthDistributedRuntimePosture {
    const total = Number(nodes?.summary?.total || 0) || 0;
    const paired = Number(nodes?.summary?.paired || 0) || 0;
    const online = Number(nodes?.summary?.online || 0) || 0;
    const stale = Number(nodes?.summary?.staleQueued || 0) || 0;
    const coverage = fleetCapabilities.filter((entry) => entry.supportedNodes > 0).length;
    if (paired > 0 && online === 0) {
      return 'critical';
    }
    if (total === 0 || stale > 0 || coverage < 3) {
      return 'attention';
    }
    return 'healthy';
  }

  private resolveTransportPosture(transports: ZavorthRemoteTransportSnapshot): ZavorthDistributedRuntimePosture {
    const total = Number(transports?.summary?.total || 0) || 0;
    const ready = Number(transports?.summary?.ready || 0) || 0;
    const attention = Number(transports?.summary?.attentionRequired || 0) || 0;
    if (total > 0 && ready === 0 && attention > 0) {
      return 'critical';
    }
    if (attention > 0 || (Number(transports?.summary?.partial || 0) || 0) > 0) {
      return 'attention';
    }
    return 'healthy';
  }

  private resolveSurfacePosture(manifest: RuntimeAccessManifest): ZavorthDistributedRuntimePosture {
    const total = this.countTotalSurfaces(manifest);
    const ready = this.countReadySurfaces(manifest);
    if (total > 0 && ready === 0) {
      return 'critical';
    }
    if (!this.resolvePrimarySurfaceReady(manifest) || !manifest?.remote?.ready) {
      return 'attention';
    }
    return 'healthy';
  }

  private resolvePosture(
    cards: ZavorthDistributedRuntimeCard[],
    actions: Array<{ severity: ZavorthDistributedRuntimeActionSeverity }>,
  ): ZavorthDistributedRuntimePosture {
    if (cards.some((entry) => entry.posture === 'critical')) {
      return 'critical';
    }
    if (
      cards.some((entry) => entry.posture === 'attention')
      || actions.some((entry) => entry.severity === 'warn' || entry.severity === 'critical')
    ) {
      return 'attention';
    }
    return 'healthy';
  }

  private resolveInfrastructureState(nodes: NodeMeshSnapshot, transports: ZavorthRemoteTransportSnapshot): 'mesh_online' | 'offline' | 'dormant' {
    const onlineNodes = Number(nodes?.summary?.online || 0) || 0;
    const pairedNodes = Number(nodes?.summary?.paired || 0) || 0;
    const liveTransports = Number(transports?.summary?.live || 0) || 0;
    if (onlineNodes > 0 || liveTransports > 0) {
      return 'mesh_online';
    }
    if (pairedNodes > 0 || (Number(transports?.summary?.partial || 0) || 0) > 0) {
      return 'offline';
    }
    return 'dormant';
  }

  private resolveInfrastructureOfflineReason(nodes: NodeMeshSnapshot, transports: ZavorthRemoteTransportSnapshot): string | null {
    const state = this.resolveInfrastructureState(nodes, transports);
    if (state === 'mesh_online') {
      return null;
    }
    if (state === 'offline') {
      return 'Implementation ready, but paired nodes/transports do not have heartbeat/live right now.';
    }
    return 'implementation ready, mas nenhum node/transport remote foi ligado in this environment.';
  }

  private pickChannelNextAction(advancedChannels: ChannelMeshSnapshot['entries']): string {
    const prioritized = this.prioritizeAdvancedChannels(advancedChannels);
    const next = prioritized.find(entry => this.isActionableAdvancedChannel(entry)) || prioritized[0];
    return this.text(
      next?.operatorNextStep,
      next?.actionHint || 'review channels advanced sob o mesmo contrato canonical.',
    );
  }

  private isActionableAdvancedChannel(entry: ChannelMeshSnapshot['entries'][number]): boolean {
    return this.text(entry?.readiness, 'planned') === 'partial';
  }

  private prioritizeAdvancedChannels(entries: ChannelMeshSnapshot['entries']): ChannelMeshSnapshot['entries'] {
    return [...entries].sort((left, right) => {
      const leftReadiness = this.text(left?.readiness, 'planned');
      const rightReadiness = this.text(right?.readiness, 'planned');
      const leftReadinessRank = leftReadiness === 'partial' ? 0 : leftReadiness === 'ready' ? 1 : leftReadiness === 'planned' ? 2 : 3;
      const rightReadinessRank = rightReadiness === 'partial' ? 0 : rightReadiness === 'ready' ? 1 : rightReadiness === 'planned' ? 2 : 3;
      if (leftReadinessRank !== rightReadinessRank) {
        return leftReadinessRank - rightReadinessRank;
      }
      const leftPriority = ADVANCED_CHANNEL_PRIORITY[this.text(left?.id, '').toLowerCase()] ?? 99;
      const rightPriority = ADVANCED_CHANNEL_PRIORITY[this.text(right?.id, '').toLowerCase()] ?? 99;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return this.text(left?.label, left?.id || '').localeCompare(this.text(right?.label, right?.id || ''), 'en-US');
    });
  }

  private pickFleetNextAction(nodes: NodeMeshSnapshot, fleetCapabilities: ZavorthDistributedRuntimeCapabilityCoverage[]): string {
    if ((Number(nodes?.summary?.total || 0) || 0) === 0) {
      return 'Pair a node host to enable browser, screen, file watch, and notifications in the mesh.';
    }
    if ((Number(nodes?.summary?.staleQueued || 0) || 0) > 0) {
      return 'Execute maintenance ou release da queue antiga before ampliar a fleet.';
    }
    const missing = fleetCapabilities.filter((entry) => entry.supportedNodes === 0).map((entry) => entry.label);
    if (missing.length > 0) {
      return `Close coverage for remaining capabilities: ${missing.slice(0, 3).join(', ')}.`;
    }
    return 'The current fleet already covers the main advanced runtime set.';
  }

  private pickTransportNextAction(transports: ZavorthRemoteTransportSnapshot): string {
    const next = Array.isArray(transports?.suggestedActions) ? transports.suggestedActions[0] : null;
    return this.text(next?.reason, 'review remote bridges, sidecars, and node-hosts in the same operational plane.');
  }

  private pickSurfaceNextAction(manifest: RuntimeAccessManifest): string {
    if (!manifest?.remote?.ready) {
      return 'Fechar o rollout remote oficial para abrir o mesmo cockpit outside do host local.';
    }
    return 'The official surfaces already tell the same distributed-runtime story.';
  }

  private countMaintenanceNodes(nodes: NodeMeshSnapshot): number {
    return Array.isArray(nodes?.entries)
      ? nodes.entries.filter(entry =>
          Array.isArray(entry?.capabilityIds)
          && entry.capabilityIds.some((capabilityId: string) => String(capabilityId || '').trim() === 'node.maintenance'))
        .length
      : 0;
  }

  private countReadySurfaces(manifest: RuntimeAccessManifest): number {
    return Array.isArray(manifest?.surfaces)
      ? manifest.surfaces.filter(entry => Boolean(entry?.ready)).length
      : 0;
  }

  private countTotalSurfaces(manifest: RuntimeAccessManifest): number {
    return Array.isArray(manifest?.surfaces) ? manifest.surfaces.length : 0;
  }

  private resolvePrimarySurfaceReady(manifest: RuntimeAccessManifest): boolean {
    const primary = Array.isArray(manifest?.surfaces)
      ? manifest.surfaces.find(entry => Boolean(entry?.primary))
      : null;
    return primary ? Boolean(primary.ready) : false;
  }

  private buildFallbackCapabilityDescriptor(capabilityId: string): {
    id: string;
    label: string;
    category: string;
    risky: boolean;
    actionHint: string;
  } {
    return {
      id: capabilityId,
      label: capabilityId,
      category: 'misc',
      risky: /write|camera|clipboard|location/i.test(capabilityId),
      actionHint: 'Capability not cataloged in core yet; review the node declaration.',
    };
  }

  private firstActionCommand(
    entry: { actions?: Array<{ kind?: string; command?: string }> } | null | undefined,
    kind: string,
  ): string | null {
    const action = Array.isArray(entry?.actions)
      ? entry.actions.find(item => String(item?.kind || '').trim().toLowerCase() === kind.toLowerCase())
      : null;
    return this.nullableText(action?.command);
  }

  private focusCommand(focus: ZavorthDistributedRuntimeFocus): string | null {
    if (!focus.kind || !focus.id) {
      return null;
    }
    switch (focus.kind) {
      case 'channel':
        return `/channels ${focus.id}`;
      case 'node':
        return `/nodes ${focus.id}`;
      case 'transport':
        return `/transports ${focus.id}`;
      case 'surface':
        return '/access';
      default:
        return null;
    }
  }

  private matchesFocus(id: unknown, label: unknown, target: string): boolean {
    const normalizedId = String(id || '').trim().toLowerCase();
    const normalizedLabel = String(label || '').trim().toLowerCase();
    return normalizedId === target || normalizedLabel === target || normalizedLabel.includes(target);
  }

  private text(value: unknown, fallback: string): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }

  private nullableText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }
}
