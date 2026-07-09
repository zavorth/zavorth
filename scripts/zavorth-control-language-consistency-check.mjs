#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const files = {
  preview: 'scripts/zavorthControl-browser-preview.ts',
  packageJson: 'package.json',
};

const canonicalDashboardFiles = [
  'apps/zavorth-control-vite-shell/src/dashboard-surface-registry.ts',
  'apps/zavorth-control-vite-shell/src/dashboard-live-view.ts',
  'apps/zavorth-control-vite-shell/src/learning-dreams-ui.ts',
  'apps/zavorth-control-vite-shell/src/pages.ts',
  'apps/zavorth-control-vite-shell/src/runtime-bridge.ts',
  'apps/zavorth-control-vite-shell/src/runtime-operations-panels.ts',
  'apps/zavorth-control-vite-shell/src/runtime-provider-panels.ts',
];

const portugueseUiPatterns = [
  /[ÁáÀàÂâÃãÉéÊêÍíÓóÔôÕõÚúÇç]/u,
  /\b(Abrir|Acoes|Aguardando|Aprovar|Aprovacao|Aprovacoes|Buscar|Canais|Configuracao|Configuracoes|Configurar|Conectar|Decisao|Decisoes|Esquecer|Execucao|Historico|Idioma|Memoria|Modelo|Modelos|Opcional|Perfil|Pronto|Revisar|Seguranca|Sessoes|Trabalho|Verificar)\b/i,
  /\b(acao|acoes|aprovacao|aprovacoes|conexao|decisao|decisoes|execucao|historico|memoria|seguranca|sessao|sessoes)\b/i,
  /\b(como|quando|somente|voce|voces|nenhuma|nenhum|pendente|pendentes|disponivel|disponiveis|confiaveis|sensivel|sensiveis|silencio|silenciosa|seguro|segura|configuravel)\b/i,
  /\b(Entrada|Rota|Nada|Peca|Sem|Proximo|ciclo|Limpar|eventos|pedem|tecnica|Pedir|Abre|conversa|principal|Motor|Segundo|plano|Ative|desative|ferramentas|instaladas|Sugerir|Prontas|Instaladas|mensagem|remota|Conecte|receber|duvida|Comecar|Primeiro|mandar|curtos|conectados|protegida|pronta|visiveis|Escopo|Desbloqueie|vivos|risco)\b/i,
  /\b(Ajusta|Ajude|Aprendizado|Busca|Busque|Cadastro|Candidato|Candidatos|Corrigir|Delegacao|Digite|Diga|Errada|Esqueca|Fatos|Informado|Inspetor|Melhorias|Mostre|Pedido|Permanecer|Projeto|Recentes|Recorde|Regra|Remover|Sugere|Transforma|Virar|acao|antes|apenas|aprendizado|atual|avancado|cadastro|candidato|candidatos|caminho|checagem|coisa|corrigir|delegacao|documentos|errada|esquecer|externo|fatos|incorreta|informado|melhorias|mudar|opcoes|pedido|permanecer|problemas|projeto|recente|recentes|recibo|regra|remover|resposta|sugere|transforma|virar)\b/i,
];

function assertCanonicalDashboardEnglish() {
  const offenders = [];
  for (const relativePath of canonicalDashboardFiles) {
    const content = read(relativePath);
    content.split(/\r?\n/).forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (portugueseUiPatterns.some((pattern) => pattern.test(line))) {
        offenders.push(`${relativePath}:${index + 1}: ${trimmed.slice(0, 160)}`);
      }
    });
  }
  if (offenders.length) {
    throw new Error([
      'Canonical Zavorth Control UI source must stay English-only.',
      'Put localized Portuguese copy in apps/zavorth-control-vite-shell/src/locale.ts instead.',
      ...offenders.slice(0, 80),
      offenders.length > 80 ? `...and ${offenders.length - 80} more` : '',
    ].filter(Boolean).join('\n'));
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function assertContains(label, content, needle) {
  if (!content.includes(needle)) {
    throw new Error(`${label} missing required marker: ${needle}`);
  }
}

function assertOrder(label, content, before, after) {
  const beforeIndex = content.indexOf(before);
  const afterIndex = content.indexOf(after);
  if (beforeIndex === -1 || afterIndex === -1 || beforeIndex > afterIndex) {
    throw new Error(`${label} order mismatch: expected ${before} before ${after}`);
  }
}

function main() {
  const preview = read(files.preview);
  const packageJson = JSON.parse(read(files.packageJson));
  const scripts = packageJson.scripts || {};
  const workspaceCheck = String(scripts['workspace:check'] || '');

  assertContains(files.preview, preview, 'const normalizeZavorthControlCopy = (value) => {');
  assertContains(files.preview, preview, 'const normalizeVisibleZavorthControlCopy = (root) => {');
  assertContains(files.preview, preview, 'document.createTreeWalker(root, NodeFilter.SHOW_TEXT)');
  assertContains(files.preview, preview, 'input[placeholder], textarea[placeholder], [aria-label], [title]');
  assertContains(files.preview, preview, 'normalizeVisibleZavorthControlCopy(document.getElementById("zavorthControl-preview-root"))');
  assertOrder(
    files.preview,
    preview,
    'injectPreviewOnboardingAndApprovals(vm);',
    'normalizeVisibleZavorthControlCopy(document.getElementById("zavorthControl-preview-root"))',
  );

  const requiredPairs = [
    ['Peca ao Zavorth', 'Ask Zavorth'],
    ['Enviar', 'Send'],
    ['Missao atual', 'Current mission'],
    ['Linha do tempo', 'Timeline'],
    ['Ferramentas', 'Tools'],
    ['Permitir', 'Allow'],
    ['Negar', 'Deny'],
    ['Sem approvals aguardando voce agora.', 'No approvals waiting for you right now.'],
    ['Matriz live:', 'Live matrix:'],
    ['Render seguro: sem chamadas de rede no zavorthControl.', 'Safe render: no zavorthControl network calls.'],
    ['Ainda nao ha artifacts nesta sessao.', 'There are no artifacts in this session yet.'],
  ];

  for (const [from, to] of requiredPairs) {
    assertContains(files.preview, preview, `["${from}", "${to}"]`);
  }

  assertContains(files.packageJson, JSON.stringify(scripts), 'zavorth:zavorthControl-language-consistency:check');
  assertContains(files.packageJson, JSON.stringify(scripts), 'qa:zavorth-control-language-consistency');
  assertContains('workspace:check', workspaceCheck, 'zavorth:zavorthControl-language-consistency:check');
  assertOrder(
    'workspace:check',
    workspaceCheck,
    'zavorth:zavorthControl-responsive-visual-qa:check',
    'zavorth:zavorthControl-language-consistency:check',
  );
  assertCanonicalDashboardEnglish();

  console.log('[zavorthControl-language-consistency] ok ZavorthControl visible copy normalization is wired');
}

main();
