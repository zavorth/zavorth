type CountLabel = {
  singular: string;
  plural: string;
};

const COUNT_PATTERNS: Array<[RegExp, CountLabel]> = [
  [/(\d+)\s+item\(s\)/gi, { singular: 'item', plural: 'items' }],
  [/(\d+)\s+node\(s\)/gi, { singular: 'node', plural: 'nodes' }],
  [/(\d+)\s+plugin\(s\)/gi, { singular: 'plugin', plural: 'plugins' }],
  [/(\d+)\s+skill\(s\)/gi, { singular: 'skill', plural: 'skills' }],
  [/(\d+)\s+MCP\(s\)/g, { singular: 'MCP', plural: 'MCPs' }],
  [/(\d+)\s+recipe\(s\)/gi, { singular: 'recipe', plural: 'recipes' }],
  [/(\d+)\s+collection\(s\)/gi, { singular: 'collection', plural: 'collections' }],
  [/(\d+)\s+domain\(s\)/gi, { singular: 'domain', plural: 'domains' }],
  [/(\d+)\s+channel\(s\)/gi, { singular: 'channel', plural: 'channels' }],
  [/(\d+)\s+modo\(s\)/gi, { singular: 'mode', plural: 'modes' }],
  [/(\d+)\s+artifact\(s\)/gi, { singular: 'artifact', plural: 'artifacts' }],
  [/(\d+)\s+target\(s\)/gi, { singular: 'target', plural: 'targets' }],
  [/(\d+)\s+transport\(s\)/gi, { singular: 'transport', plural: 'transports' }],
  [/(\d+)\s+famil(?:y|ies)/gi, { singular: 'family', plural: 'families' }],
  [/(\d+)\s+team\(s\)/gi, { singular: 'team', plural: 'teams' }],
  [/(\d+)\s+workspace\(s\)/gi, { singular: 'workspace', plural: 'workspaces' }],
  [/(\d+)\s+command\(s\)/gi, { singular: 'command', plural: 'commands' }],
  [/(\d+)\s+task\(s\)/gi, { singular: 'task', plural: 'tasks' }],
  [/(\d+)\s+hook\(s\)/gi, { singular: 'hook', plural: 'hooks' }],
  [/(\d+)\s+host\(s\)/gi, { singular: 'host', plural: 'hosts' }],
  [/(\d+)\s+pairing\(s\)/gi, { singular: 'pairing', plural: 'pairings' }],
  [/(\d+)\s+procedure\(s\)/gi, { singular: 'procedure', plural: 'procedures' }],
  [/(\d+)\s+candidate\(s\)/gi, { singular: 'candidate', plural: 'candidates' }],
  [/(\d+)\s+entr(?:y|ies)/gi, { singular: 'entry', plural: 'entries' }],
  [/(\d+)\s+step\(s\)/gi, { singular: 'step', plural: 'steps' }],
  [/(\d+)\s+discover(?:y|ies)/gi, { singular: 'discovery', plural: 'discoveries' }],
  [/(\d+)\s+release\(s\)/gi, { singular: 'release', plural: 'releases' }],
  [/(\d+)\s+permission\(s\)/gi, { singular: 'permission', plural: 'permissions' }],
  [/(\d+)\s+approval\(s\)/gi, { singular: 'approval', plural: 'approvals' }],
  [/(\d+)\s+confirmation\(s\)/gi, { singular: 'confirmation', plural: 'confirmations' }],
  [/(\d+)\s+recover(?:y|ies)/gi, { singular: 'recovery', plural: 'recoveries' }],
  [/(\d+)\s+invocation\(s\)/gi, { singular: 'invocation', plural: 'invocations' }],
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
