import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import type {
ZavorthDomainId,
  ZavorthDomainProfile,
  ZavorthDomainResolution,
  ZavorthDomainSpecializationContract,
} from '../contracts/DomainSpecializationContract.js';

type FileSystemLike = {
  existsSync: typeof fs.existsSync;
  mkdirSync: typeof fs.mkdirSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
  unlinkSync: typeof fs.unlinkSync;
};

export type DomainSpecializationServiceOptions = {
  projectRoot?: string;
  fs?: Partial<FileSystemLike>;
};

export type DomainResolveInput = {
  domainId?: ZavorthDomainId;
  intent?: string;
};

const DOMAIN_CATALOG: ZavorthDomainProfile[] = [
  {
    id: 'software-engineering',
    label: 'Software Engineering',
    audience: 'developers, architects, QA',
    vocabulary: ['api', 'sdk', 'refactor', 'dependency', 'ci/cd', 'unit test', 'deploy'],
    preferredTools: ['shell.execute', 'file.read', 'file.write', 'subagent.delegate'],
    assumptions: ['code quality matters', 'tests are expected', 'version control is used'],
    commonWorkflows: ['feature-branch', 'bug-fix', 'code-review', 'refactor'],
    naturalAliases: ['dev', 'coding', 'programming', 'engenharia de software', 'programacao', 'desenvolvimento'],
  },
  {
    id: 'data-science',
    label: 'Data Science',
    audience: 'analysts, data engineers, ML engineers',
    vocabulary: ['dataset', 'model', 'pipeline', 'feature', 'training', 'inference', 'eda'],
    preferredTools: ['file.read', 'shell.execute', 'subagent.delegate'],
    assumptions: ['data quality is critical', 'reproducibility matters', 'notebooks are common'],
    commonWorkflows: ['eda', 'model-training', 'data-pipeline', 'reporting'],
    naturalAliases: ['data', 'ml', 'machine learning', 'ciencia de dados', 'analise de dados'],
  },
  {
    id: 'devops',
    label: 'DevOps',
    audience: 'SRE, platform engineers, ops',
    vocabulary: ['container', 'kubernetes', 'terraform', 'pipeline', 'monitoring', 'incident'],
    preferredTools: ['shell.execute', 'file.read', 'file.write', 'network.fetch'],
    assumptions: ['infrastructure as code', 'automation over manual', 'observability is key'],
    commonWorkflows: ['deploy', 'incident-response', 'infra-change', 'monitoring-setup'],
    naturalAliases: ['infra', 'sre', 'platform', 'operacoes', 'devops'],
  },
  {
    id: 'creative-writing',
    label: 'Creative Writing',
    audience: 'writers, content creators, marketers',
    vocabulary: ['draft', 'tone', 'audience', 'narrative', 'copy', 'edit', 'publish'],
    preferredTools: ['file.read', 'file.write'],
    assumptions: ['voice matters', 'iteration is normal', 'feedback is valuable'],
    commonWorkflows: ['brainstorm', 'draft', 'edit', 'publish'],
    naturalAliases: ['writing', 'content', 'escrita', 'redacao', 'conteudo'],
  },
  {
    id: 'business-ops',
    label: 'Business Operations',
    audience: 'managers, founders, operators',
    vocabulary: ['kpi', 'okr', 'process', 'workflow', 'stakeholder', 'budget', 'roadmap'],
    preferredTools: ['file.read', 'file.write', 'network.fetch'],
    assumptions: ['clarity over perfection', 'decisions need context', 'time is scarce'],
    commonWorkflows: ['planning', 'reporting', 'process-improvement', 'decision-making'],
    naturalAliases: ['business', 'ops', 'management', 'negocios', 'gestao', 'operacoes'],
  },
  {
    id: 'research',
    label: 'Research',
    audience: 'researchers, academics, scientists',
    vocabulary: ['hypothesis', 'methodology', 'findings', 'peer-review', 'citation', 'dataset'],
    preferredTools: ['network.fetch', 'file.read', 'file.write'],
    assumptions: ['evidence matters', 'sources must be cited', 'reproducibility is key'],
    commonWorkflows: ['literature-review', 'experiment', 'analysis', 'paper-writing'],
    naturalAliases: ['pesquisa', 'research', 'academia', 'estudo', 'cientifico'],
  },
  {
    id: 'education',
    label: 'Education',
    audience: 'teachers, students, trainers',
    vocabulary: ['curriculum', 'lesson', 'assessment', 'learning-objective', 'rubric'],
    preferredTools: ['file.read', 'file.write'],
    assumptions: ['scaffolding helps', 'feedback is formative', 'diverse learners exist'],
    commonWorkflows: ['lesson-planning', 'assessment-creation', 'feedback', 'content-curation'],
    naturalAliases: ['teaching', 'learning', 'educacao', 'ensino', 'aula', 'treinamento'],
  },
  {
    id: 'healthcare',
    label: 'Healthcare',
    audience: 'clinicians, health admins, researchers',
    vocabulary: ['patient', 'diagnosis', 'protocol', 'compliance', 'hipaa', 'clinical'],
    preferredTools: ['file.read', 'file.write'],
    assumptions: ['privacy is paramount', 'accuracy is critical', 'regulations apply'],
    commonWorkflows: ['documentation', 'protocol-review', 'research', 'compliance-check'],
    naturalAliases: ['health', 'medical', 'clinical', 'saude', 'medicina', 'clinica'],
  },
  {
    id: 'legal',
    label: 'Legal',
    audience: 'lawyers, compliance officers, paralegals',
    vocabulary: ['contract', 'clause', 'jurisdiction', 'compliance', 'liability', 'precedent'],
    preferredTools: ['file.read', 'file.write', 'network.fetch'],
    assumptions: ['precision is essential', 'citations matter', 'confidentiality is critical'],
    commonWorkflows: ['contract-review', 'research', 'drafting', 'compliance-audit'],
    naturalAliases: ['law', 'legal', 'juridico', 'direito', 'contrato'],
  },
  {
    id: 'finance',
    label: 'Finance',
    audience: 'accountants, analysts, CFOs',
    vocabulary: ['revenue', 'expense', 'forecast', 'audit', 'compliance', 'roi'],
    preferredTools: ['file.read', 'file.write', 'network.fetch'],
    assumptions: ['numbers must be accurate', 'regulations apply', 'transparency is key'],
    commonWorkflows: ['reporting', 'forecasting', 'audit', 'analysis'],
    naturalAliases: ['accounting', 'financial', 'financas', 'contabilidade', 'fiscal'],
  },
  {
    id: 'general',
    label: 'General',
    audience: 'everyone',
    vocabulary: [],
    preferredTools: ['file.read', 'file.write'],
    assumptions: ['be helpful', 'be clear', 'be concise'],
    commonWorkflows: [],
    naturalAliases: ['general', 'default', 'geral', 'padrao'],
  },
];

export class DomainSpecializationService {
  private readonly projectRoot: string;
  private readonly fs: FileSystemLike;

  constructor(options: DomainSpecializationServiceOptions = {}) {
    this.projectRoot = path.resolve(options.projectRoot || config.projectRoot);
    this.fs = {
      existsSync: options.fs?.existsSync || fs.existsSync.bind(fs),
      mkdirSync: options.fs?.mkdirSync || fs.mkdirSync.bind(fs),
      readFileSync: options.fs?.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: options.fs?.writeFileSync || fs.writeFileSync.bind(fs),
      unlinkSync: options.fs?.unlinkSync || fs.unlinkSync.bind(fs),
    };
  }

  public listDomains(): ZavorthDomainProfile[] {
    return [...DOMAIN_CATALOG];
  }

  public resolve(input: DomainResolveInput): ZavorthDomainResolution {
    if (input.domainId) {
      const domain = DOMAIN_CATALOG.find((d) => d.id === input.domainId);
      if (domain) {
        return { domainId: domain.id, confidence: 'explicit', reason: `Explicit selection: ${domain.id}`, matchedSignals: [] };
      }
    }
    if (input.intent) {
      const lower = input.intent.toLowerCase();
      for (const domain of DOMAIN_CATALOG) {
        if (domain.id === 'general') continue;
        const matches = domain.naturalAliases.filter((a) => lower.includes(a.toLowerCase()));
        if (matches.length > 0) {
          return { domainId: domain.id, confidence: 'high', reason: `Intent matched aliases: ${matches.join(', ')}`, matchedSignals: matches };
        }
        const vocabMatches = domain.vocabulary.filter((v) => lower.includes(v.toLowerCase()));
        if (vocabMatches.length >= 2) {
          return { domainId: domain.id, confidence: 'medium', reason: `Vocabulary overlap: ${vocabMatches.join(', ')}`, matchedSignals: vocabMatches };
        }
      }
    }
    return { domainId: 'general', confidence: 'fallback', reason: 'No matching domain found', matchedSignals: [] };
  }

  public buildContract(input: DomainResolveInput): ZavorthDomainSpecializationContract {
    const resolution = this.resolve(input);
    const domain = DOMAIN_CATALOG.find((d) => d.id === resolution.domainId) || DOMAIN_CATALOG.find((d) => d.id === 'general')!;
    return {
      schemaVersion: 1,
      surface: 'domain-specialization',
      selected: {
        domainId: domain.id,
        vocabulary: domain.vocabulary,
        preferredTools: domain.preferredTools,
        assumptions: domain.assumptions,
      },
      resolution,
      domains: this.listDomains(),
    };
  }

  public applyDomain(domainId: ZavorthDomainId): void {
    const filePath = path.join(this.projectRoot, 'DOMAIN.md');
    const domain = DOMAIN_CATALOG.find((d) => d.id === domainId) || DOMAIN_CATALOG.find((d) => d.id === 'general')!;
    const content = [
      `# DOMAIN.md - Active Domain Specialization`,
      ``,
      `- **Domain:** ${domain.label}`,
      `- **Audience:** ${domain.audience}`,
      `- **Vocabulary:** ${domain.vocabulary.join(', ') || 'general'}`,
      `- **Preferred tools:** ${domain.preferredTools.join(', ')}`,
      ``,
      `## Assumptions`,
      ``,
      ...domain.assumptions.map((a) => `- ${a}`),
      ``,
      `## Common workflows`,
      ``,
      ...domain.commonWorkflows.map((w) => `- ${w}`),
    ].join('\n');
    this.writeText(filePath, content);
  }

  public renderText(contract: ZavorthDomainSpecializationContract): string {
    const d = contract.selected;
    const r = contract.resolution;
    const lines = [
      `Domain: ${d.domainId} (${r.confidence})`,
      `Reason: ${r.reason}`,
      d.vocabulary.length > 0 ? `Vocabulary: ${d.vocabulary.join(', ')}` : '',
      `Assumptions: ${d.assumptions.join('; ')}`,
      `Tools: ${d.preferredTools.join(', ')}`,
    ].filter(Boolean);
    return lines.join('\n');
  }

  private readText(filePath: string, fallback: string): string {
    try {
      if (!this.fs.existsSync(filePath)) return fallback;
      return String(this.fs.readFileSync(filePath, 'utf8') || '');
    } catch (error: unknown) {logger.warn('[Domain Specialization] filesystem operation failed', error); return fallback; }
  }

  private writeText(filePath: string, content: string): void {
    this.fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
