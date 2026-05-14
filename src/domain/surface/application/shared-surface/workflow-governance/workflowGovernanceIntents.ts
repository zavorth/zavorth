import { extractWorkflowSearchKeywords, normalizeNaturalText } from './workflowGovernanceText.js';

export type NaturalWorkflowIntent = {
  args: string;
  intro: string;
  resolveRecent?: { keywords: string[] };
};

export type NaturalPermissionIntent = {
  command: 'list' | 'show' | 'approve' | 'reject';
  args: string;
  intro: string;
};

export type ExplicitSelfModificationIntent = {
  args: string;
  intro: string;
};

export function parseNaturalPermissionIntent(rawText: string): NaturalPermissionIntent | null {
  const normalized = normalizeNaturalText(rawText);
  if (!normalized || normalized.startsWith('/')) {
    return null;
  }

  const mentionsPermissionPlane =
    /\b(permissao|permissoes|permission|permissions|approval|approvals)\b/.test(normalized);
  if (!mentionsPermissionPlane || /\bcodex\b/.test(normalized)) {
    return null;
  }

  const permissionRef = extractNaturalPermissionRef(normalized);

  if (permissionRef && /\b(aprovar|aprova|aprove|approve|autorizar|autorize|liberar|libere)\b/.test(normalized)) {
    return {
      command: 'approve',
      args: permissionRef,
      intro: `Entendi que voce quer aprovar a permissao ${permissionRef}.`,
    };
  }

  if (permissionRef && /\b(rejeitar|rejeite|reject|negar|negue|bloquear|bloqueie)\b/.test(normalized)) {
    return {
      command: 'reject',
      args: permissionRef,
      intro: `Entendi que voce quer rejeitar a permissao ${permissionRef}.`,
    };
  }

  if (permissionRef && /\b(show|mostrar|mostre|ver|detalhes|inspecionar|inspecao)\b/.test(normalized)) {
    return {
      command: 'show',
      args: permissionRef,
      intro: `Entendi que voce quer inspecionar a permissao ${permissionRef}.`,
    };
  }

  if (/\b(pendentes|pendente)\b/.test(normalized)) {
    return {
      command: 'list',
      args: 'pending',
      intro: 'Entendi que voce quer ver as permissoes pendentes do Zavorth.',
    };
  }

  if (/\b(aprovadas|aprovada|approved)\b/.test(normalized)) {
    return {
      command: 'list',
      args: 'approved',
      intro: 'Entendi que voce quer ver as permissoes aprovadas do Zavorth.',
    };
  }

  if (/\b(rejeitadas|rejeitada|rejected)\b/.test(normalized)) {
    return {
      command: 'list',
      args: 'rejected',
      intro: 'Entendi que voce quer ver as permissoes rejeitadas do Zavorth.',
    };
  }

  if (/\b(listar|lista|mostrar|mostre|ver|overview|painel|status)\b/.test(normalized)) {
    return {
      command: 'list',
      args: 'pending',
      intro: 'Entendi que voce quer abrir o painel de permissoes do Zavorth.',
    };
  }

  return null;
}

export function parseExplicitSelfModificationIntent(rawText: string): ExplicitSelfModificationIntent | null {
  const original = String(rawText || '').trim();
  const normalized = normalizeNaturalText(rawText);
  if (!normalized || normalized.startsWith('/')) {
    return null;
  }

  const prefixes = ['selfmod ', 'auto-modificacao ', 'auto modificacao '];
  const matchedPrefix = prefixes.find((prefix) => normalized.startsWith(prefix));
  if (!matchedPrefix) {
    return null;
  }

  const args = original.slice(matchedPrefix.length).trim();
  if (!args) {
    return null;
  }

  return {
    args,
    intro: 'Entendi que voce quer abrir o fluxo guardado de auto-modificacao do Zavorth.',
  };
}

export function parseNaturalWorkflowIntent(rawText: string): NaturalWorkflowIntent | null {
  const original = String(rawText || '').trim();
  const normalized = normalizeNaturalText(rawText);
  if (!normalized || normalized.startsWith('/')) {
    return null;
  }

  const workflowRunId = extractNaturalWorkflowRunId(normalized);
  if (workflowRunId && /\b(retomar|retome|resume|continuar|continue)\b/.test(normalized)) {
    return {
      args: `resume ${workflowRunId}`,
      intro: `Entendi que voce quer retomar o workflow ${workflowRunId}.`,
    };
  }

  if (workflowRunId && /\b(fechar|feche|encerrar|encerre|close)\b/.test(normalized)) {
    return {
      args: `close ${workflowRunId}`,
      intro: `Entendi que voce quer fechar o workflow ${workflowRunId}.`,
    };
  }

  const recentResumeIntent = extractRecentWorkflowResumeIntent(original, normalized);
  if (recentResumeIntent) {
    return recentResumeIntent;
  }

  const explicitWorkflow = extractNaturalWorkflowLaunch(original);
  if (explicitWorkflow) {
    return explicitWorkflow;
  }

  return null;
}

function extractNaturalPermissionRef(normalized: string): string | null {
  const uuidMatch = normalized.match(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i);
  if (uuidMatch?.[1]) {
    return uuidMatch[1];
  }

  const explicitMatch = normalized.match(/\b(?:permissao|permission)\s+([a-z0-9][a-z0-9._-]{3,})\b/i);
  if (explicitMatch?.[1]) {
    return explicitMatch[1];
  }

  const permLikeMatch = normalized.match(/\b(perm-[a-z0-9._-]+)\b/i);
  if (permLikeMatch?.[1]) {
    return permLikeMatch[1];
  }

  return null;
}

function extractNaturalWorkflowRunId(normalized: string): string | null {
  const match = normalized.match(/\b(wf-[a-z0-9._-]+)\b/i);
  return match?.[1] || null;
}

function extractNaturalWorkflowLaunch(rawText: string): NaturalWorkflowIntent | null {
  const normalized = normalizeNaturalText(rawText);
  if (!/\bworkflow\b/.test(normalized)) {
    return null;
  }

  const match = rawText.match(/\bworkflow\s+(review|ship|research|sdd)\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const workflowId = String(match[1] || '').trim().toLowerCase();
  const objective = String(match[2] || '')
    .replace(/^(sobre|para)\s+/i, '')
    .trim();
  if (!workflowId || !objective) {
    return null;
  }

  const intros: Record<string, string> = {
    review: `Entendi que voce quer abrir um workflow review para ${objective}.`,
    ship: `Entendi que voce quer abrir um workflow ship para ${objective}.`,
    research: `Entendi que voce quer abrir um workflow research para ${objective}.`,
    sdd: `Entendi que voce quer abrir um workflow sdd para ${objective}.`,
  };

  return {
    args: `${workflowId} ${objective}`,
    intro: intros[workflowId] || `Entendi que voce quer abrir um workflow ${workflowId}.`,
  };
}

function extractRecentWorkflowResumeIntent(
  rawText: string,
  normalized: string,
): NaturalWorkflowIntent | null {
  const wantsResume = /\b(retomar|retome|resume|continuar|continue)\b/.test(normalized);
  if (!wantsResume || !/\bworkflow\b/.test(normalized)) {
    return null;
  }

  const latestOnly = /\b(ultimo|ultima|anterior|mais recente|recente)\b/.test(normalized);
  const descriptiveMatch = rawText.match(/\bworkflow(?:\s+(?:de|do|da|para|sobre))\s+(.+)$/i);
  const keywords = descriptiveMatch?.[1]
    ? extractWorkflowSearchKeywords(descriptiveMatch[1])
    : [];

  if (!latestOnly && keywords.length === 0) {
    return null;
  }

  const targetLabel = keywords.length > 0 ? `mais relacionado a ${keywords.join(' ')}` : 'mais recente';
  return {
    args: '',
    intro: `Entendi que voce quer retomar o workflow ${targetLabel}.`,
    resolveRecent: {
      keywords,
    },
  };
}
