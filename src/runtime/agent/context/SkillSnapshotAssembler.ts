import {
  SkillScanner,
  type SkillManifest,
} from '../../../context-engine/SkillScanner.js';
import { wrapUntrustedContent } from '../../../security/UntrustedContent.js';
import {
  SkillQuarantinePolicy,
  sanitizeTrustPlaneText,
  summarizeImportedCapabilityTrust,
  type ImportedCapabilityRiskReport,
  type ImportedCapabilityTrustState,
  type ImportedCapabilityTrustSummary,
} from '../security/index.js';
import type { CanonicalColdContextInput } from './CanonicalSessionContextAssembler.js';

export type SkillSnapshotScanner = Pick<SkillScanner, 'scan'>;
export type SkillSnapshotQuarantinePolicy = Pick<SkillQuarantinePolicy, 'evaluate'>;

export type SkillSnapshotAssemblerOptions = {
  scanner?: SkillSnapshotScanner | null;
  quarantinePolicy?: SkillSnapshotQuarantinePolicy | null;
};

export type SkillSnapshotAssemblerInput = {
  directories?: string[] | null;
  manifests?: SkillManifest[] | null;
  maxPromptChars?: number;
  metadata?: Record<string, unknown>;
};

export type SkillSnapshotEntry = {
  id: string;
  directory: string;
  toolCount: number;
  toolNames: string[];
  hasToolsMarkdown: boolean;
  hasEntryPoint: boolean;
  trustState: ImportedCapabilityTrustState;
  quarantined: boolean;
  riskReport: ImportedCapabilityRiskReport;
  metadata: Record<string, unknown>;
  summary: string | null;
};

export type SkillSnapshot = {
  status: 'available' | 'unavailable' | 'failed';
  skillCount: number;
  toolCount: number;
  trustSummary: ImportedCapabilityTrustSummary;
  skills: SkillSnapshotEntry[];
  cold: Pick<CanonicalColdContextInput, 'skillPrompt' | 'metadata'>;
  metadata: Record<string, unknown>;
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeDirectories(directories: string[] | null | undefined): string[] {
  return Array.from(new Set(
    (directories || [])
      .map(normalizeText)
      .filter(Boolean),
  ));
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function summarizeMarkdown(value: string | null): string | null {
  const firstLine = normalizeText(
    String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean),
  );
  return firstLine ? sanitizeTrustPlaneText(firstLine, { maxChars: 240 }) : null;
}

function toolName(tool: unknown): string | null {
  const record = normalizeRecord(tool);
  const name = normalizeText(record.name);
  return name || null;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

export class SkillSnapshotAssembler {
  private readonly scanner: SkillSnapshotScanner;
  private readonly quarantinePolicy: SkillSnapshotQuarantinePolicy;

  constructor(options: SkillSnapshotAssemblerOptions = {}) {
    this.scanner = options.scanner || new SkillScanner();
    this.quarantinePolicy = options.quarantinePolicy || new SkillQuarantinePolicy();
  }

  public assemble(input: SkillSnapshotAssemblerInput = {}): SkillSnapshot {
    const directories = normalizeDirectories(input.directories);
    const maxPromptChars = Math.max(240, input.maxPromptChars || 1800);

    try {
      const manifests = Array.isArray(input.manifests)
        ? input.manifests
        : directories.length > 0
          ? this.scanner.scan(directories)
          : [];
      const skills = manifests.map((manifest) => this.toEntry(manifest));
      const toolCount = skills.reduce((total, skill) => total + skill.toolCount, 0);
      const trustSummary = summarizeImportedCapabilityTrust(skills);
      const riskReports = skills.map((skill) => skill.riskReport);
      const status = skills.length > 0 ? 'available' : 'unavailable';
      const metadata: Record<string, unknown> = {
        ...(input.metadata || {}),
        source: 'SkillScanner',
        directories,
        status,
        skillCount: skills.length,
        toolCount,
        trustSummary,
        riskReports,
        toolExposureGatedBySkillSnapshot: false,
      };

      return {
        status,
        skillCount: skills.length,
        toolCount,
        trustSummary,
        skills,
        cold: {
          skillPrompt: status === 'available' ? this.buildPrompt(skills, maxPromptChars) : null,
          metadata,
        },
        metadata,
      };
    } catch (error: any) { const err = error; const e = error;
      const metadata: Record<string, unknown> = {
        ...(input.metadata || {}),
        source: 'SkillScanner',
        directories,
        status: 'failed',
        error: error?.message || String(error),
        trustSummary: {
          trusted: 0,
          safe: 0,
          quarantined: 0,
        },
        riskReports: [],
        toolExposureGatedBySkillSnapshot: false,
      };

      return {
        status: 'failed',
        skillCount: 0,
        toolCount: 0,
        trustSummary: {
          trusted: 0,
          safe: 0,
          quarantined: 0,
        },
        skills: [],
        cold: {
          skillPrompt: null,
          metadata,
        },
        metadata,
      };
    }
  }

  private toEntry(manifest: SkillManifest): SkillSnapshotEntry {
    const toolNames = (manifest.toolDefinitions || [])
      .map(toolName)
      .map((name) => name ? sanitizeTrustPlaneText(name, { maxChars: 120 }) : null)
      .filter((name): name is string => Boolean(name));
    const riskReport = {
      ...this.quarantinePolicy.evaluate(manifest),
      toolNames,
    };

    return {
      id: sanitizeTrustPlaneText(normalizeText(manifest.id), { maxChars: 120 }),
      directory: normalizeText(manifest.directory),
      toolCount: toolNames.length,
      toolNames,
      hasToolsMarkdown: Boolean(normalizeText(manifest.toolsMarkdown)),
      hasEntryPoint: Boolean(normalizeText(manifest.entryPoint)),
      trustState: riskReport.trustState,
      quarantined: riskReport.quarantined,
      riskReport,
      metadata: normalizeRecord(manifest.metadata),
      summary: summarizeMarkdown(manifest.toolsMarkdown),
    };
  }

  private buildPrompt(skills: SkillSnapshotEntry[], maxPromptChars: number): string {
    const lines = [
      'SKILLS DISPONIVEIS:',
      'Este snapshot informa skills descobertas; execucao e exposicao de tools continuam sob policy do runtime.',
      ...skills.map((skill) => {
        const tools = skill.quarantined
          ? 'tools ocultas ate review'
          : skill.toolNames.length > 0
            ? skill.toolNames.join(', ')
            : 'sem tools declaradas';
        const prefix = sanitizeTrustPlaneText(`- ${skill.id} [${skill.trustState}]: ${tools}`, {
          maxChars: 600,
        });
        if (!skill.summary) {
          return prefix;
        }
        const wrappedSummary = wrapUntrustedContent('untrusted_skill_content', skill.summary, {
          skill_id: skill.id,
          source: 'skill_manifest_summary',
        }).replace(/\n/g, ' ');
        return `${prefix} - resumo: ${wrappedSummary}`;
      }),
    ];

    return truncate(lines.join('\n'), maxPromptChars);
  }
}
