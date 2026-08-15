import type { SkillCatalogEntry } from '../../src/skills/SkillCatalogContract.js';
import type { ZavorthExternalAgentGatewayRegistrySnapshot } from '../../src/contracts/ZavorthExternalAgentGatewayContract.js';
import {
  ZAVORTH_CAPABILITY_MESH_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthCapabilityMeshContract.js';
import { ZavorthCapabilityMeshService } from '../../src/services/ZavorthCapabilityMeshService.js';


describe('ZavorthCapabilityMeshService', () => {
  it('prefers exact internal skills before external agents', () => {
    const service = createService({
      skills: [
        skill('security-review-assistant', 'Revisao de seguranca de codigo TypeScript', ['security', 'code-review']),
      ],
      external: [externalProfile('security-external', 'External security reviewer', ['security', 'review'])],
    });

    const snapshot = service.buildSnapshot({
      requestText: 'faça uma revisão de segurança deste código TypeScript',
    });

    expect(snapshot.contractVersion).toBe(ZAVORTH_CAPABILITY_MESH_CONTRACT_VERSION);
    expect(snapshot.surface).toBe('capability-mesh');
    expect(snapshot.selected.decision).toBe('use-internal-skill');
    expect(snapshot.candidates[0]).toEqual(expect.objectContaining({
      kind: 'internal-skill',
      requiresApproval: false,
    }));
    expect(snapshot.safety.noProcessStarted).toBe(true);
    expect(snapshot.orchestration.noExternalAgentInvokedDuringArbitration).toBe(true);
  });

  it('proposes skill composition for multi-step requests', () => {
    const service = createService({
      skills: [
        skill('release-note-drafter', 'Escreve release notes e changelog', ['release', 'writing']),
        skill('qa-scenario-author', 'Cria cenarios de QA e testes', ['qa', 'testing']),
      ],
    });

    const snapshot = service.buildSnapshot({
      requestText: 'gere release notes e depois crie cenarios de QA',
    });

    expect(snapshot.candidates.some((candidate) => candidate.kind === 'skill-composition')).toBe(true);
    expect(snapshot.orchestration.consideredSkillComposition).toBe(true);
  });

  it('proposes creating a Zavorth-native skill when no exact capability exists', () => {
    const service = createService({ skills: [] });
    const snapshot = service.buildSnapshot({
      requestText: 'crie uma skill nova para converter um formato academico desconhecido',
    });

    expect(snapshot.candidates[0]).toEqual(expect.objectContaining({
      kind: 'create-zavorth-skill',
      requiresApproval: true,
      canExecuteNow: false,
    }));
    expect(snapshot.orchestration.noSkillInstalledDuringArbitration).toBe(true);
  });

  it('can select a connected external agent when it is clearly better and requested', () => {
    const service = createService({
      skills: [skill('generic-code-review', 'Revisao generica de codigo', ['review'])],
      external: [externalProfile('rust-reviewer', 'Rust specialist reviewer', ['rust', 'review', 'security'])],
    });

    const snapshot = service.buildSnapshot({
      requestText: 'use o melhor agente externo para revisar Rust com seguranca',
      preferExternal: true,
    });

    expect(snapshot.candidates.some((candidate) =>
      candidate.kind === 'external-agent' && candidate.metadata.externalProfileId === 'rust-reviewer',
    )).toBe(true);
    expect(snapshot.selected.decision).toBe('delegate-external-agent');
    expect(snapshot.selected.summary).toContain('aprovacao por chamada');
    expect(snapshot.selected.nextCommand).toContain('zavorth external-agent run');
    expect(snapshot.selected.nextCommand).not.toContain('--approve-external-execution');
    expect(snapshot.safety.perRunApprovalStillRequired).toBe(true);
  });
});

function createService(input: {
  skills?: SkillCatalogEntry[];
  external?: ReturnType<typeof externalProfile>[];
} = {}): ZavorthCapabilityMeshService {
  return new ZavorthCapabilityMeshService({
    now: () => new Date('2026-05-17T03:20:00.000Z'),
    projectRoot: __dirname,
    skillCatalogService: {
      listEntries: () => input.skills || [],
    },
    externalAgentGatewayService: {
      buildRegistrySnapshot: () => registry(input.external || []),
    },
  });
}

function skill(name: string, description: string, tags: string[]): SkillCatalogEntry {
  return {
    id: `skill:${name}`,
    name,
    description,
    sourceId: null,
    sourceLabel: null,
    sourceTrust: null,
    license: null,
    imported: false,
    bundleTags: tags,
    supportFileCount: 0,
    dirPath: `/skills/${name}`,
    skillFilePath: `/skills/${name}/SKILL.md`,
    searchText: `${name} ${description} ${tags.join(' ')}`.toLowerCase(),
    provenance: null,
    risk: null,
    licensePolicy: null,
    audit: null,
    metadata: {
      name,
      description,
      dirPath: `/skills/${name}`,
      skillFilePath: `/skills/${name}/SKILL.md`,
      supportFilePaths: [],
    },
  };
}

function externalProfile(id: string, label: string, capabilities: string[]): ZavorthExternalAgentGatewayRegistrySnapshot['profiles'][number] {
  return {
    id,
    label,
    adapter: 'cli',
    status: 'enabled',
    root: __dirname,
    command: id,
    args: [],
    endpoint: null,
    acp: { serverId: null, transport: null },
    promptMode: 'stdin',
    allowedCapabilities: capabilities,
    liveExecutionEnabled: true,
    allowRemoteNetwork: false,
    isolation: {
      kind: 'docker',
      required: true,
      strongBoundary: true,
      image: `${id}:latest`,
      distro: null,
      workspaceMount: __dirname,
      workingDirectory: '/workspace',
      network: 'disabled',
      readOnlyRoot: true,
      notes: [],
    },
    createdAt: '2026-05-17T03:20:00.000Z',
    updatedAt: '2026-05-17T03:20:00.000Z',
    provenance: { source: 'manual', onboardingCandidateId: null },
    safety: {
      requiresApprovalPerInvocation: true,
      noDefaultRuntimeBinding: true,
      secretsPassedThroughEnv: false,
      toolExposureByDefault: false,
      strongIsolationAvailable: true,
      localCliIsNotOsSandbox: false,
    },
  };
}

function registry(profiles: ZavorthExternalAgentGatewayRegistrySnapshot['profiles']): ZavorthExternalAgentGatewayRegistrySnapshot {
  return {
    generatedAt: '2026-05-17T03:20:00.000Z',
    contractVersion: 'zavorth-external-agent-gateway/1',
    surface: 'external-agent-gateway',
    status: profiles.length > 0 ? 'ready' : 'empty',
    registryFile: '/tmp/profiles.json',
    profiles,
    summary: {
      total: profiles.length,
      enabled: profiles.filter((profile) => profile.status === 'enabled').length,
      liveEnabled: profiles.filter((profile) => profile.liveExecutionEnabled).length,
      cli: profiles.filter((profile) => profile.adapter === 'cli').length,
      http: profiles.filter((profile) => profile.adapter === 'http').length,
      acp: profiles.filter((profile) => profile.adapter === 'acp').length,
      mcp: profiles.filter((profile) => profile.adapter === 'mcp').length,
      stronglyIsolated: profiles.filter((profile) => profile.isolation.strongBoundary).length,
    },
    safety: {
      noAgentUsedDuringRegistryRead: true,
      noToolExposure: true,
      noCredentialSerialization: true,
      liveUseRequiresApproval: true,
      strongIsolationAvailable: true,
      localCliDeclaredNonSandboxed: true,
    },
  };
}
