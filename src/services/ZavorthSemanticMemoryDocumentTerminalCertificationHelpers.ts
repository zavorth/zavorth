import type {
  Stage5PackageEvidence,
  SourceMemoryDocumentTerminalPackageName,
} from '../contracts/SourceMemoryDocumentTerminalPackContract.js';
import type {
  ZavorthSemanticMemoryDocumentTerminalClaim,
  ZavorthSemanticMemoryDocumentTerminalClaimPriority,
  ZavorthSemanticMemoryDocumentTerminalClaimStatus,
  ZavorthSemanticMemoryDocumentTerminalScenario,
} from '../contracts/ZavorthSemanticMemoryDocumentTerminalCertificationContract.js';

export function packageStatus(evidence: Stage5PackageEvidence): ZavorthSemanticMemoryDocumentTerminalClaimStatus {
  if (evidence.decision === 'owner-gated') {
    return 'owner-gated';
  }
  if (
    evidence.decision === 'replaced-by-existing-zavorth-capability'
    || evidence.decision === 'not-needed'
  ) {
    return 'replaced';
  }
  if (evidence.decision === 'implemented-optional-runtime') {
    return 'owner-gated';
  }
  if (evidence.decision === 'implemented-zavorth-native') {
    return evidence.presentInSource || evidence.zavorthReferenceFiles.length > 0 ? 'covered' : 'gap';
  }
  if (!evidence.presentInSource) {
    return 'gap';
  }
  if (evidence.decision === 'implemented' && !evidence.presentInZavorthPackageJson) {
    return 'gap';
  }
  return 'covered';
}

export function packagePriority(packageName: SourceMemoryDocumentTerminalPackageName): ZavorthSemanticMemoryDocumentTerminalClaimPriority {
  if (
    packageName === '@source/memory-host-sdk'
    || packageName === 'sqlite-vec'
    || packageName === 'pdfjs-dist'
    || packageName === '@mozilla/readability'
    || packageName === 'jsdom'
  ) {
    return 'P0';
  }
  if (packageName === 'node-pty' || packageName === '@lydell/node-pty') {
    return 'P1';
  }
  if (packageName === 'tree-sitter-bash' || packageName === 'web-tree-sitter') {
    return 'P1';
  }
  return 'P2';
}

export function packageEquivalent(
  packageName: SourceMemoryDocumentTerminalPackageName,
  decision: Stage5PackageEvidence['decision'],
): string {
  if (decision === 'implemented-zavorth-native') {
    return 'Zavorth-native memory/artifact runtime capability.';
  }
  if (decision === 'implemented-optional-runtime') {
    return 'Optional governed terminal runtime capability, disabled by default.';
  }
  if (decision === 'owner-gated') {
    return 'Owner-gated parser/runtime enhancement with safe fallback.';
  }
  if (decision === 'replaced-by-existing-zavorth-capability') {
    return 'Existing Zavorth-governed search/network/runtime service.';
  }
  switch (packageName) {
    case 'pdfjs-dist':
      return 'PdfExtractionAdapter artifact-first extraction.';
    case '@mozilla/readability':
    case 'jsdom':
      return 'ReadabilityExtractionAdapter artifact-first extraction.';
    default:
      return 'Zavorth-native runtime capability.';
  }
}

export function scenarioExpectedBehavior(id: ZavorthSemanticMemoryDocumentTerminalScenario['id']): string {
  switch (id) {
    case 'memory-write-query':
      return 'Memory write and query round-trip is replayable and receipt-backed.';
    case 'blocked-live-fetch-without-confirm':
      return 'Live fetch is blocked unless explicit live-network confirmation is provided.';
    case 'blocked-terminal-without-policy':
      return 'Terminal process execution is blocked when runtime policy does not allow execution.';
    case 'blocked-dangerous-command':
      return 'Dangerous shell commands remain blocked even when execution is otherwise requested.';
    default:
      return 'S5 scenario is certified.';
  }
}

export function scenarioEquivalent(id: ZavorthSemanticMemoryDocumentTerminalScenario['id']): string {
  switch (id) {
    case 'memory-write-query':
      return 'SqliteVecMemoryBackend write/query receipts.';
    case 'blocked-live-fetch-without-confirm':
      return 'SourceSearchFetchService fetchUrl guard.';
    case 'blocked-terminal-without-policy':
      return 'GovernedTerminalRuntime execution policy guard.';
    case 'blocked-dangerous-command':
      return 'ShellSafetyClassifier dangerous command block.';
    default:
      return 'S5 guarded runtime receipt.';
  }
}

export function countStatus(
  claims: ZavorthSemanticMemoryDocumentTerminalClaim[],
  status: ZavorthSemanticMemoryDocumentTerminalClaimStatus,
): number {
  return claims.filter((claim) => claim.status === status).length;
}

export function countPriority(
  claims: ZavorthSemanticMemoryDocumentTerminalClaim[],
  priority: ZavorthSemanticMemoryDocumentTerminalClaimPriority,
): number {
  return claims.filter((claim) => claim.priority === priority).length;
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}
