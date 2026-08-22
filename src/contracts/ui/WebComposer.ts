export type WebComposerTrigger = '/' | '@' | '#';

export type WebComposerMentionType =
  | 'command'
  | 'skill'
  | 'task'
  | 'permission'
  | 'artifact'
  | 'file'
  | 'action';

export interface WebComposerMention {
  id: string;
  type: WebComposerMentionType;
  label: string;
  description?: string | null;
  trigger?: WebComposerTrigger | null;
  aliases?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: Record<string, any>;
}

export interface WebComposerAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  text?: string | null;
  content?: string | null;
  truncated?: boolean;
  source?: string | null;
  media?: {
    kind?: string | null;
    mimeType?: string | null;
    encoding?: string | null;
  } | null;
  extraction?: {
    kind?: string | null;
    label?: string | null;
    detail?: string | null;
  } | null;
}

export interface WebComposerSelectedSkill {
  id: string;
  title: string;
  prompt?: string | null;
  status?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: Record<string, any>;
}

export interface WebComposerVoiceInput {
  transcript: string;
  language?: string | null;
  source?: string | null;
  confidence?: number | null;
}

export interface WebComposerCatalog {
  commands: WebComposerMention[];
  skills: WebComposerMention[];
  recentTasks: WebComposerMention[];
  pendingPermissions: WebComposerMention[];
  artifacts: WebComposerMention[];
  files: WebComposerMention[];
  suggestedActions: WebComposerMention[];
}
