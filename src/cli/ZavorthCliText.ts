type CountLabel = {
  singular: string;
  plural: string;
};

const COUNT_PATTERNS: Array<[RegExp, CountLabel]> = [
  [/(\d+)\s+item\(ns\)/gi, { singular: 'item', plural: 'items' }],
  [/(\d+)\s+node\(s\)/gi, { singular: 'node', plural: 'nodes' }],
  [/(\d+)\s+plugin\(s\)/gi, { singular: 'plugin', plural: 'plugins' }],
  [/(\d+)\s+skill\(s\)/gi, { singular: 'skill', plural: 'skills' }],
  [/(\d+)\s+MCP\(s\)/g, { singular: 'MCP', plural: 'MCPs' }],
  [/(\d+)\s+recipe\(s\)/gi, { singular: 'recipe', plural: 'recipes' }],
  [/(\d+)\s+colecao\(oes\)/gi, { singular: 'collection', plural: 'collections' }],
  [/(\d+)\s+dominio\(s\)/gi, { singular: 'domain', plural: 'domains' }],
  [/(\d+)\s+canal\(is\)/gi, { singular: 'channel', plural: 'channels' }],
  [/(\d+)\s+modo\(s\)/gi, { singular: 'mode', plural: 'modes' }],
  [/(\d+)\s+artefato\(s\)/gi, { singular: 'artifact', plural: 'artifacts' }],
  [/(\d+)\s+alvo\(s\)/gi, { singular: 'target', plural: 'targets' }],
  [/(\d+)\s+transporte\(s\)/gi, { singular: 'transport', plural: 'transports' }],
  [/(\d+)\s+familia\(s\)/gi, { singular: 'family', plural: 'families' }],
  [/(\d+)\s+team\(s\)/gi, { singular: 'team', plural: 'teams' }],
  [/(\d+)\s+workspace\(s\)/gi, { singular: 'workspace', plural: 'workspaces' }],
  [/(\d+)\s+comando\(s\)/gi, { singular: 'command', plural: 'commands' }],
  [/(\d+)\s+task\(s\)/gi, { singular: 'task', plural: 'tasks' }],
  [/(\d+)\s+hook\(s\)/gi, { singular: 'hook', plural: 'hooks' }],
  [/(\d+)\s+host\(s\)/gi, { singular: 'host', plural: 'hosts' }],
  [/(\d+)\s+pairing\(s\)/gi, { singular: 'pairing', plural: 'pairings' }],
  [/(\d+)\s+procedimento\(s\)/gi, { singular: 'procedure', plural: 'procedures' }],
  [/(\d+)\s+candidato\(s\)/gi, { singular: 'candidate', plural: 'candidates' }],
  [/(\d+)\s+entrada\(s\)/gi, { singular: 'entry', plural: 'entries' }],
  [/(\d+)\s+etapa\(s\)/gi, { singular: 'step', plural: 'steps' }],
  [/(\d+)\s+descoberta\(s\)/gi, { singular: 'discovery', plural: 'discoveries' }],
  [/(\d+)\s+liberacao\(oes\)/gi, { singular: 'release', plural: 'releases' }],
  [/(\d+)\s+permissao\(oes\)/gi, { singular: 'permission', plural: 'permissions' }],
  [/(\d+)\s+aprovacao\(oes\)/gi, { singular: 'approval', plural: 'approvals' }],
  [/(\d+)\s+confirmacao\(oes\)/gi, { singular: 'confirmation', plural: 'confirmations' }],
  [/(\d+)\s+recuperacao\(oes\)/gi, { singular: 'recovery', plural: 'recoveries' }],
  [/(\d+)\s+invocacao\(oes\)/gi, { singular: 'invocation', plural: 'invocations' }],
  [/(\d+)\s+episodico\(s\)/gi, { singular: 'episodic', plural: 'episodic' }],
  [/(\d+)\s+semantico\(s\)/gi, { singular: 'semantic', plural: 'semantic' }],
  [/(\d+)\s+aprovado\(s\)/gi, { singular: 'approved', plural: 'approved' }],
  [/(\d+)\s+rejeitado\(s\)/gi, { singular: 'rejected', plural: 'rejected' }],
  [/(\d+)\s+promovido\(s\)/gi, { singular: 'promoted', plural: 'promoted' }],
  [/(\d+)\s+published\(s\)/gi, { singular: 'published', plural: 'published' }],
  [/(\d+)\s+pending\(s\)/gi, { singular: 'pending', plural: 'pending' }],
  [/(\d+)\s+ready\(s\)/gi, { singular: 'ready', plural: 'ready' }],
  [/(\d+)\s+partial\(is\)/gi, { singular: 'partial', plural: 'partial' }],
  [/(\d+)\s+planejado\(s\)/gi, { singular: 'planned', plural: 'planned' }],
  [/(\d+)\s+planejada\(s\)/gi, { singular: 'planned', plural: 'planned' }],
  [/(\d+)\s+configured\(s\)/gi, { singular: 'configured', plural: 'configured' }],
  [/(\d+)\s+desabilitado\(s\)/gi, { singular: 'disabled', plural: 'disabled' }],
  [/(\d+)\s+pareado\(s\)/gi, { singular: 'paired', plural: 'paired' }],
  [/(\d+)\s+adotado\(s\)/gi, { singular: 'adopted', plural: 'adopted' }],
  [/(\d+)\s+registrado\(s\)/gi, { singular: 'registered', plural: 'registered' }],
  [/(\d+)\s+validado\(s\)/gi, { singular: 'validated', plural: 'validated' }],
  [/(\d+)\s+resolvido\(s\)/gi, { singular: 'resolved', plural: 'resolved' }],
  [/(\d+)\s+concluida\(s\)/gi, { singular: 'completed', plural: 'completed' }],
  [/(\d+)\s+expirado\(s\)/gi, { singular: 'expired', plural: 'expired' }],
  [/(\d+)\s+antigo\(s\)/gi, { singular: 'old', plural: 'old' }],
  [/(\d+)\s+antiga\(s\)/gi, { singular: 'old', plural: 'old' }],
  [/(\d+)\s+pura\(s\)/gi, { singular: 'pure', plural: 'pure' }],
  [/(\d+)\s+visivel\(is\)/gi, { singular: 'visible', plural: 'visible' }],
  [/(\d+)\s+invocavel\(is\)/gi, { singular: 'invocable', plural: 'invocable' }],
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
    .replace(/\bnodes pareado\(s\)/gi, 'paired nodes')
    .replace(/\bpaired node\(s\)/gi, 'paired node')
    .replace(/\bplugins instalado\(s\)/gi, 'installed plugins')
    .replace(/\binstalled plugin\(s\)/gi, 'installed plugin')
    .replace(/\bitens antigo\(s\)/gi, 'old items')
    .replace(/\bold item\(s\)/gi, 'old item')
    .replace(/\bpairings expirado\(s\)/gi, 'expired pairings')
    .replace(/\bexpired pairing\(s\)/gi, 'expired pairing')
    .replace(/\bdescobertas pura\(s\)/gi, 'pure discoveries')
    .replace(/\bpure discovery\(s\)/gi, 'pure discovery')
    .replace(/\bcanais ready\(s\)/gi, 'channels ready')
    .replace(/\bchannel ready\(s\)/gi, 'channel ready')
    .replace(/\bmodos de runtime ready\(s\)/gi, 'runtime modes ready')
    .replace(/\bruntime mode ready\(s\)/gi, 'runtime mode ready')
    .replace(/\bartefatos recente\(s\)/gi, 'recent artifacts')
    .replace(/\brecent artifact\(s\)/gi, 'recent artifact')
    .replace(/\btransportes remoto\(s\) ready\(s\)/gi, 'remote transports ready')
    .replace(/\btransport remoto\(s\) ready\(s\)/gi, 'remote transport ready')
    .replace(/\bclaimed\b/gi, 'processing')
    .replace(/\bn\/d\b/gi, 'not provided')
    .trim();
}

function formatCliValue(value: string | null | undefined, fallback = 'not provided'): string {
  const sanitized = sanitizeHumanCliText(value);
  return sanitized || fallback;
}

export {
  formatAdditionalCount,
  formatCliValue,
  formatCount,
  sanitizeHumanCliText,
};
