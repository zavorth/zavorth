import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import {
  SkillBundleService,
} from './SkillBundleService.js';
import {
  SkillProvenanceService,
} from './SkillProvenanceService.js';
import type {
  SkillImportAuditReference,
  SkillLicensePolicyDecision,
  SkillMetadata,
  SkillProvenanceMetadata,
  SkillRiskAssessment,
  SkillSupportFile,
  SkillSupportFileKind,
} from './SkillCatalogContract.js';
import {
  SkillSourceRegistryService,
  type SkillSourceRegistryEntry,
} from '../services/SkillSourceRegistryService.js';
import { SkillTrustPolicyService } from '../services/SkillTrustPolicyService.js';
import { LicensePolicyService } from './LicensePolicyService.js';
import { SkillRiskScoringService } from './SkillRiskScoringService.js';

const BLOCKED_ROOT_SUPPORT_FILES = new Set([
  'SKILL.md',
  'ATTRIBUTION.md',
  'ORIGIN.md',
  'ORIGIN.json',
  'EXTERNAL_SOURCE.json',
  'metadata.json',
  'OMNI_ENHANCED.json',
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
]);
const SUPPORT_DIRECTORIES: Array<{ name: string; kind: SkillSupportFileKind }> = [
  { name: 'references', kind: 'reference' },
  { name: 'steps', kind: 'step' },
  { name: 'examples', kind: 'example' },
  { name: 'agents', kind: 'agent' },
];
const SUPPORTED_TEXT_EXTENSIONS = new Set(['.md', '.txt']);
const IGNORED_SKILL_NAMES = new Set([
  'imported',
  'youtube-titulos',
  'youtube-tags-seo',
  'youtube-descricoes-premium',
  'test-skill',
  'native',
]);
export type { SkillMetadata } from './SkillCatalogContract.js';

type LoadSkillOptions = {
  includeSupportFiles?: boolean;
  quiet?: boolean;
};

type SkillLoaderRuntime = {
  sourceRegistryService?: Pick<SkillSourceRegistryService, 'listSearchSources'>;
  skillTrustPolicyService?: Pick<SkillTrustPolicyService, 'evaluateSource' | 'evaluateSkill'>;
  skillBundleService?: Pick<SkillBundleService, 'resolveBundleTags'>;
  skillProvenanceService?: Pick<SkillProvenanceService, 'buildProvenance'>;
  licensePolicyService?: Pick<LicensePolicyService, 'evaluateClassification'>;
  skillRiskScoringService?: Pick<SkillRiskScoringService, 'assessImport'>;
};

/**
 * SkillLoader - le skills aprovadas pelo registry/policy e agrega material auxiliar.
 * A resolucao de fontes deixa de ser hardcoded e passa a ser controlada pelos
 * manifests `config/skill-sources.json` e `config/skill-allowlist.json`.
 */
export class SkillLoader {
  private readonly sourceRegistry: Pick<SkillSourceRegistryService, 'listSearchSources'>;
  private readonly trustPolicy: Pick<SkillTrustPolicyService, 'evaluateSource' | 'evaluateSkill'>;
  private readonly bundleService: Pick<SkillBundleService, 'resolveBundleTags'>;
  private readonly provenanceService: Pick<SkillProvenanceService, 'buildProvenance'>;
  private readonly licensePolicyService: Pick<LicensePolicyService, 'evaluateClassification'>;
  private readonly riskScoringService: Pick<SkillRiskScoringService, 'assessImport'>;

  constructor(runtime: SkillLoaderRuntime = {}) {
    this.sourceRegistry = runtime.sourceRegistryService || new SkillSourceRegistryService();
    this.trustPolicy = runtime.skillTrustPolicyService || new SkillTrustPolicyService();
    this.bundleService = runtime.skillBundleService || new SkillBundleService();
    this.provenanceService = runtime.skillProvenanceService || new SkillProvenanceService();
    this.licensePolicyService = runtime.licensePolicyService || new LicensePolicyService();
    this.riskScoringService = runtime.skillRiskScoringService || new SkillRiskScoringService();
    this.ensureSkillsDirs();
  }

  private ensureSkillsDirs(): void {
    for (const source of this.getSearchSources()) {
      if (!source.createIfMissing) {
        continue;
      }

      if (!fs.existsSync(source.absolutePath)) {
        fs.mkdirSync(source.absolutePath, { recursive: true });
        console.log(`Diretorio de skills criado: ${source.absolutePath}`);
      }
    }
  }

  private getSearchSources(): SkillSourceRegistryEntry[] {
    return this.sourceRegistry.listSearchSources();
  }

  public loadAll(options: LoadSkillOptions = {}): SkillMetadata[] {
    const skillMap = new Map<string, SkillMetadata>();
    const includeSupportFiles = options.includeSupportFiles !== false;
    const quiet = options.quiet === true;

    for (const source of this.getSearchSources()) {
      const sourceDecision = this.trustPolicy.evaluateSource(source.id);
      if (!sourceDecision.allowed) {
        if (!quiet) {
          console.warn(`Fonte de skill bloqueada antes da ingestao: ${source.id} (${sourceDecision.reason})`);
        }
        continue;
      }

      if (!fs.existsSync(source.absolutePath)) {
        continue;
      }

      for (const skillDir of this.discoverSkillDirectories(source)) {
        const skillName = path.basename(skillDir);
        if (IGNORED_SKILL_NAMES.has(skillName)) {
          if (!quiet) {
            console.log(`Skill ignorada por configuracao: ${skillName}`);
          }
          continue;
        }

        const skillFile = path.join(skillDir, 'SKILL.md');

        if (!fs.existsSync(skillFile)) {
          if (!quiet) {
            console.warn(`Skill sem SKILL.md ignorada: ${skillName}`);
          }
          continue;
        }

        try {
          const metadata = this.parseSkillFile(skillFile, skillDir, source, includeSupportFiles);
          if (!metadata) {
            continue;
          }

          const skillDecision = this.trustPolicy.evaluateSkill(source.id, metadata.name);
          if (!skillDecision.allowed) {
            if (!quiet) {
              console.warn(`Skill bloqueada pela allowlist: ${metadata.name} (${skillDecision.reason})`);
            }
            continue;
          }

          if (IGNORED_SKILL_NAMES.has(metadata.name)) {
            if (!quiet) {
              console.log(`Skill ignorada por configuracao: ${metadata.name}`);
            }
            continue;
          }

          if (skillMap.has(metadata.name)) {
            if (!quiet) {
              console.log(`Skill sobrescrita: ${metadata.name}`);
            }
          }

          skillMap.set(metadata.name, metadata);
          if (!quiet) {
            console.log(`Skill carregada: ${metadata.name}`);
          }
        } catch (error) {
          if (!quiet) {
            console.warn(`Erro ao carregar skill "${skillName}": ${error}`);
          }
        }
      }
    }

    const skills = Array.from(skillMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'en-US')
    );

    if (!quiet) {
      console.log(`Total de skills carregadas: ${skills.length}`);
    }
    return skills;
  }

  private discoverSkillDirectories(source: SkillSourceRegistryEntry): string[] {
    if (!this.shouldDiscoverNestedSkills(source)) {
      return fs.readdirSync(source.absolutePath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(source.absolutePath, entry.name));
    }

    const results: string[] = [];
    const visit = (dir: string, depth: number): void => {
      if (depth > 6) {
        return;
      }
      const skillFile = path.join(dir, 'SKILL.md');
      if (depth > 0 && fs.existsSync(skillFile)) {
        results.push(dir);
        return;
      }
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        visit(path.join(dir, entry.name), depth + 1);
      }
    };

    visit(source.absolutePath, 0);
    return results;
  }

  private shouldDiscoverNestedSkills(source: SkillSourceRegistryEntry): boolean {
    const normalizedPath = source.path.replace(/\\/g, '/').replace(/\/+$/g, '');
    return source.id === 'workspace-imported-library'
      || normalizedPath.endsWith('skill-library/imported');
  }

  public getSkillContent(skillDirPath: string): string {
    const skillFile = path.join(skillDirPath, 'SKILL.md');
    return this.readPromptFile(skillFile, true);
  }

  public buildSkillPrompt(skill: SkillMetadata): string {
    const sections: string[] = [];
    const mainContent = this.readPromptFile(skill.skillFilePath, true);

    if (mainContent) {
      sections.push(mainContent);
    }

    for (const supportFilePath of skill.supportFilePaths) {
      const content = this.readPromptFile(supportFilePath);
      if (!content) {
        continue;
      }

      const relativePath = path.relative(skill.dirPath, supportFilePath).replace(/\\/g, '/');
      sections.push(`## Material auxiliar: ${relativePath}\n${content}`);
    }

    return sections.join('\n\n').trim();
  }

  private parseSkillFile(
    filePath: string,
    dirPath: string,
    source: SkillSourceRegistryEntry,
    includeSupportFiles: boolean,
  ): SkillMetadata | null {
    const raw = this.readRawFile(filePath);
    const frontmatter = this.readFrontmatterFields(raw);
    if (!frontmatter) {
      console.warn(`SKILL.md sem frontmatter YAML: ${filePath}`);
      return null;
    }

    if (!frontmatter || !frontmatter.name || !frontmatter.description) {
      console.warn(`Frontmatter incompleto (precisa de name e description): ${filePath}`);
      return null;
    }
    const provenance = this.enrichProvenance(
      source,
      this.provenanceService.buildProvenance(source, dirPath),
    );
    const supportFiles = includeSupportFiles ? this.collectSupportFiles(dirPath, frontmatter.name, source) : [];
    const bundleTags = this.bundleService.resolveBundleTags({
      name: frontmatter.name,
      description: frontmatter.description,
      supportFileCount: supportFiles.length,
      provenance,
    });

    return {
      name: frontmatter.name,
      description: frontmatter.description,
      dirPath,
      skillFilePath: filePath,
      supportFilePaths: supportFiles.map((entry) => entry.path),
      supportFiles,
      sourceId: source.id,
      sourceLabel: source.label,
      sourceKind: source.kind,
      sourceTrust: source.trust,
      sourceRegistrySource: source.registrySource,
      license: provenance.license,
      bundleTags,
      provenance,
      risk: provenance.risk || null,
      licensePolicy: provenance.licensePolicy || null,
      audit: provenance.audit || null,
    };
  }

  private enrichProvenance(
    source: SkillSourceRegistryEntry,
    provenance: SkillProvenanceMetadata,
  ): SkillProvenanceMetadata {
    const licensePolicy = provenance.licensePolicy || this.buildFallbackLicensePolicy(provenance.license);
    const risk = provenance.risk || this.buildFallbackRisk(source, provenance, licensePolicy);
    const audit = provenance.audit || this.buildFallbackAudit(source, provenance);

    return {
      ...provenance,
      licensePolicy,
      risk,
      audit,
    };
  }

  private buildFallbackLicensePolicy(license: string | null): SkillLicensePolicyDecision | null {
    if (!license) {
      return null;
    }
    return this.licensePolicyService.evaluateClassification({
      license,
      confidence: 'low',
      evidence: ['runtime-fallback'],
    });
  }

  private buildFallbackRisk(
    source: SkillSourceRegistryEntry,
    provenance: SkillProvenanceMetadata,
    licensePolicy: SkillLicensePolicyDecision | null,
  ): SkillRiskAssessment | null {
    if (!provenance.imported) {
      return null;
    }

    return this.riskScoringService.assessImport({
      sourceTrust: source.trust,
      sourceAllowed: true,
      scanIssues: [],
      license: provenance.license,
      licenseConfidence: provenance.license ? 'low' : 'low',
      licensePolicy: licensePolicy || this.licensePolicyService.evaluateClassification({
        license: provenance.license,
        confidence: 'low',
        evidence: ['runtime-fallback'],
      }),
      importableFileCount: 1,
      skippedFileCount: 0,
    });
  }

  private buildFallbackAudit(
    source: SkillSourceRegistryEntry,
    provenance: SkillProvenanceMetadata,
  ): SkillImportAuditReference | null {
    if (!provenance.imported) {
      return null;
    }

    return {
      lastEventId: null,
      trailFilePath: path.join(source.absolutePath, '.zavorth-import-audit.json'),
      lastAction: 'import',
      lastRecordedAt: provenance.importedAt || null,
    };
  }

  private readFrontmatterFields(raw: string): Record<string, string> | null {
    const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
    if (!match) {
      return null;
    }

    const frontmatterBlock = match[1];
    try {
      const parsed = yaml.load(frontmatterBlock);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>)
            .map(([key, value]) => [key, String(value ?? '').trim()]),
        );
      }
    } catch {
      // fallback abaixo para frontmatters mais permissivos
    }

    const fields: Record<string, string> = {};
    for (const line of frontmatterBlock.split(/\r?\n/)) {
      const fieldMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
      if (!fieldMatch) {
        continue;
      }
      fields[fieldMatch[1]] = this.normalizeFrontmatterValue(fieldMatch[2]);
    }
    return fields;
  }

  private normalizeFrontmatterValue(value: string): string {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return '';
    }
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
      || (trimmed.startsWith('\'') && trimmed.endsWith('\''))
    ) {
      return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, '\'').trim();
    }
    return trimmed.replace(/\\"/g, '"').replace(/\\'/g, '\'').trim();
  }

  private collectSupportFiles(
    skillDirPath: string,
    skillName: string,
    source: SkillSourceRegistryEntry,
  ): SkillSupportFile[] {
    const supportFiles = new Map<string, SkillSupportFile>();

    for (const entry of fs.readdirSync(skillDirPath, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }
      if (!SUPPORTED_TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }
      if (BLOCKED_ROOT_SUPPORT_FILES.has(entry.name)) {
        continue;
      }

      const filePath = path.join(skillDirPath, entry.name);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        this.storeSupportFile(supportFiles, skillDirPath, filePath, 'root');
      }
    }

    for (const directoryEntry of SUPPORT_DIRECTORIES) {
      const directoryPath = path.join(skillDirPath, directoryEntry.name);
      if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
        continue;
      }

      for (const filePath of this.collectTextFilesRecursively(directoryPath)) {
        this.storeSupportFile(supportFiles, skillDirPath, filePath, directoryEntry.kind);
      }
    }

    for (const filePath of this.collectExternalSupportFiles(skillDirPath, skillName, source)) {
      this.storeSupportFile(supportFiles, skillDirPath, filePath, 'external');
    }

    return Array.from(supportFiles.values()).sort((a, b) =>
      a.relativePath.localeCompare(b.relativePath, 'en-US')
    );
  }

  private collectExternalSupportFiles(
    skillDirPath: string,
    skillName: string,
    source: SkillSourceRegistryEntry,
  ): string[] {
    const directories: string[] = [];

    const collected = new Set<string>();
    for (const directoryPath of directories) {
      if (!this.isAllowedExternalSupportDirectory(directoryPath, source)) {
        continue;
      }

      if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
        continue;
      }

      for (const filePath of this.collectTextFilesRecursively(directoryPath)) {
        collected.add(filePath);
      }
    }

    return Array.from(collected);
  }

  private storeSupportFile(
    supportFiles: Map<string, SkillSupportFile>,
    skillDirPath: string,
    filePath: string,
    kind: SkillSupportFileKind,
  ): void {
    const normalizedPath = path.resolve(filePath);
    const relativePath = path.relative(skillDirPath, normalizedPath).replace(/\\/g, '/');
    supportFiles.set(normalizedPath, {
      path: normalizedPath,
      relativePath,
      kind,
      external: kind === 'external',
    });
  }

  private isAllowedExternalSupportDirectory(
    directoryPath: string,
    source: SkillSourceRegistryEntry,
  ): boolean {
    const allowedRoots = Array.isArray(source.absoluteAllowedExternalSupportPaths)
      ? source.absoluteAllowedExternalSupportPaths
      : [];
    if (allowedRoots.length === 0) {
      return false;
    }

    const normalizedTarget = path.resolve(directoryPath).toLowerCase();
    return allowedRoots.some((rootPath) => {
      const normalizedRoot = path.resolve(rootPath).toLowerCase();
      return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`);
    });
  }

  private collectTextFilesRecursively(directoryPath: string): string[] {
    const collected: string[] = [];
    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        collected.push(...this.collectTextFilesRecursively(entryPath));
        continue;
      }

      if (SUPPORTED_TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        collected.push(entryPath);
      }
    }

    return collected;
  }

  private readPromptFile(filePath: string, stripFrontmatter = false): string {
    const raw = this.readRawFile(filePath);
    if (!raw) {
      return '';
    }

    if (!stripFrontmatter) {
      return raw.trim();
    }

    const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
    if (match) {
      return match[2].trim();
    }

    return raw.trim();
  }

  private readRawFile(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      return '';
    }

    return fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  }
}
