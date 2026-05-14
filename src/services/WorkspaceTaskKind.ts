export type WorkspaceTaskKind = 'code' | 'research' | 'design' | 'automation' | 'unknown';
export type WorkspaceTaskSubtype =
  | 'implementation'
  | 'debugging'
  | 'review'
  | 'testing'
  | 'web_research'
  | 'comparison'
  | 'summarization'
  | 'ui_design'
  | 'figma_design'
  | 'navigation'
  | 'form_fill'
  | 'app_control'
  | 'general'
  | 'unknown';

export type WorkspaceTaskProfile = {
  kind: WorkspaceTaskKind;
  subtype: WorkspaceTaskSubtype;
};

export type WorkspaceResponseStyle =
  | 'direct'
  | 'summary_first'
  | 'findings_first'
  | 'decision_brief'
  | 'checkpointed'
  | 'diagnostic'
  | 'implementation_ready';

type WorkspaceTaskKindSignal = {
  commandType?: unknown;
  text?: unknown;
  intent?: unknown;
  executor?: unknown;
};

const CODE_HINTS = ['corrig', 'ajust', 'refator', 'implem', 'bug', 'teste', 'test', 'review', 'revis', 'codigo', 'repo', 'projeto'];
const RESEARCH_HINTS = ['pesquis', 'compare', 'levant', 'resuma', 'noticia', 'web', 'artigo', 'fonte', 'investig'];
const DESIGN_HINTS = ['layout', 'design', 'ui', 'ux', 'tela', 'interface visual', 'figma', 'stitch', 'wireframe'];
const AUTOMATION_HINTS = ['abra', 'navegue', 'clique', 'preencha', 'app', 'janela', 'interface', 'zavorthBridge', 'automat'];

const CODE_SUBTYPES: Array<{ subtype: WorkspaceTaskSubtype; hints: string[] }> = [
  { subtype: 'testing', hints: ['teste', 'test', 'tests', 'spec', 'jest', 'pytest', 'coverage'] },
  { subtype: 'review', hints: ['review', 'revis', 'auditoria', 'inspec', 'code review'] },
  { subtype: 'debugging', hints: ['bug', 'erro', 'falha', 'quebra', 'stack trace', 'exception', 'crash', 'corrig'] },
  { subtype: 'implementation', hints: ['implement', 'adicione', 'crie', 'construa', 'desenvolva', 'refator', 'ajust'] },
];

const RESEARCH_SUBTYPES: Array<{ subtype: WorkspaceTaskSubtype; hints: string[] }> = [
  { subtype: 'comparison', hints: ['compare', 'comparar', 'versus', 'vs', 'diferenc'] },
  { subtype: 'summarization', hints: ['resuma', 'resumo', 'sumar', 'sintet', 'explique'] },
  { subtype: 'web_research', hints: ['pesquis', 'levant', 'fonte', 'artigo', 'noticia', 'web', 'investig'] },
];

const DESIGN_SUBTYPES: Array<{ subtype: WorkspaceTaskSubtype; hints: string[] }> = [
  { subtype: 'figma_design', hints: ['figma', 'component', 'variantes', 'design system'] },
  { subtype: 'ui_design', hints: ['layout', 'ui', 'ux', 'tela', 'interface', 'wireframe'] },
];

const AUTOMATION_SUBTYPES: Array<{ subtype: WorkspaceTaskSubtype; hints: string[] }> = [
  { subtype: 'form_fill', hints: ['preencha', 'digite', 'submit', 'formulario', 'login'] },
  { subtype: 'navigation', hints: ['abra', 'navegue', 'clique', 'acesse', 'menu'] },
  { subtype: 'app_control', hints: ['app', 'janela', 'zavorthBridge', 'processo', 'desktop'] },
];

export function classifyWorkspaceTaskProfile(signal: WorkspaceTaskKindSignal): WorkspaceTaskProfile {
  const text = String(signal.text || '').trim().toLowerCase();
  const commandType = String(signal.commandType || '').trim().toLowerCase();
  const intent = String(signal.intent || '').trim().toLowerCase();
  const executor = String(signal.executor || '').trim().toLowerCase();

  if (text) {
    if (CODE_HINTS.some((hint) => text.includes(hint))) {
      return {
        kind: 'code',
        subtype: detectSubtype(text, CODE_SUBTYPES),
      };
    }
    if (RESEARCH_HINTS.some((hint) => text.includes(hint))) {
      return {
        kind: 'research',
        subtype: detectSubtype(text, RESEARCH_SUBTYPES),
      };
    }
    if (DESIGN_HINTS.some((hint) => text.includes(hint))) {
      return {
        kind: 'design',
        subtype: detectSubtype(text, DESIGN_SUBTYPES),
      };
    }
    if (AUTOMATION_HINTS.some((hint) => text.includes(hint))) {
      return {
        kind: 'automation',
        subtype: detectSubtype(text, AUTOMATION_SUBTYPES),
      };
    }
  }

  if (commandType === '/stitch') {
    return { kind: 'design', subtype: 'figma_design' };
  }
  if (commandType === '/ag' || commandType === '/bridge') {
    return { kind: 'automation', subtype: 'app_control' };
  }

  if (intent.includes('research')) {
    return { kind: 'research', subtype: 'web_research' };
  }
  if (intent.includes('design')) {
    return { kind: 'design', subtype: 'ui_design' };
  }
  if (intent.includes('interface') || intent.includes('automation')) {
    return { kind: 'automation', subtype: 'navigation' };
  }
  if (intent.includes('code') || intent.includes('shell_execution')) {
    return { kind: 'code', subtype: 'general' };
  }

  if (executor === 'stitch') {
    return { kind: 'design', subtype: 'figma_design' };
  }
  if (executor === 'zavorthBridge') {
    return { kind: 'automation', subtype: 'app_control' };
  }
  if (executor === 'aistudio' || executor === 'web_research') {
    return { kind: 'research', subtype: 'web_research' };
  }
  if (executor === 'codex' || executor === 'external_executor' || executor === 'jules' || executor === 'gemini_cli' || executor === 'local') {
    return { kind: 'code', subtype: 'general' };
  }

  return { kind: 'unknown', subtype: 'unknown' };
}

export function classifyWorkspaceTaskKind(signal: WorkspaceTaskKindSignal): WorkspaceTaskKind {
  return classifyWorkspaceTaskProfile(signal).kind;
}

export function resolveWorkspaceResponseStyle(
  kind: WorkspaceTaskKind,
  subtype: WorkspaceTaskSubtype,
): WorkspaceResponseStyle {
  if (subtype === 'comparison' || subtype === 'web_research') {
    return 'decision_brief';
  }

  if (subtype === 'summarization') {
    return 'summary_first';
  }

  if (subtype === 'review' || subtype === 'testing') {
    return 'findings_first';
  }

  if (subtype === 'debugging') {
    return 'diagnostic';
  }

  if (kind === 'automation') {
    return 'checkpointed';
  }

  if (kind === 'code') {
    return 'implementation_ready';
  }

  return 'direct';
}

function detectSubtype(
  text: string,
  definitions: Array<{ subtype: WorkspaceTaskSubtype; hints: string[] }>,
): WorkspaceTaskSubtype {
  for (const definition of definitions) {
    if (definition.hints.some((hint) => text.includes(hint))) {
      return definition.subtype;
    }
  }

  return 'general';
}
