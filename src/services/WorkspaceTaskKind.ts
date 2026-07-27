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

const CONTROLLED_INTENT_PROFILES = new Map<string, WorkspaceTaskProfile>([
  ['research', { kind: 'research', subtype: 'web_research' }],
  ['web_research', { kind: 'research', subtype: 'web_research' }],
  ['comparison', { kind: 'research', subtype: 'comparison' }],
  ['summarization', { kind: 'research', subtype: 'summarization' }],
  ['design', { kind: 'design', subtype: 'ui_design' }],
  ['figma_design', { kind: 'design', subtype: 'figma_design' }],
  ['interface', { kind: 'automation', subtype: 'navigation' }],
  ['automation', { kind: 'automation', subtype: 'navigation' }],
  ['shell_execution', { kind: 'code', subtype: 'general' }],
  ['code', { kind: 'code', subtype: 'general' }],
  ['debugging', { kind: 'code', subtype: 'debugging' }],
  ['testing', { kind: 'code', subtype: 'testing' }],
  ['review', { kind: 'code', subtype: 'review' }],
  ['implementation', { kind: 'code', subtype: 'implementation' }],
]);

const CONTROLLED_EXECUTOR_PROFILES = new Map<string, WorkspaceTaskProfile>([
  ['stitch', { kind: 'design', subtype: 'figma_design' }],
  ['zavorthBridge', { kind: 'automation', subtype: 'app_control' }],
  ['aistudio', { kind: 'research', subtype: 'web_research' }],
  ['web_research', { kind: 'research', subtype: 'web_research' }],
  ['codex', { kind: 'code', subtype: 'general' }],
  ['external_executor', { kind: 'code', subtype: 'general' }],
  ['jules', { kind: 'code', subtype: 'general' }],
  ['gemini_cli', { kind: 'code', subtype: 'general' }],
  ['local', { kind: 'code', subtype: 'general' }],
]);

export function classifyWorkspaceTaskProfile(signal: WorkspaceTaskKindSignal): WorkspaceTaskProfile {
  const commandType = String(signal.commandType || '').trim().toLowerCase();
  const intent = String(signal.intent || '').trim().toLowerCase();
  const executor = String(signal.executor || '').trim().toLowerCase();

  if (commandType === '/stitch') {
    return { kind: 'design', subtype: 'figma_design' };
  }
  if (commandType === '/ag' || commandType === '/bridge') {
    return { kind: 'automation', subtype: 'app_control' };
  }

  const intentProfile = CONTROLLED_INTENT_PROFILES.get(intent);
  if (intentProfile) return intentProfile;

  const executorProfile = CONTROLLED_EXECUTOR_PROFILES.get(executor);
  if (executorProfile) return executorProfile;

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
