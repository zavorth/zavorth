export const ZAVORTH_SESSION_TRANSCRIPT_EXPORT_CONTRACT_VERSION =
  'zavorth-session-transcript-export/1' as const;

export type ZavorthSessionTranscriptExportFormat = 'markdown' | 'html' | 'prompt';

export type ZavorthSessionTranscriptExportStatus =
  | 'preview'
  | 'exported'
  | 'empty'
  | 'blocked'
  | 'approval-required';

export type ZavorthSessionTranscriptMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string | null;
  surface: string | null;
};

export type ZavorthSessionTranscriptExportInput = {
  sessionId?: string | null;
  platform?: string | null;
  chatId?: string | null;
  /** Inline messages (tests / imported transcripts). */
  messages?: ZavorthSessionTranscriptMessage[] | null;
  format?: ZavorthSessionTranscriptExportFormat | string | null;
  exportPath?: string | null;
  approvalId?: string | null;
  /** Default true — redact secrets before render/write. */
  redact?: boolean | null;
  title?: string | null;
  projectRoot?: string | null;
  includeSystem?: boolean | null;
};

export type ZavorthSessionTranscriptExportSnapshot = {
  contractVersion: typeof ZAVORTH_SESSION_TRANSCRIPT_EXPORT_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ZavorthSessionTranscriptExportService';
  status: ZavorthSessionTranscriptExportStatus;
  format: ZavorthSessionTranscriptExportFormat;
  sessionId: string | null;
  title: string | null;
  exportPath: string | null;
  messageCount: number;
  bodyPreview: string;
  body: string;
  safety: {
    redactDefaultOn: true;
    secretsRedacted: boolean;
    requiresApprovalForWrite: true;
    exportPathConfinedToProject: true;
  };
  commands: {
    preview: string;
    apply: string;
  };
};
