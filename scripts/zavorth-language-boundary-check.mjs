#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const focusedFiles = [
  'src/cli/ZavorthCliLiveNamespaces.ts',
  'src/skills/SkillLoader.ts',
  'src/skills/LicensePolicyService.ts',
  'src/skills/SkillContentScannerService.ts',
  'src/skills/SkillImportPreviewService.ts',
  'src/skills/SkillImportService.ts',
  'src/skills/SkillRiskScoringService.ts',
  'src/skills/UniversalSkillBridgeRuntimeService.ts',
  'src/skills/UniversalSkillIntakeService.ts',
  'src/skills/UniversalSkillTrustImportService.ts',
  'src/services/SkillTrustPolicyService.ts',
  'src/services/SkillQuarantinePipelineService.ts',
  'src/services/UniversalSkillBridgeActivationService.ts',
  'src/services/UniversalSkillBridgeRegistryService.ts',
  'src/services/UniversalSkillExpansionQaService.ts',
  'src/services/UniversalSkillExpansionService.ts',
  'src/services/ZavorthSkillLifecycleService.ts',
  'src/tools/AutoSkillCreatorTool.ts',
  'docs/product/skills/create.md',
  'docs/product/skills/install.md',
  'docs/product/skills/index.md',
].filter((relativePath) => fs.existsSync(path.join(root, relativePath)));

const fallbackRoots = ['src', 'docs', 'tests', 'scripts']
  .filter((relativePath) => fs.existsSync(path.join(root, relativePath)));

const scannedFiles = focusedFiles.length > 0
  ? focusedFiles.map((relativePath) => path.join(root, relativePath))
  : fallbackRoots.flatMap((relativePath) => walk(path.join(root, relativePath)));

const portuguesePatterns = [
  /\b(Aprovacao|Aprovacoes|Aprovar|Bloqueado|Erro|Usuario|portugues|memoria|seguranca|execucao|acao|acoes|nao|sao|voce|preferencias|linguagens|Seja|detalhado|conciso|variavel|obrigatorio|conteudo|descricao|governado|aprovacao|licenca|fonte|fontes|candidato|candidatos|relatorio|matriz|proximas|pronta|prontas|bloqueada|bloqueadas|visiveis|catalogo|inspecao|revisao|confiavel|importacao)\b/iu,
  /\b(aprovacao|aprovar|bloqueado|erro|usuario|portugues|memoria|seguranca|execucao|acao|acoes|nao|sao|voce|preferencias|linguagens|variavel|obrigatorio|conteudo|descricao|governado|licenca|fonte|fontes|candidato|candidatos|relatorio|matriz|proximas|pronta|prontas|bloqueada|bloqueadas|visiveis|catalogo|inspecao|revisao|confiavel|importacao)\b/iu,
  /\b(não|são|ação|ações|aprovação|descrição|conteúdo|segurança|execução|usuário|você|memória|obrigatório|variável)\b/iu,
];

const obsoleteDocClaims = [
  {
    label: 'obsolete immediate-install claim',
    pattern: /If Zavorth can read it, it can run it|installed immediately|picks it up immediately/iu,
  },
];

const offenders = [];

for (const file of scannedFiles) {
  const relativePath = normalize(path.relative(root, file));
  if (isAllowedPath(relativePath)) continue;
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('@zavorth-allow-portuguese-fixture')) continue;

  const lines = content.split(/\r?\n/u);
  lines.forEach((line, index) => {
    if (isAllowedLine(line)) return;
    if (portuguesePatterns.some((pattern) => pattern.test(line))) {
      offenders.push(`${relativePath}:${index + 1}: Portuguese runtime copy: ${line.trim().slice(0, 180)}`);
    }
    for (const claim of obsoleteDocClaims) {
      if (claim.pattern.test(line)) {
        offenders.push(`${relativePath}:${index + 1}: ${claim.label}: ${line.trim().slice(0, 180)}`);
      }
    }
  });
}

if (offenders.length > 0) {
  console.error([
    '[zavorth-language-boundary] failed',
    'Move user-facing copy into i18n catalogs or mark deliberate multilingual fixtures with @zavorth-allow-portuguese-fixture.',
    ...offenders.slice(0, 120),
    offenders.length > 120 ? `...and ${offenders.length - 120} more` : '',
  ].filter(Boolean).join('\n'));
  process.exit(1);
}

console.log(`[zavorth-language-boundary] ok scanned=${scannedFiles.length}`);

function walk(dir) {
  const out = [];
  for (const entry of safeReadDir(dir)) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'dist-ops', 'dist-standalone', '.git', '.zavorth', 'tmp', 'tmp-jest-artifacts'].includes(entry.name)) continue;
      out.push(...walk(absolutePath));
    } else if (entry.isFile() && /\.(ts|tsx|js|mjs|json|md)$/u.test(entry.name)) {
      out.push(absolutePath);
    }
  }
  return out;
}

function safeReadDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function isAllowedPath(relativePath) {
  const normalized = normalize(relativePath);
  return normalized.startsWith('src/ai-gateway/i18n/messages/')
    || normalized.startsWith('i18n/')
    || normalized.includes('/fixtures/multilingual/')
    || normalized.endsWith('/pt.json')
    || normalized.endsWith('/pt-BR.json');
}

function isAllowedLine(line) {
  return line.includes('@zavorth-allow-portuguese-fixture')
    || line.includes('/docs/product/')
    || /\b(?:pt|pt-BR|Portuguese|portuguese)\b/u.test(line)
    || /\b(?:sim|nao|não|ola|olá|bom dia|boa tarde|boa noite)\b/u.test(line) && /language|locale|classifier|intent|pattern|regex/i.test(line);
}

function normalize(value) {
  return value.replace(/\\/g, '/');
}
