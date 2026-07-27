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

const CODE_HINTS = ['fix', 'adjust', 'refactor', 'implement', 'bug', 'test', 'tests', 'review', 'revision', 'code', 'repo', 'project'];
const RESEARCH_HINTS = ['research', 'compare', 'survey', 'summar', 'news', 'web', 'article', 'source', 'investig'];
const DESIGN_HINTS = ['layout', 'design', 'ui', 'ux', 'screen', 'interface', 'figma', 'stitch', 'wireframe'];
const AUTOMATION_HINTS = ['open', 'navigate', 'click', 'fill', 'app', 'window', 'interface', 'zavorthBridge', 'automat'];

const CODE_SUBTYPES: Array<{ subtype: WorkspaceTaskSubtype; hints: string[] }> = [
  { subtype: 'testing', hints: ['test', 'tests', 'spec', 'jest', 'pytest', 'coverage'] },
  { subtype: 'review', hints: ['review', 'revision', 'audit', 'inspect', 'code review'] },
  { subtype: 'debugging', hints: ['bug', 'error', 'failure', 'break', 'stack trace', 'exception', 'crash', 'fix'] },
  { subtype: 'implementation', hints: ['implement', 'add', 'create', 'build', 'develop', 'refactor', 'adjust'] },
];

const RESEARCH_SUBTYPES: Array<{ subtype: WorkspaceTaskSubtype; hints: string[] }> = [
  { subtype: 'comparison', hints: ['compare', 'versus', 'vs', 'difference'] },
  { subtype: 'summarization', hints: ['summar', 'summary', 'summarize', 'synthesize', 'explain'] },
  { subtype: 'web_research', hints: ['research', 'survey', 'source', 'article', 'news', 'web', 'investig'] },
];

const DESIGN_SUBTYPES: Array<{ subtype: WorkspaceTaskSubtype; hints: string[] }> = [
  { subtype: 'figma_design', hints: ['figma', 'component', 'variants', 'design system'] },
  { subtype: 'ui_design', hints: ['layout', 'ui', 'ux', 'screen', 'interface', 'wireframe'] },
];

const AUTOMATION_SUBTYPES: Array<{ subtype: WorkspaceTaskSubtype; hints: string[] }> = [
  { subtype: 'form_fill', hints: ['fill', 'type', 'submit', 'form', 'login'] },
  { subtype: 'navigation', hints: ['open', 'navigate', 'click', 'access', 'menu'] },
  { subtype: 'app_control', hints: ['app', 'window', 'zavorthBridge', 'process', 'desktop'] },
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
