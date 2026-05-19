import type {
  DocumentExtractionArtifact,
  DocumentExtractionReceipt,
  GovernedTerminalReceipt,
  Stage5PackageEvidence,
  SearchFetchReceipt,
  ShellSafetyReceipt,
  SourceMemoryDocumentTerminalPackSnapshot,
  SourceMemoryDocumentTerminalPackageName,
} from '../contracts/SourceMemoryDocumentTerminalPackContract.js';
import { GovernedTerminalRuntime } from './GovernedTerminalRuntime.js';
import { ShellSafetyClassifier } from './ShellSafetyClassifier.js';
import { SourceMemoryDocumentTerminalPackService } from './SourceMemoryDocumentTerminalPackService.js';
import { SourceSearchFetchService } from './SourceSearchFetchService.js';
import type {
  ZavorthSemanticMemoryDocumentTerminalCertificationSnapshot,
  ZavorthSemanticMemoryDocumentTerminalCertificationStatus,
  ZavorthSemanticMemoryDocumentTerminalClaim,
  ZavorthSemanticMemoryDocumentTerminalClaimKind,
  ZavorthSemanticMemoryDocumentTerminalClaimPriority,
  ZavorthSemanticMemoryDocumentTerminalClaimStatus,
  ZavorthSemanticMemoryDocumentTerminalScenario,
} from '../contracts/ZavorthSemanticMemoryDocumentTerminalCertificationContract.js';
import { ZAVORTH_SEMANTIC_MEMORY_DOCUMENT_TERMINAL_CERTIFICATION_CONTRACT_VERSION } from '../contracts/ZavorthSemanticMemoryDocumentTerminalCertificationContract.js';

type Runtime = {
  now?: () => Date;
  sourceRoot?: string;
  zavorthRoot?: string;
  packService?: Pick<SourceMemoryDocumentTerminalPackService, 'buildSnapshot'>;
};

type ClaimInput = {
  kind: ZavorthSemanticMemoryDocumentTerminalClaimKind;
  status: ZavorthSemanticMemoryDocumentTerminalClaimStatus;
  priority: ZavorthSemanticMemoryDocumentTerminalClaimPriority;
  packageName?: SourceMemoryDocumentTerminalPackageName;
  backendId?: ZavorthSemanticMemoryDocumentTerminalClaim['backendId'];
  documentKind?: ZavorthSemanticMemoryDocumentTerminalClaim['documentKind'];
  shellSafetyLevel?: ZavorthSemanticMemoryDocumentTerminalClaim['shellSafetyLevel'];
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds?: string[];
  notes?: string[];
};

const STAGE5_RECEIPT_PREFIX = 'zavorth.semantic.s5.memory-document-terminal';

export class ZavorthSemanticMemoryDocumentTerminalCertificationService {
  private readonly now: () => Date;
  private readonly sourceRoot?: string;
  private readonly zavorthRoot?: string;
  private readonly packService: Pick<SourceMemoryDocumentTerminalPackService, 'buildSnapshot'>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sourceRoot = runtime.sourceRoot;
    this.zavorthRoot = runtime.zavorthRoot;
    this.packService = runtime.packService || new SourceMemoryDocumentTerminalPackService({
      now: this.now,
      sourceRoot: this.sourceRoot,
      zavorthRoot: this.zavorthRoot,
    });
  }

  public async buildSnapshot(input: {
    sourceRoot?: string | null;
    zavorthRoot?: string | null;
  } = {}): Promise<ZavorthSemanticMemoryDocumentTerminalCertificationSnapshot> {
    const pack = await this.packService.buildSnapshot({
      sourceRoot: input.sourceRoot || this.sourceRoot,
      zavorthRoot: input.zavorthRoot || this.zavorthRoot,
    });
    const scenarios = await this.buildScenarios(pack);
    const claims = this.buildClaims(pack, scenarios);
    const gaps = claims.filter((claim) => claim.status === 'gap').length;
    const status: ZavorthSemanticMemoryDocumentTerminalCertificationStatus =
      pack.status === 'passed'
      && gaps === 0
      && scenarios.every((scenario) => scenario.status === 'passed')
      && pack.summary.liveNetworkPerformed === false
      && pack.summary.liveProcessSpawnedByDefault === false
      && pack.summary.secretValuesSerialized === false
        ? 'passed'
        : 'failed';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SEMANTIC_MEMORY_DOCUMENT_TERMINAL_CERTIFICATION_CONTRACT_VERSION,
      status,
      semanticPhase: 'S5',
      statement: 'Memory, document, search and terminal semantics are certified as governed Zavorth-native runtimes with replayable artifact-first receipts.',
      sourceRoot: pack.sourceRoot,
      zavorthRoot: pack.zavorthRoot,
      packStatus: pack.status,
      packContractVersion: pack.contractVersion,
      claims,
      scenarios,
      summary: {
        semanticClaims: claims.length,
        covered: countStatus(claims, 'covered'),
        replaced: countStatus(claims, 'replaced'),
        ownerGated: countStatus(claims, 'owner-gated'),
        rejected: countStatus(claims, 'rejected'),
        gaps,
        p0Claims: countPriority(claims, 'P0'),
        p1Claims: countPriority(claims, 'P1'),
        p2Claims: countPriority(claims, 'P2'),
        receiptBackedClaims: claims.filter((claim) => claim.receiptIds.length > 0).length,
        packagesCertified: claims.filter((claim) => claim.kind === 'package-coverage').length,
        memoryClaimsCertified: claims.filter((claim) => claim.kind === 'memory-runtime').length,
        documentClaimsCertified: claims.filter((claim) => claim.kind === 'document-extraction').length,
        searchClaimsCertified: claims.filter((claim) => claim.kind === 'search-fetch-policy').length,
        shellSafetyClaimsCertified: claims.filter((claim) => claim.kind === 'shell-safety-policy').length,
        terminalClaimsCertified: claims.filter((claim) => claim.kind === 'terminal-runtime').length,
        scenariosPassed: scenarios.filter((scenario) => scenario.status === 'passed').length,
        liveNetworkPerformed: false,
        liveProcessSpawnedByDefault: false,
        secretValuesSerialized: false,
        sourceCodeCopied: false,
      },
      policy: {
        semanticClaimRequiredForEveryPackage: true,
        artifactFirstReceipts: true,
        memoryWriteReadReplayable: true,
        documentExtractionProducesArtifacts: true,
        searchAndFetchLiveNetworkRequiresExplicitCommand: true,
        proxyValuesAreRefsOnly: true,
        terminalDisabledUntilPolicyAllows: true,
        dangerousShellRequiresApproval: true,
        scopedCwdRootsRequired: true,
        ptyIsOptionalRuntimeOnly: true,
        noLiveIoDuringCertification: true,
        rawSecretValuesRejected: true,
        unsafeShellBypassRejected: true,
        noSourceSourceCopy: true,
        gapsBlockRelease: true,
      },
      commands: {
        inspect: 'npm run semantic-memory-document-terminal-certification --silent',
        inspectJson: 'npm run semantic-memory-document-terminal-certification:json --silent',
        check: 'npm run semantic-memory-document-terminal-certification:check --silent',
        qa: 'npm run qa:semantic-memory-document-terminal-certification --silent',
        nextStage: 'S6 - Native Companion And Device Capability Semantics',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthSemanticMemoryDocumentTerminalCertificationSnapshot): string {
    const lines = [
      'Zavorth Semantic Memory Document Terminal Certification - S5',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Pack status: ${snapshot.packStatus}`,
      `Claims: ${snapshot.summary.semanticClaims}`,
      `Covered/replaced/owner-gated/rejected/gaps: ${snapshot.summary.covered}/${snapshot.summary.replaced}/${snapshot.summary.ownerGated}/${snapshot.summary.rejected}/${snapshot.summary.gaps}`,
      `P0/P1/P2: ${snapshot.summary.p0Claims}/${snapshot.summary.p1Claims}/${snapshot.summary.p2Claims}`,
      `Receipt-backed claims: ${snapshot.summary.receiptBackedClaims}`,
      `Packages certified: ${snapshot.summary.packagesCertified}`,
      `Memory claims certified: ${snapshot.summary.memoryClaimsCertified}`,
      `Document claims certified: ${snapshot.summary.documentClaimsCertified}`,
      `Search claims certified: ${snapshot.summary.searchClaimsCertified}`,
      `Shell safety claims certified: ${snapshot.summary.shellSafetyClaimsCertified}`,
      `Terminal claims certified: ${snapshot.summary.terminalClaimsCertified}`,
      `Scenarios passed: ${snapshot.summary.scenariosPassed}/${snapshot.scenarios.length}`,
      `Live network performed: ${snapshot.summary.liveNetworkPerformed}`,
      `Live process spawned by default: ${snapshot.summary.liveProcessSpawnedByDefault}`,
      `Secret values serialized: ${snapshot.summary.secretValuesSerialized}`,
      'Claim groups:',
      ...snapshot.claims.map((claim) =>
        `- ${claim.status} ${claim.priority} ${claim.id}: ${claim.expectedBehavior} -> ${claim.zavorthEquivalent}`,
      ),
      `Next: ${snapshot.commands.nextStage}`,
    ];
    return lines.join('\n');
  }

  private buildClaims(
    pack: SourceMemoryDocumentTerminalPackSnapshot,
    scenarios: ZavorthSemanticMemoryDocumentTerminalScenario[],
  ): ZavorthSemanticMemoryDocumentTerminalClaim[] {
    return [
      ...pack.packageEvidence.map((evidence) => this.packageClaim(evidence)),
      ...this.memoryClaims(pack),
      ...pack.documents.receipts.map((receipt, index) =>
        this.documentClaim(receipt, pack.documents.artifacts[index]),
      ),
      ...pack.search.receipts.map((receipt) => this.searchClaim(receipt)),
      ...pack.search.receipts.map((receipt) => this.proxyClaim(receipt)),
      ...pack.terminal.shellSafetyReceipts.map((receipt) => this.shellSafetyClaim(receipt)),
      ...pack.terminal.terminalReceipts.map((receipt) => this.terminalClaim(receipt)),
      this.cwdSandboxClaim(pack),
      this.optionalRuntimeClaim(pack),
      ...this.liveIoAndReceiptClaims(pack),
      ...this.scenarioClaims(scenarios),
      ...this.unsafeOperationClaims(pack),
    ];
  }

  private packageClaim(evidence: Stage5PackageEvidence): ZavorthSemanticMemoryDocumentTerminalClaim {
    return this.claim({
      kind: 'package-coverage',
      status: packageStatus(evidence),
      priority: packagePriority(evidence.packageName),
      packageName: evidence.packageName,
      expectedBehavior: `${evidence.packageName} behavior is classified before memory/document/search/terminal adoption decisions.`,
      zavorthEquivalent: packageEquivalent(evidence.packageName, evidence.decision),
      evidence: [
        `decision=${evidence.decision}`,
        `presentInSource=${evidence.presentInSource}`,
        `presentInZavorthPackageJson=${evidence.presentInZavorthPackageJson}`,
        `presentInZavorthLockfile=${evidence.presentInZavorthLockfile}`,
        `sourceReferences=${evidence.sourceReferenceFiles.length}`,
        `zavorthReferences=${evidence.zavorthReferenceFiles.length}`,
      ],
      notes: ['S5 certifies behavior by governed runtime capability, not package layout.'],
    });
  }

  private memoryClaims(pack: SourceMemoryDocumentTerminalPackSnapshot): ZavorthSemanticMemoryDocumentTerminalClaim[] {
    return [
      this.claim({
        kind: 'memory-runtime',
        status: pack.memory.writeReceipt.status === 'applied'
          && pack.memory.writeReceipt.artifactFirst
          && pack.memory.writeReceipt.replayable
            ? 'covered'
            : 'gap',
        priority: 'P0',
        backendId: pack.memory.backendId,
        expectedBehavior: 'Memory writes create deterministic replayable artifact-first receipts.',
        zavorthEquivalent: 'SqliteVecMemoryBackend write receipt and redacted metadata record.',
        evidence: [
          `backendId=${pack.memory.backendId}`,
          `writeStatus=${pack.memory.writeReceipt.status}`,
          `recordId=${pack.memory.writeReceipt.recordId || ''}`,
          `vectorDimensions=${pack.memory.writeReceipt.vectorDimensions}`,
          `sqliteVecExtensionLoaded=${pack.memory.writeReceipt.sqliteVecExtensionLoaded}`,
          `artifactFirst=${pack.memory.writeReceipt.artifactFirst}`,
          `replayable=${pack.memory.writeReceipt.replayable}`,
          `secretValuesSerialized=${pack.memory.writeReceipt.secretValuesSerialized}`,
        ],
        receiptIds: [pack.memory.writeReceipt.id],
        notes: [pack.memory.writeReceipt.reason],
      }),
      this.claim({
        kind: 'memory-runtime',
        status: pack.memory.queryReceipt.status === 'applied'
          && pack.memory.resultCount > 0
          && pack.memory.queryReceipt.replayable
            ? 'covered'
            : 'gap',
        priority: 'P0',
        backendId: pack.memory.backendId,
        expectedBehavior: 'Memory queries return deterministic recall results with replayable receipts.',
        zavorthEquivalent: 'SqliteVecMemoryBackend query receipt with ranked result ids.',
        evidence: [
          `queryStatus=${pack.memory.queryReceipt.status}`,
          `namespace=${pack.memory.queryReceipt.namespace}`,
          `resultRecordIds=${pack.memory.queryReceipt.resultRecordIds.join(',')}`,
          `topScore=${pack.memory.queryReceipt.topScore}`,
          `resultCount=${pack.memory.resultCount}`,
          `artifactFirst=${pack.memory.queryReceipt.artifactFirst}`,
          `replayable=${pack.memory.queryReceipt.replayable}`,
          `secretValuesSerialized=${pack.memory.queryReceipt.secretValuesSerialized}`,
        ],
        receiptIds: [pack.memory.queryReceipt.id],
        notes: [pack.memory.queryReceipt.reason],
      }),
    ];
  }

  private documentClaim(
    receipt: DocumentExtractionReceipt,
    artifact: DocumentExtractionArtifact | undefined,
  ): ZavorthSemanticMemoryDocumentTerminalClaim {
    return this.claim({
      kind: 'document-extraction',
      status: receipt.status === 'artifact-created'
        && Boolean(artifact?.text.trim())
        && receipt.artifactFirst
        && receipt.liveIoPerformed === false
          ? 'covered'
          : 'gap',
      priority: 'P0',
      documentKind: receipt.kind,
      expectedBehavior: `${receipt.kind} extraction produces artifact-first document text and receipts.`,
      zavorthEquivalent: `${receipt.parser} document extraction adapter.`,
      evidence: [
        `status=${receipt.status}`,
        `kind=${receipt.kind}`,
        `artifactId=${receipt.artifactId || ''}`,
        `parser=${receipt.parser}`,
        `bytes=${receipt.bytes}`,
        `textChars=${artifact?.text.length || 0}`,
        `liveIoPerformed=${receipt.liveIoPerformed}`,
        `secretValuesSerialized=${receipt.secretValuesSerialized}`,
      ],
      receiptIds: [receipt.id, ...(artifact?.receiptId ? [artifact.receiptId] : [])],
      notes: [receipt.reason],
    });
  }

  private searchClaim(receipt: SearchFetchReceipt): ZavorthSemanticMemoryDocumentTerminalClaim {
    return this.claim({
      kind: 'search-fetch-policy',
      status: receipt.status === 'simulated'
        && receipt.artifactFirst
        && receipt.liveNetworkPerformed === false
          ? 'covered'
          : 'gap',
      priority: 'P0',
      expectedBehavior: 'Search/fetch behavior is represented by artifact-first receipts and no live network by default.',
      zavorthEquivalent: 'SourceSearchFetchService simulateSearch and explicit live fetch command.',
      evidence: [
        `status=${receipt.status}`,
        `mode=${receipt.mode}`,
        `query=${receipt.query || ''}`,
        `url=${receipt.url || ''}`,
        `resultCount=${receipt.resultCount}`,
        `liveNetworkPerformed=${receipt.liveNetworkPerformed}`,
        `secretValuesSerialized=${receipt.secretValuesSerialized}`,
      ],
      receiptIds: [receipt.id],
      notes: [receipt.reason],
    });
  }

  private proxyClaim(receipt: SearchFetchReceipt): ZavorthSemanticMemoryDocumentTerminalClaim {
    return this.claim({
      kind: 'proxy-policy',
      status: receipt.proxyPolicy.rawProxyValuesSerialized === false ? 'covered' : 'gap',
      priority: 'P1',
      expectedBehavior: 'Proxy routing policy stores proxy env refs only and never raw proxy values.',
      zavorthEquivalent: 'ProxyRoutingPolicyReceipt with proxyRefs and noProxyRefPresent metadata.',
      evidence: [
        `proxyStatus=${receipt.proxyPolicy.status}`,
        `proxyRefs=${receipt.proxyPolicy.proxyRefs.join(',')}`,
        `noProxyRefPresent=${receipt.proxyPolicy.noProxyRefPresent}`,
        `rawProxyValuesSerialized=${receipt.proxyPolicy.rawProxyValuesSerialized}`,
      ],
      receiptIds: [`${STAGE5_RECEIPT_PREFIX}.proxy-policy.${receipt.id}`],
      notes: ['Proxy values are treated as references only.'],
    });
  }

  private shellSafetyClaim(receipt: ShellSafetyReceipt): ZavorthSemanticMemoryDocumentTerminalClaim {
    return this.claim({
      kind: 'shell-safety-policy',
      status: receipt.command && receipt.cwdAllowed && (receipt.level === 'safe' || receipt.blocked)
        ? 'covered'
        : 'gap',
      priority: receipt.blocked ? 'P0' : 'P1',
      shellSafetyLevel: receipt.level,
      expectedBehavior: `Shell command "${receipt.command}" is classified before any terminal execution.`,
      zavorthEquivalent: 'ShellSafetyClassifier token/tree-sitter-aware hazard receipt.',
      evidence: [
        `command=${receipt.command}`,
        `level=${receipt.level}`,
        `approvalRequired=${receipt.approvalRequired}`,
        `blocked=${receipt.blocked}`,
        `cwdAllowed=${receipt.cwdAllowed}`,
        `hazards=${receipt.hazards.join(',')}`,
        `shellParser=${receipt.shellParser}`,
        `treeSitterAvailable=${receipt.treeSitterAvailable}`,
      ],
      receiptIds: [receipt.id],
      notes: [receipt.reason],
    });
  }

  private terminalClaim(receipt: GovernedTerminalReceipt): ZavorthSemanticMemoryDocumentTerminalClaim {
    return this.claim({
      kind: 'terminal-runtime',
      status: receipt.status === 'blocked'
        && receipt.liveProcessSpawned === false
        && receipt.artifactFirst
          ? 'covered'
          : 'gap',
      priority: receipt.classification.blocked ? 'P0' : 'P1',
      shellSafetyLevel: receipt.classification.level,
      expectedBehavior: `Terminal command "${receipt.command}" is governed by policy before process spawn.`,
      zavorthEquivalent: 'GovernedTerminalRuntime terminal receipt with ShellSafetyClassifier classification.',
      evidence: [
        `status=${receipt.status}`,
        `command=${receipt.command}`,
        `cwd=${receipt.cwd}`,
        `approvalId=${receipt.approvalId || ''}`,
        `ptyRequested=${receipt.ptyRequested}`,
        `ptyAvailable=${receipt.ptyAvailable}`,
        `liveProcessSpawned=${receipt.liveProcessSpawned}`,
        `classificationLevel=${receipt.classification.level}`,
        `classificationBlocked=${receipt.classification.blocked}`,
        `secretValuesSerialized=${receipt.secretValuesSerialized}`,
      ],
      receiptIds: [receipt.id, receipt.classification.id],
      notes: [receipt.reason, receipt.classification.reason],
    });
  }

  private cwdSandboxClaim(pack: SourceMemoryDocumentTerminalPackSnapshot): ZavorthSemanticMemoryDocumentTerminalClaim {
    const cwdReceipts = pack.terminal.terminalReceipts;
    return this.claim({
      kind: 'cwd-sandbox',
      status: pack.policy.scopedCwdRootsRequired
        && cwdReceipts.every((receipt) => receipt.classification.cwdAllowed)
          ? 'covered'
          : 'gap',
      priority: 'P0',
      expectedBehavior: 'Terminal execution is scoped to allowed cwd roots before any process spawn.',
      zavorthEquivalent: 'ShellSafetyClassifier cwdAllowed and GovernedTerminalRuntime allowedRoots.',
      evidence: [
        `scopedCwdRootsRequired=${pack.policy.scopedCwdRootsRequired}`,
        `cwdAllowed=${cwdReceipts.map((receipt) => receipt.classification.cwdAllowed).join(',')}`,
      ],
      receiptIds: cwdReceipts.map((receipt) => receipt.classification.id),
      notes: ['S5 certifies cwd scope without spawning processes by default.'],
    });
  }

  private optionalRuntimeClaim(pack: SourceMemoryDocumentTerminalPackSnapshot): ZavorthSemanticMemoryDocumentTerminalClaim {
    const optionalPackages = pack.packageEvidence.filter((entry) =>
      entry.decision === 'implemented-optional-runtime' || entry.decision === 'owner-gated',
    );
    return this.claim({
      kind: 'optional-runtime-policy',
      status: optionalPackages.length > 0 && pack.terminal.terminalReceipts.every((receipt) => !receipt.liveProcessSpawned)
        ? 'owner-gated'
        : 'gap',
      priority: 'P1',
      expectedBehavior: 'PTY and parser runtimes remain optional or owner-gated and are not required for default certification.',
      zavorthEquivalent: 'GovernedTerminalRuntime ptyAvailable metadata and ShellSafetyClassifier fallback parser.',
      evidence: [
        `optionalPackages=${optionalPackages.map((entry) => entry.packageName).join(',')}`,
        `terminalPtyAvailable=${pack.terminal.terminalReceipts.map((receipt) => receipt.ptyAvailable).join(',')}`,
        `shellParsers=${pack.terminal.shellSafetyReceipts.map((receipt) => receipt.shellParser).join(',')}`,
      ],
      receiptIds: [`${STAGE5_RECEIPT_PREFIX}.optional-runtime.pty-parser`],
      notes: ['Optional runtime availability is evidence, not a default execution path.'],
    });
  }

  private liveIoAndReceiptClaims(pack: SourceMemoryDocumentTerminalPackSnapshot): ZavorthSemanticMemoryDocumentTerminalClaim[] {
    return [
      this.claim({
        kind: 'live-io-policy',
        status: pack.summary.liveNetworkPerformed === false
          && pack.summary.liveProcessSpawnedByDefault === false
            ? 'covered'
            : 'gap',
        priority: 'P0',
        expectedBehavior: 'S5 certification performs no live network and spawns no terminal process by default.',
        zavorthEquivalent: 'Live fetch and terminal smoke require explicit operator commands.',
        evidence: [
          `liveNetworkPerformed=${pack.summary.liveNetworkPerformed}`,
          `liveProcessSpawnedByDefault=${pack.summary.liveProcessSpawnedByDefault}`,
          `liveFetch=${pack.commands.liveFetch}`,
          `terminalSmoke=${pack.commands.terminalSmoke}`,
        ],
        receiptIds: [`${STAGE5_RECEIPT_PREFIX}.live-io.no-default-live`],
        notes: ['Live behavior is intentionally separated from certification.'],
      }),
      this.claim({
        kind: 'receipt-policy',
        status: pack.policy.artifactFirstReceipts
          && pack.summary.secretValuesSerialized === false
          && pack.memory.writeReceipt.artifactFirst
          && pack.memory.queryReceipt.artifactFirst
            ? 'covered'
            : 'gap',
        priority: 'P0',
        expectedBehavior: 'Memory, document, search and terminal behavior is artifact-first and receipt-backed.',
        zavorthEquivalent: 'Credential vault pack receipts across memory, documents, search and terminal.',
        evidence: [
          `artifactFirstReceipts=${pack.policy.artifactFirstReceipts}`,
          `memoryReceipts=${pack.summary.memoryReceipts}`,
          `documentArtifacts=${pack.summary.documentArtifacts}`,
          `searchReceipts=${pack.summary.searchReceipts}`,
          `terminalReceipts=${pack.summary.terminalReceipts}`,
          `secretValuesSerialized=${pack.summary.secretValuesSerialized}`,
          'sourceCodeCopied=false',
        ],
        receiptIds: [
          pack.memory.writeReceipt.id,
          pack.memory.queryReceipt.id,
          ...pack.documents.receipts.map((receipt) => receipt.id),
          ...pack.search.receipts.map((receipt) => receipt.id),
          ...pack.terminal.terminalReceipts.map((receipt) => receipt.id),
        ],
        notes: ['Receipts store metadata and redacted values only.'],
      }),
    ];
  }

  private scenarioClaims(
    scenarios: ZavorthSemanticMemoryDocumentTerminalScenario[],
  ): ZavorthSemanticMemoryDocumentTerminalClaim[] {
    return scenarios.map((scenario) => this.claim({
      kind: scenario.id === 'memory-write-query'
        ? 'memory-runtime'
        : scenario.id === 'blocked-live-fetch-without-confirm'
          ? 'search-fetch-policy'
          : 'terminal-runtime',
      status: scenario.status === 'passed' ? 'covered' : 'gap',
      priority: 'P0',
      expectedBehavior: scenarioExpectedBehavior(scenario.id),
      zavorthEquivalent: scenarioEquivalent(scenario.id),
      evidence: scenario.evidence,
      receiptIds: [`${STAGE5_RECEIPT_PREFIX}.scenario.${scenario.id}`],
      notes: ['Scenario proves guarded behavior without exposing secrets.'],
    }));
  }

  private unsafeOperationClaims(pack: SourceMemoryDocumentTerminalPackSnapshot): ZavorthSemanticMemoryDocumentTerminalClaim[] {
    return [
      this.claim({
        kind: 'unsafe-operation-policy',
        status: pack.policy.liveNetworkRequiresExplicitCommand ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject implicit live network fetch/search.',
        zavorthEquivalent: 'Live fetch requires --confirm-live-network.',
        evidence: [`liveNetworkRequiresExplicitCommand=${pack.policy.liveNetworkRequiresExplicitCommand}`],
        receiptIds: [`${STAGE5_RECEIPT_PREFIX}.reject.implicit-live-network`],
        notes: ['Rejected here means intentionally not implemented.'],
      }),
      this.claim({
        kind: 'unsafe-operation-policy',
        status: pack.policy.dangerousShellRequiresApproval ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject dangerous shell execution without explicit approval.',
        zavorthEquivalent: 'ShellSafetyClassifier blocks dangerous commands and GovernedTerminalRuntime requires policy allowance.',
        evidence: [`dangerousShellRequiresApproval=${pack.policy.dangerousShellRequiresApproval}`],
        receiptIds: [`${STAGE5_RECEIPT_PREFIX}.reject.dangerous-shell-without-approval`],
        notes: ['Rejected here means intentionally blocked by policy.'],
      }),
      this.claim({
        kind: 'unsafe-operation-policy',
        status: pack.summary.secretValuesSerialized === false ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject raw secret serialization in memory/document/search/terminal receipts.',
        zavorthEquivalent: 'Receipts store redacted metadata and refs only.',
        evidence: [`secretValuesSerialized=${pack.summary.secretValuesSerialized}`],
        receiptIds: [`${STAGE5_RECEIPT_PREFIX}.reject.raw-secret-serialization`],
        notes: ['Rejected here means intentionally not implemented.'],
      }),
    ];
  }

  private async buildScenarios(
    pack: SourceMemoryDocumentTerminalPackSnapshot,
  ): Promise<ZavorthSemanticMemoryDocumentTerminalScenario[]> {
    const blockedFetch = await new SourceSearchFetchService({
      now: this.now,
    }).fetchUrl({
      url: 'https://example.test/',
      confirmLiveNetwork: false,
    });
    const classifier = new ShellSafetyClassifier({
      now: this.now,
      allowedRoots: [pack.zavorthRoot],
      treeSitterAvailable: false,
    });
    const runtime = new GovernedTerminalRuntime({
      now: this.now,
      classifier,
      allowedRoots: [pack.zavorthRoot],
      enabledByDefault: false,
      ptyAvailable: false,
      runner: async () => ({
        exitCode: 0,
        stdout: 'should-not-run',
        stderr: null,
      }),
    });
    const blockedTerminal = await runtime.run({
      command: 'node --version',
      cwd: pack.zavorthRoot,
      allowExecution: false,
    });
    const blockedDangerous = await runtime.run({
      command: 'rm -rf .',
      cwd: pack.zavorthRoot,
      allowExecution: true,
      approvalId: 's5-danger-scenario',
    });

    return [
      {
        id: 'memory-write-query',
        status: pack.memory.writeReceipt.status === 'applied'
          && pack.memory.queryReceipt.status === 'applied'
          && pack.memory.resultCount > 0
            ? 'passed'
            : 'failed',
        evidence: [
          `writeStatus=${pack.memory.writeReceipt.status}`,
          `queryStatus=${pack.memory.queryReceipt.status}`,
          `resultCount=${pack.memory.resultCount}`,
          `writeReceipt=${pack.memory.writeReceipt.id}`,
          `queryReceipt=${pack.memory.queryReceipt.id}`,
        ],
        liveNetworkPerformed: false,
        liveProcessSpawned: false,
        secretValuesSerialized: false,
      },
      {
        id: 'blocked-live-fetch-without-confirm',
        status: blockedFetch.status === 'blocked' && blockedFetch.liveNetworkPerformed === false ? 'passed' : 'failed',
        evidence: [
          `status=${blockedFetch.status}`,
          `url=${blockedFetch.url || ''}`,
          `liveNetworkPerformed=${blockedFetch.liveNetworkPerformed}`,
          `reason=${blockedFetch.reason}`,
        ],
        liveNetworkPerformed: blockedFetch.liveNetworkPerformed,
        liveProcessSpawned: false,
        secretValuesSerialized: false,
      },
      {
        id: 'blocked-terminal-without-policy',
        status: blockedTerminal.status === 'blocked' && blockedTerminal.liveProcessSpawned === false ? 'passed' : 'failed',
        evidence: [
          `status=${blockedTerminal.status}`,
          `command=${blockedTerminal.command}`,
          `liveProcessSpawned=${blockedTerminal.liveProcessSpawned}`,
          `reason=${blockedTerminal.reason}`,
        ],
        liveNetworkPerformed: false,
        liveProcessSpawned: blockedTerminal.liveProcessSpawned,
        secretValuesSerialized: false,
      },
      {
        id: 'blocked-dangerous-command',
        status: blockedDangerous.status === 'blocked'
          && blockedDangerous.classification.blocked
          && blockedDangerous.liveProcessSpawned === false
            ? 'passed'
            : 'failed',
        evidence: [
          `status=${blockedDangerous.status}`,
          `command=${blockedDangerous.command}`,
          `hazards=${blockedDangerous.classification.hazards.join(',')}`,
          `liveProcessSpawned=${blockedDangerous.liveProcessSpawned}`,
          `reason=${blockedDangerous.reason}`,
        ],
        liveNetworkPerformed: false,
        liveProcessSpawned: blockedDangerous.liveProcessSpawned,
        secretValuesSerialized: false,
      },
    ];
  }

  private claim(input: ClaimInput): ZavorthSemanticMemoryDocumentTerminalClaim {
    const id = `${input.kind}:${slug([
      input.packageName,
      input.backendId,
      input.documentKind,
      input.shellSafetyLevel,
      input.expectedBehavior,
    ].filter(Boolean).join('-'))}`;
    return {
      id,
      kind: input.kind,
      status: input.status,
      priority: input.priority,
      ...(input.packageName ? { packageName: input.packageName } : {}),
      ...(input.backendId ? { backendId: input.backendId } : {}),
      ...(input.documentKind ? { documentKind: input.documentKind } : {}),
      ...(input.shellSafetyLevel ? { shellSafetyLevel: input.shellSafetyLevel } : {}),
      expectedBehavior: input.expectedBehavior,
      zavorthEquivalent: input.zavorthEquivalent,
      evidence: input.evidence,
      receiptIds: input.receiptIds || [`${STAGE5_RECEIPT_PREFIX}.${id}`],
      notes: input.notes || [],
    };
  }
}

import {
  packageStatus,
  packagePriority,
  packageEquivalent,
  scenarioExpectedBehavior,
  scenarioEquivalent,
  countStatus,
  countPriority,
  slug,
} from './ZavorthSemanticMemoryDocumentTerminalCertificationHelpers.js';
