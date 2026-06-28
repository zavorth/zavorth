import path from 'path';
import {
  SkillContentScannerService,
  type SkillContentScanResult,
} from './SkillContentScannerService.js';

export type SkillHubSourceTrust = 'builtin' | 'trusted' | 'review' | 'community' | 'agent-created' | 'unknown';
export type SkillHubGuardVerdict = 'safe' | 'caution' | 'dangerous';
export type SkillHubGuardDecision = 'allow' | 'review' | 'block';

export type SkillHubGuardSnapshot = {
  contractVersion: 'zavorth.skill-hub-guard/v1';
  generatedAt: string;
  skillDirPath: string;
  sourceTrust: SkillHubSourceTrust;
  verdict: SkillHubGuardVerdict;
  decision: SkillHubGuardDecision;
  reasons: string[];
  scan: SkillContentScanResult;
  policy: {
    metadataFirst: true;
    noExecutionDuringScan: true;
    denyByDefaultForUnknownSources: true;
    quarantineBeforeInstall: true;
    selectiveImportOnly: true;
  };
};

type SkillHubGuardRuntime = {
  now?: () => Date;
  scanner?: Pick<SkillContentScannerService, 'scanSkillDirectory'>;
};

export class SkillHubGuardService {
  private readonly now: () => Date;
  private readonly scanner: Pick<SkillContentScannerService, 'scanSkillDirectory'>;

  constructor(runtime: SkillHubGuardRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.scanner = runtime.scanner || new SkillContentScannerService();
  }

  public evaluateSkillDirectory(input: {
    skillDirPath: string;
    sourceTrust?: SkillHubSourceTrust | string | null;
  }): SkillHubGuardSnapshot {
    const skillDirPath = path.resolve(input.skillDirPath);
    const sourceTrust = normalizeSourceTrust(input.sourceTrust);
    const scan = this.scanner.scanSkillDirectory(skillDirPath);
    const reasons: string[] = [];

    if (!scan.safeToImport) {
      reasons.push('Conteudo bloqueado pelo scanner seletivo.');
    }
    if (scan.skippedFiles.length > 0) {
      reasons.push('Arquivos fora do contrato de skill foram ignorados.');
    }
    if (scan.issues.some((issue) => issue.severity === 'warn')) {
      reasons.push('Avisos de seguranca exigem revisao antes de promover a skill.');
    }
    if (sourceTrust === 'community' || sourceTrust === 'agent-created' || sourceTrust === 'unknown') {
      reasons.push('Fonte sem confianca plena exige quarentena e revisao.');
    }

    const hasErrors = scan.issues.some((issue) => issue.severity === 'error');
    const hasWarnings = scan.issues.some((issue) => issue.severity === 'warn') || scan.skippedFiles.length > 0;
    const trustedSource = sourceTrust === 'builtin' || sourceTrust === 'trusted';
    const verdict: SkillHubGuardVerdict = hasErrors
      ? 'dangerous'
      : hasWarnings || !trustedSource
        ? 'caution'
        : 'safe';
    const decision: SkillHubGuardDecision = verdict === 'dangerous'
      ? 'block'
      : verdict === 'caution'
        ? 'review'
        : 'allow';

    if (reasons.length === 0) {
      reasons.push('Skill textual, fonte confiavel e sem issues de importacao.');
    }

    return {
      contractVersion: 'zavorth.skill-hub-guard/v1',
      generatedAt: this.now().toISOString(),
      skillDirPath,
      sourceTrust,
      verdict,
      decision,
      reasons,
      scan,
      policy: {
        metadataFirst: true,
        noExecutionDuringScan: true,
        denyByDefaultForUnknownSources: true,
        quarantineBeforeInstall: true,
        selectiveImportOnly: true,
      },
    };
  }
}

function normalizeSourceTrust(value: SkillHubSourceTrust | string | null | undefined): SkillHubSourceTrust {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'builtin' || normalized === 'native' || normalized === 'official') return 'builtin';
  if (normalized === 'trusted' || normalized === 'local') return 'trusted';
  if (normalized === 'review') return 'review';
  if (normalized === 'community') return 'community';
  if (normalized === 'agent-created' || normalized === 'agent_created' || normalized === 'generated') return 'agent-created';
  return 'unknown';
}
