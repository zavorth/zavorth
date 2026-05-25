type CountLabel = {
  singular: string;
  plural: string;
};

const COUNT_PATTERNS: Array<[RegExp, CountLabel]> = [
  [/(\d+)\s+item\(ns\)/gi, { singular: 'item', plural: 'itens' }],
  [/(\d+)\s+node\(s\)/gi, { singular: 'node', plural: 'nodes' }],
  [/(\d+)\s+plugin\(s\)/gi, { singular: 'plugin', plural: 'plugins' }],
  [/(\d+)\s+skill\(s\)/gi, { singular: 'skill', plural: 'skills' }],
  [/(\d+)\s+MCP\(s\)/g, { singular: 'MCP', plural: 'MCPs' }],
  [/(\d+)\s+recipe\(s\)/gi, { singular: 'recipe', plural: 'recipes' }],
  [/(\d+)\s+colecao\(oes\)/gi, { singular: 'colecao', plural: 'colecoes' }],
  [/(\d+)\s+dominio\(s\)/gi, { singular: 'dominio', plural: 'dominios' }],
  [/(\d+)\s+canal\(is\)/gi, { singular: 'canal', plural: 'canais' }],
  [/(\d+)\s+modo\(s\)/gi, { singular: 'modo', plural: 'modos' }],
  [/(\d+)\s+artefato\(s\)/gi, { singular: 'artefato', plural: 'artefatos' }],
  [/(\d+)\s+alvo\(s\)/gi, { singular: 'alvo', plural: 'alvos' }],
  [/(\d+)\s+transporte\(s\)/gi, { singular: 'transporte', plural: 'transportes' }],
  [/(\d+)\s+familia\(s\)/gi, { singular: 'familia', plural: 'familias' }],
  [/(\d+)\s+team\(s\)/gi, { singular: 'team', plural: 'teams' }],
  [/(\d+)\s+workspace\(s\)/gi, { singular: 'workspace', plural: 'workspaces' }],
  [/(\d+)\s+comando\(s\)/gi, { singular: 'comando', plural: 'comandos' }],
  [/(\d+)\s+task\(s\)/gi, { singular: 'task', plural: 'tasks' }],
  [/(\d+)\s+hook\(s\)/gi, { singular: 'hook', plural: 'hooks' }],
  [/(\d+)\s+host\(s\)/gi, { singular: 'host', plural: 'hosts' }],
  [/(\d+)\s+pairing\(s\)/gi, { singular: 'pairing', plural: 'pairings' }],
  [/(\d+)\s+procedimento\(s\)/gi, { singular: 'procedimento', plural: 'procedimentos' }],
  [/(\d+)\s+candidato\(s\)/gi, { singular: 'candidato', plural: 'candidatos' }],
  [/(\d+)\s+entrada\(s\)/gi, { singular: 'entrada', plural: 'entradas' }],
  [/(\d+)\s+etapa\(s\)/gi, { singular: 'etapa', plural: 'etapas' }],
  [/(\d+)\s+descoberta\(s\)/gi, { singular: 'descoberta', plural: 'descobertas' }],
  [/(\d+)\s+liberacao\(oes\)/gi, { singular: 'liberacao', plural: 'liberacoes' }],
  [/(\d+)\s+permissao\(oes\)/gi, { singular: 'permissao', plural: 'permissoes' }],
  [/(\d+)\s+aprovacao\(oes\)/gi, { singular: 'aprovacao', plural: 'aprovacoes' }],
  [/(\d+)\s+confirmacao\(oes\)/gi, { singular: 'confirmacao', plural: 'confirmacoes' }],
  [/(\d+)\s+recuperacao\(oes\)/gi, { singular: 'recuperacao', plural: 'recuperacoes' }],
  [/(\d+)\s+invocacao\(oes\)/gi, { singular: 'invocacao', plural: 'invocacoes' }],
  [/(\d+)\s+episodico\(s\)/gi, { singular: 'episodico', plural: 'episodicos' }],
  [/(\d+)\s+semantico\(s\)/gi, { singular: 'semantico', plural: 'semanticos' }],
  [/(\d+)\s+aprovado\(s\)/gi, { singular: 'aprovado', plural: 'aprovados' }],
  [/(\d+)\s+rejeitado\(s\)/gi, { singular: 'rejeitado', plural: 'rejeitados' }],
  [/(\d+)\s+promovido\(s\)/gi, { singular: 'promovido', plural: 'promovidos' }],
  [/(\d+)\s+publicado\(s\)/gi, { singular: 'publicado', plural: 'publicados' }],
  [/(\d+)\s+pendente\(s\)/gi, { singular: 'pendente', plural: 'pendentes' }],
  [/(\d+)\s+pronto\(s\)/gi, { singular: 'pronto', plural: 'prontos' }],
  [/(\d+)\s+parcial\(is\)/gi, { singular: 'parcial', plural: 'parciais' }],
  [/(\d+)\s+planejado\(s\)/gi, { singular: 'planejado', plural: 'planejados' }],
  [/(\d+)\s+planejada\(s\)/gi, { singular: 'planejada', plural: 'planejadas' }],
  [/(\d+)\s+configurado\(s\)/gi, { singular: 'configurado', plural: 'configurados' }],
  [/(\d+)\s+desabilitado\(s\)/gi, { singular: 'desabilitado', plural: 'desabilitados' }],
  [/(\d+)\s+pareado\(s\)/gi, { singular: 'pareado', plural: 'pareados' }],
  [/(\d+)\s+adotado\(s\)/gi, { singular: 'adotado', plural: 'adotados' }],
  [/(\d+)\s+registrado\(s\)/gi, { singular: 'registrado', plural: 'registrados' }],
  [/(\d+)\s+validado\(s\)/gi, { singular: 'validado', plural: 'validados' }],
  [/(\d+)\s+resolvido\(s\)/gi, { singular: 'resolvido', plural: 'resolvidos' }],
  [/(\d+)\s+concluida\(s\)/gi, { singular: 'concluida', plural: 'concluidas' }],
  [/(\d+)\s+expirado\(s\)/gi, { singular: 'expirado', plural: 'expirados' }],
  [/(\d+)\s+antigo\(s\)/gi, { singular: 'antigo', plural: 'antigos' }],
  [/(\d+)\s+antiga\(s\)/gi, { singular: 'antiga', plural: 'antigas' }],
  [/(\d+)\s+pura\(s\)/gi, { singular: 'pura', plural: 'puras' }],
  [/(\d+)\s+visivel\(is\)/gi, { singular: 'visivel', plural: 'visiveis' }],
  [/(\d+)\s+invocavel\(is\)/gi, { singular: 'invocavel', plural: 'invocaveis' }],
];

function normalizeCount(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number'
    ? value
    : Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickLabel(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || `${singular}s`);
}

function formatCount(
  value: number | string | null | undefined,
  singular: string,
  plural?: string,
): string {
  const count = normalizeCount(value);
  return `${count} ${pickLabel(count, singular, plural)}`;
}

function formatAdditionalCount(
  value: number | string | null | undefined,
  singular: string,
  plural?: string,
): string {
  const count = normalizeCount(value);
  return `+${formatCount(count, singular, plural)}`;
}

function sanitizeHumanCliText(value: string | null | undefined): string {
  let output = String(value || '');

  for (const [pattern, labels] of COUNT_PATTERNS) {
    output = output.replace(pattern, (_match, rawCount: string) =>
      formatCount(rawCount, labels.singular, labels.plural));
  }

  return output
    .replace(/\bruntime universal\b/gi, 'agent runtime')
    .replace(/\bruntime natural-first\b/gi, 'natural request flow')
    .replace(/\bruntime natural\b/gi, 'natural request flow')
    .replace(/\bprovider runtime\b/gi, 'model connection')
    .replace(/\bprovider LLM\b/gi, 'model provider')
    .replace(/\bLLM provider\b/gi, 'model provider')
    .replace(/\bcapabilities\b/gi, 'abilities')
    .replace(/\bcapability\b/gi, 'ability')
    .replace(/\baction cards\b/gi, 'pending actions')
    .replace(/\bAction cards\b/g, 'Pending actions')
    .replace(/\breceipts\b/gi, 'evidence')
    .replace(/\bReceipts\b/g, 'Evidence')
    .replace(/\bnpm run ops:maintain\b/gi, 'zavorth ops run recover-sidecars')
    .replace(/\bnpm run security:preflight\b/gi, 'zavorth ops run security-preflight')
    .replace(/\bnpm run remote:publish\b/gi, 'zavorth ops run remote-publish')
    .replace(/\bnpm run test:nodes:smoke\b/gi, 'zavorth ops run validate-node-mesh-smoke')
    .replace(/\bnpm run test:channels:smoke\b/gi, 'zavorth ops run validate-channel-providers')
    .replace(/\bnpm run test:transports:smoke\b/gi, 'zavorth ops run validate-remote-transports')
    .replace(/\bnpm run sandbox:wasm:smoke\b/gi, 'zavorth ops run validate-wasm-smoke')
    .replace(/\bnodes pareado\(s\)/gi, 'nodes pareados')
    .replace(/\bnode pareado\(s\)/gi, 'node pareado')
    .replace(/\bplugins instalado\(s\)/gi, 'plugins instalados')
    .replace(/\bplugin instalado\(s\)/gi, 'plugin instalado')
    .replace(/\bitens antigo\(s\)/gi, 'itens antigos')
    .replace(/\bitem antigo\(s\)/gi, 'item antigo')
    .replace(/\bpairings expirado\(s\)/gi, 'pairings expirados')
    .replace(/\bpairing expirado\(s\)/gi, 'pairing expirado')
    .replace(/\bdescobertas pura\(s\)/gi, 'descobertas puras')
    .replace(/\bdescoberta pura\(s\)/gi, 'descoberta pura')
    .replace(/\bcanais pronto\(s\)/gi, 'canais prontos')
    .replace(/\bcanal pronto\(s\)/gi, 'canal pronto')
    .replace(/\bmodos de runtime pronto\(s\)/gi, 'modos de runtime prontos')
    .replace(/\bmodo de runtime pronto\(s\)/gi, 'modo de runtime pronto')
    .replace(/\bartefatos recente\(s\)/gi, 'artefatos recentes')
    .replace(/\bartefato recente\(s\)/gi, 'artefato recente')
    .replace(/\btransportes remoto\(s\) pronto\(s\)/gi, 'transportes remotos prontos')
    .replace(/\btransporte remoto\(s\) pronto\(s\)/gi, 'transporte remoto pronto')
    .replace(/\bclaimed\b/gi, 'em processamento')
    .replace(/\bn\/d\b/gi, 'nao informado')
    .trim();
}

function formatCliValue(value: string | null | undefined, fallback = 'nao informado'): string {
  const sanitized = sanitizeHumanCliText(value);
  return sanitized || fallback;
}

export {
  formatAdditionalCount,
  formatCliValue,
  formatCount,
  sanitizeHumanCliText,
};
