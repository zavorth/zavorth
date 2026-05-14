import type { CapabilityImportManifest } from '../contracts/CapabilityImportContract.js';
import {
  CAPABILITY_PACK_CATALOG_CONTRACT_VERSION,
  type CapabilityPackCatalogQuery,
  type CapabilityPackCatalogSnapshot,
  type CapabilityPackCategory,
  type CapabilityPackDefinition,
} from '../contracts/CapabilityPackCatalogContract.js';

export type ZavorthCapabilityPackCatalogRuntime = {
  now?: () => Date;
  packs?: CapabilityPackDefinition[];
};

const OFFICIAL_CAPABILITY_PACKS: CapabilityPackDefinition[] = [
  {
    id: 'official-communication-channels',
    label: 'Communication Channels',
    summary: 'Governed chat and notification channels for human-facing workflows.',
    category: 'channels',
    tags: ['channel', 'communication', 'setup'],
    official: true,
    manifest: {
      packId: 'official-communication-channels',
      label: 'Communication Channels',
      summary: 'Zavorth-native channel pack.',
      source: {
        label: 'zavorth-official',
        externalRuntimeDependency: false,
      },
      items: [
        channel('slack', 'Slack', 'Connect Slack conversations with approval-gated sends.', 'slack.botToken', 'SLACK_BOT_TOKEN'),
        channel('discord', 'Discord', 'Connect Discord server workflows with guarded replies.', 'discord.botToken', 'DISCORD_BOT_TOKEN'),
        channel('telegram', 'Telegram', 'Connect Telegram chats through the unified gateway.', 'telegram.botToken', 'TELEGRAM_BOT_TOKEN'),
        channel('matrix', 'Matrix', 'Connect Matrix rooms through explicit allowlists.', 'matrix.accessToken', 'MATRIX_ACCESS_TOKEN'),
      ],
    },
  },
  {
    id: 'official-ai-access',
    label: 'AI Access',
    summary: 'Common model access routes prepared as governed provider capabilities.',
    category: 'providers',
    tags: ['provider', 'model', 'local-first'],
    official: true,
    manifest: {
      packId: 'official-ai-access',
      label: 'AI Access',
      summary: 'Zavorth-native model access pack.',
      source: {
        label: 'zavorth-official',
        externalRuntimeDependency: false,
      },
      items: [
        provider('gemini', 'Gemini', 'Use Gemini through a governed remote route.', 'gemini.apiKey', 'GEMINI_API_KEY', 'external-policy'),
        provider('openai-compatible', 'OpenAI Compatible', 'Use OpenAI-compatible endpoints through Provider Mesh policy.', 'openai.apiKey', 'OPENAI_API_KEY', 'external-policy'),
        provider('ollama-local', 'Ollama Local', 'Use a local model route without external network by default.', null, null, 'local'),
        provider('lm-studio-local', 'LM Studio Local', 'Use LM Studio local OpenAI-compatible server.', null, null, 'local'),
      ],
    },
  },
  {
    id: 'official-tool-bridges',
    label: 'Tool Bridges',
    summary: 'Governed tool bridge capabilities that enter through readiness checks and sandbox policy.',
    category: 'tools',
    tags: ['tool', 'bridge', 'sandbox'],
    official: true,
    manifest: {
      packId: 'official-tool-bridges',
      label: 'Tool Bridges',
      summary: 'Zavorth-native tool bridge pack.',
      source: {
        label: 'zavorth-official',
        externalRuntimeDependency: false,
      },
      items: [
        tool('filesystem-bridge', 'Filesystem Bridge', 'Expose workspace file operations with read/write policy gates.', 'mcp', ['workspace-policy', 'path-guard']),
        tool(
          'browser-sidecar',
          'Browser Sidecar',
          'Run browser automation through isolated sidecar readiness.',
          'mcp',
          ['browser-sidecar-health', 'network-policy', 'mcp-browser-doctor'],
          {
            envKeys: ['ZAVORTH_BROWSER_SIDECAR_URL'],
            manualSteps: ['run browser doctor'],
          },
          'local',
        ),
        tool('shell-sidecar', 'Shell Sidecar', 'Route command execution through governed sidecar isolation.', 'runtime-capability', ['sidecar-health', 'command-policy']),
        tool(
          'local-voice-dictation',
          'Local Voice Dictation',
          'Transcribe local audio through provisioned whisper.cpp assets.',
          'runtime-capability',
          ['voice-dictation-doctor', 'local-audio-policy'],
          {
            envKeys: ['ZAVORTH_WHISPER_BINARY', 'ZAVORTH_WHISPER_MODEL'],
            manualSteps: ['grant microphone permission'],
          },
          'local',
        ),
      ],
    },
  },
  {
    id: 'official-ops-skills',
    label: 'Operations Skills',
    summary: 'Reusable operational skills with artifact-first receipts and explicit approvals.',
    category: 'skills',
    tags: ['skill', 'ops', 'artifact'],
    official: true,
    manifest: {
      packId: 'official-ops-skills',
      label: 'Operations Skills',
      summary: 'Zavorth-native operations skill pack.',
      source: {
        label: 'zavorth-official',
        externalRuntimeDependency: false,
      },
      items: [
        skill('daily-brief', 'Daily Brief', 'Prepare a daily operational brief with citations and receipts.', ['calendar.oauth', 'mail.oauth']),
        skill('issue-triage', 'Issue Triage', 'Triage issue trackers into a governed action queue.', ['issues.token']),
        skill('release-readiness', 'Release Readiness', 'Check release gates, rollback notes and adoption readiness.', []),
        skill('workspace-maintenance', 'Workspace Maintenance', 'Plan safe maintenance actions with owner approval before writes.', []),
      ],
    },
  },
];

export class ZavorthCapabilityPackCatalogService {
  private readonly now: () => Date;
  private readonly packs: CapabilityPackDefinition[];

  constructor(runtime: ZavorthCapabilityPackCatalogRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.packs = Array.isArray(runtime.packs) && runtime.packs.length > 0
      ? runtime.packs.slice()
      : OFFICIAL_CAPABILITY_PACKS.slice();
  }

  public buildSnapshot(query: CapabilityPackCatalogQuery = {}): CapabilityPackCatalogSnapshot {
    const normalized = this.normalizeQuery(query);
    const visible = this.filterPacks(normalized);
    const selected = normalized.packId
      ? this.getPack(normalized.packId)
      : null;
    const manifests = query.includeManifests === false
      ? []
      : visible.map((pack) => this.cloneManifest(pack.manifest));
    const categories = new Set(this.packs.map((pack) => pack.category));

    return {
      contractVersion: CAPABILITY_PACK_CATALOG_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      policy: {
        canonicalRoot: 'zavorth-core/Zavorth',
        officialPacksOnly: true,
        externalRootsAllowed: false,
        importsMustUseCapabilityImporter: true,
        liveActivationByDefault: false,
        secretsSerialized: false,
      },
      query: normalized,
      summary: {
        packs: this.packs.length,
        visible: visible.length,
        manifestItems: visible.reduce((total, pack) => total + pack.manifest.items.length, 0),
        categories: categories.size,
      },
      packs: visible.map((pack) => this.clonePack(pack, query.includeManifests !== false)),
      selected: selected ? this.clonePack(selected, query.includeManifests !== false) : null,
      manifests,
      narrative: {
        headline: `Capability Pack Catalog tem ${visible.length}/${this.packs.length} pack(s) oficial(is).`,
        operatorSummary: `${visible.reduce((total, pack) => total + pack.manifest.items.length, 0)} item(s) declarativo(s), live por padrao: nao, secrets serializados: nao.`,
        nextAction: 'Escolha um pack e rode o Capability Activation Flow para preparar readiness, approvals e receipts.',
      },
    };
  }

  public listPacks(query: CapabilityPackCatalogQuery = {}): CapabilityPackDefinition[] {
    return this.buildSnapshot({ ...query, includeManifests: query.includeManifests ?? true }).packs;
  }

  public getPack(id: string | null | undefined): CapabilityPackDefinition | null {
    const normalized = this.normalize(id);
    if (!normalized) {
      return null;
    }
    const pack = this.packs.find((candidate) => this.normalize(candidate.id) === normalized);
    return pack ? this.clonePack(pack, true) : null;
  }

  public listManifests(query: CapabilityPackCatalogQuery = {}): CapabilityImportManifest[] {
    return this.buildSnapshot({ ...query, includeManifests: true }).manifests;
  }

  public renderReport(query: CapabilityPackCatalogQuery = {}): string {
    const snapshot = this.buildSnapshot(query);
    const lines = [
      'Zavorth Capability Pack Catalog',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Policy: officialOnly=${snapshot.policy.officialPacksOnly}; externalRoots=${snapshot.policy.externalRootsAllowed}; liveDefault=${snapshot.policy.liveActivationByDefault}; secrets=${snapshot.policy.secretsSerialized}.`,
      '',
      'Packs:',
    ];
    for (const pack of snapshot.packs) {
      lines.push(`- ${pack.id} [${pack.category}] ${pack.label}: ${pack.manifest.items.length} item(s)`);
    }
    if (snapshot.selected) {
      lines.push('', 'Selected:');
      lines.push(`${snapshot.selected.id}: ${snapshot.selected.summary}`);
      for (const item of snapshot.selected.manifest.items) {
        lines.push(`- ${item.kind}:${item.id} ${item.label}`);
      }
    }
    lines.push('', `Next: ${snapshot.narrative.nextAction}`);
    return lines.join('\n');
  }

  private normalizeQuery(query: CapabilityPackCatalogQuery): CapabilityPackCatalogSnapshot['query'] {
    return {
      packId: this.normalize(query.packId) || null,
      category: query.category || null,
    };
  }

  private filterPacks(query: CapabilityPackCatalogSnapshot['query']): CapabilityPackDefinition[] {
    return this.packs.filter((pack) => {
      if (query.category && pack.category !== query.category) {
        return false;
      }
      if (query.packId && this.normalize(pack.id) !== query.packId) {
        return false;
      }
      return true;
    });
  }

  private clonePack(pack: CapabilityPackDefinition, includeManifest: boolean): CapabilityPackDefinition {
    return {
      ...pack,
      tags: pack.tags.slice(),
      manifest: includeManifest ? this.cloneManifest(pack.manifest) : {
        ...pack.manifest,
        items: [],
      },
    };
  }

  private cloneManifest(manifest: CapabilityImportManifest): CapabilityImportManifest {
    return JSON.parse(JSON.stringify(manifest)) as CapabilityImportManifest;
  }

  private normalize(value: string | null | undefined): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

function channel(id: string, label: string, summary: string, secretRef: string, envKey: string) {
  return {
    id,
    kind: 'channel' as const,
    label,
    summary,
    tags: ['channel', id],
    requirements: {
      secretRefs: [secretRef],
      envKeys: [envKey],
      manualSteps: ['set allowlisted conversations'],
    },
    governance: {
      risk: 'medium' as const,
      requiresApproval: true,
      networkScope: 'external-policy' as const,
    },
    activation: {
      readiness: 'needs_configuration' as const,
      readinessChecks: [`${id}-credentials`, 'conversation-allowlist'],
    },
  };
}

function provider(
  id: string,
  label: string,
  summary: string,
  secretRef: string | null,
  envKey: string | null,
  networkScope: 'local' | 'external-policy',
) {
  return {
    id,
    kind: 'provider' as const,
    label,
    summary,
    tags: ['provider', id],
    requirements: {
      secretRefs: secretRef ? [secretRef] : [],
      envKeys: envKey ? [envKey] : [],
      manualSteps: networkScope === 'local' ? ['start local model server'] : ['verify account access'],
    },
    governance: {
      risk: 'medium' as const,
      requiresApproval: false,
      networkScope,
    },
    activation: {
      readiness: secretRef ? 'needs_configuration' as const : 'needs_probe' as const,
      readinessChecks: [`${id}-doctor`, 'model-route-policy'],
    },
  };
}

function tool(
  id: string,
  label: string,
  summary: string,
  kind: 'mcp' | 'runtime-capability',
  readinessChecks: string[],
  requirements: {
    secretRefs?: string[];
    envKeys?: string[];
    binaries?: string[];
    manualSteps?: string[];
  } = {},
  networkScope: 'none' | 'local' | 'private-network' | 'external-policy' | 'unknown' = 'unknown',
) {
  return {
    id,
    kind,
    label,
    summary,
    tags: ['tool', id],
    requirements,
    governance: {
      risk: 'high' as const,
      requiresApproval: true,
      sandboxRequired: true,
      networkScope,
    },
    activation: {
      readiness: 'needs_probe' as const,
      readinessChecks,
    },
  };
}

function skill(id: string, label: string, summary: string, secretRefs: string[]) {
  return {
    id,
    kind: 'skill' as const,
    label,
    summary,
    tags: ['skill', id],
    requirements: {
      secretRefs,
      manualSteps: ['review scope and approval budget'],
    },
    governance: {
      risk: secretRefs.length > 0 ? 'medium' as const : 'low' as const,
      requiresApproval: true,
      networkScope: secretRefs.length > 0 ? 'external-policy' as const : 'unknown' as const,
    },
    activation: {
      readiness: secretRefs.length > 0 ? 'needs_configuration' as const : 'needs_probe' as const,
      readinessChecks: [`${id}-readiness`, 'artifact-receipt-policy'],
    },
  };
}
