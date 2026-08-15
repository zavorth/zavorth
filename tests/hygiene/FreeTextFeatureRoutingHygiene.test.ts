/**
 * Package C — static hygiene: free-text must not re-grow keyword→feature packs
 * on agent-first hot paths. See docs/product/free-text-purity-matrix.md
 */
import fs from 'node:fs';
import path from 'node:path';


const root = path.resolve(__dirname, '../../');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

/** Forbidden markers that historically activated product features from free text. */
const FORBIDDEN_HOTPATH_MARKERS: Array<{ label: string; re: RegExp; files: string[] }> = [
  {
    label: 'pack pillar keyword RE dictionaries',
    re: /\b(WORKFLOW_RE|CONVO_RE|ABOUT_RE|KNOWLEDGE_RE)\b/,
    files: ['src/services/learned-knowledge/LearnedKnowledgePlaneService.ts'],
  },
  {
    label: 'runtime maintenance free-text phrase packs',
    re: /se autorepare|se autoatualize|resumo das ultimas alteracoes|resuma.*ultimas.*(alteracoes|mudancas)/i,
    files: ['src/domain/surface/presentation/shared-surface/SharedSurfacePresentationCommandPack.ts'],
  },
  {
    label: 'experience profile free-text resuma→executive',
    re: /\(resuma\|resumo\)\.\*\(impacto\|decisao\)|resuma.*impacto.*decisao/i,
    files: ['src/cli/ZavorthCliRegistryExperience.ts', 'src/ai-gateway/app/api/experience/experienceRouteSupport.ts'],
  },
  {
    label: 'team/swarm free-text intent regex',
    re: /equipe de agentes|multi-?agent team|\\bswarm\\b.*\\.test\(|isTeamIntent.*\.test\(/i,
    files: ['src/runtime/agent/AgentTeamCompilerService.ts'],
  },
  {
    label: 'free-text bare approve phrase dictionary',
    re: /\\b(aprovo|autorizo|pode continuar|pode seguir)\\b/,
    files: ['src/runtime/agent/UniversalApprovalIntentResolver.ts'],
  },
  {
    label: 'UX router free-text feature phrase maps',
    re: /resuma o estado|link do PR|\\b(resuma|mostre|me diga)\\b.*kind\s*=/,
    files: ['src/services/UserExperienceIntentRouter.ts'],
  },
];

const REQUIRED_INVARIANTS: Array<{ file: string; markers: Array<{ label: string; re: RegExp }> }> = [
  {
    file: 'src/services/UserExperienceIntentRouter.ts',
    markers: [
      { label: 'model-owned free text', re: /free-text-model-owned|model-owned/i },
      { label: 'no keyword scan comment or reason', re: /keyword/i },
    ],
  },
  {
    file: 'src/services/learned-knowledge/LearnedKnowledgePlaneService.ts',
    markers: [
      { label: 'equal pillar weights', re: /equalPillarWeights/ },
      { label: 'no keyword intent routing safety', re: /noKeywordIntentRouting:\s*true/ },
      {
        label: 'scoreLearnedKnowledgeIntent is equal-weight shim',
        re: /scoreLearnedKnowledgeIntent[\s\S]{0,200}equalPillarWeights/,
      },
    ],
  },
  {
    file: 'src/runtime/agent/AgentTeamCompilerService.ts',
    markers: [
      { label: 'structured team intent only', re: /Structured signals only|structural only/i },
      { label: 'no free-text regex comment', re: /no free-text regex/i },
    ],
  },
  {
    file: 'src/runtime/agent/UniversalApprovalIntentResolver.ts',
    markers: [
      { label: 'free-text never keyword-routes approve', re: /Free text never keyword-routes into approve/i },
      { label: 'explicit slash only', re: /Explicit slash only/i },
    ],
  },
  {
    file: 'src/domain/surface/presentation/shared-surface/SharedSurfacePresentationCommandPack.ts',
    markers: [
      { label: 'maintenance intent no-op return null', re: /parseRuntimeMaintenanceIntent[\s\S]{0,400}return null/ },
    ],
  },
  {
    file: 'src/cli/ZavorthCliRegistryExperience.ts',
    markers: [
      { label: 'explicit CLI profile tokens', re: /Explicit CLI profile tokens only|never free-text keyword/i },
    ],
  },
  {
    file: 'src/gateways/channels/telegram/AuthGuard.ts',
    markers: [{ label: 'privileged slash only', re: /Privileged slash tokens only|startsWith\('\/'\)/ }],
  },
  {
    file: 'docs/product/free-text-purity-matrix.md',
    markers: [
      { label: 'forbidden table', re: /## Forbidden/ },
      { label: 'allowed table', re: /## Allowed/ },
      { label: 'hot-path watchlist', re: /Hot-path files/ },
    ],
  },
];

/** Default EN product strings on critical free-text/approval paths (i18n via locale files only). */
const EN_CRITICAL_FILES: Array<{ file: string; forbidden: RegExp; allowlist?: RegExp[] }> = [
  {
    file: 'src/runtime/agent/UniversalApprovalIntentResolver.ts',
    // Accented PT / common product PT leftovers in reason strings
    forbidden:
      /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]|\b(nao parece|Nenhum approval|Ha mais|Aprovado|Rejeitado|Confirmacao|Rejeicao resolvida|Approval resolvido)\b/,
    allowlist: [
      // slash token aliases intentionally bilingual
      /aprovar|aprova|rejeitar|rejeite|negar/,
    ],
  },
  {
    file: 'src/runtime/agent/AgentTeamCompilerService.ts',
    forbidden: /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]|\b(Lancar|intencao|pedido da run|Acoes de equipe|Sem intencao)\b/,
  },
  {
    file: 'src/services/UserExperienceIntentRouter.ts',
    forbidden: /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/,
  },
  {
    file: 'src/services/learned-knowledge/LearnedKnowledgePlaneService.ts',
    forbidden: /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/,
  },
  {
    file: 'src/services/learned-knowledge/LearnedKnowledgeAdvanced.ts',
    forbidden: /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/,
  },
  {
    file: 'src/cli/ZavorthCliRegistryExperience.ts',
    forbidden: /neste runtime/,
  },
];

describe('FreeTextFeatureRoutingHygiene (Package C)', () => {
  it('rejects known free-text feature-activation markers on hot paths', () => {
    const failures: string[] = [];
    for (const rule of FORBIDDEN_HOTPATH_MARKERS) {
      for (const file of rule.files) {
        const full = path.join(root, file);
        if (!fs.existsSync(full)) {
          failures.push(`missing hot-path file: ${file}`);
          continue;
        }
        const src = readSrc(file);
        if (rule.re.test(src)) {
          failures.push(`${file}: forbidden ${rule.label}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('requires purity invariants on hot-path sources and matrix doc', () => {
    const failures: string[] = [];
    for (const entry of REQUIRED_INVARIANTS) {
      const full = path.join(root, entry.file);
      if (!fs.existsSync(full)) {
        failures.push(`missing ${entry.file}`);
        continue;
      }
      const src = readSrc(entry.file);
      for (const m of entry.markers) {
        if (!m.re.test(src)) {
          failures.push(`${entry.file}: missing ${m.label}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('keeps critical free-text/approval product strings English-default', () => {
    const failures: string[] = [];
    for (const entry of EN_CRITICAL_FILES) {
      const full = path.join(root, entry.file);
      if (!fs.existsSync(full)) {
        failures.push(`missing ${entry.file}`);
        continue;
      }
      let src = readSrc(entry.file);
      // Strip allowlisted bilingual slash aliases so residual check is on product copy
      for (const allow of entry.allowlist || []) {
        src = src.replace(allow, ' ');
      }
      if (entry.forbidden.test(src)) {
        const match = src.match(entry.forbidden);
        failures.push(`${entry.file}: non-EN product residual near "${match?.[0] || '?'}"`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('matrix documents purity:check entrypoints', () => {
    const matrix = readSrc('docs/product/free-text-purity-matrix.md');
    expect(matrix).toMatch(/purity:hygiene|FreeTextFeatureRoutingHygiene/);
    expect(matrix).toMatch(/FreeTextFeatureActivationResiduals/);
  });
});
