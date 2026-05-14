export const SURFACE_RESPONSE_CONTRACT_VERSION = 'surface-response/v1' as const;

export type SurfaceResponseVersion = typeof SURFACE_RESPONSE_CONTRACT_VERSION;

export type SurfaceResponseTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

export type SurfaceResponseIntent =
  | 'status'
  | 'models'
  | 'approval'
  | 'receipt'
  | 'help'
  | 'generic';

export type SurfaceResponseActionStyle =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger';

export type SurfaceResponseActionKind =
  | 'command'
  | 'callback'
  | 'url'
  | 'submit';

export type SurfaceResponseAction = {
  id: string;
  label: string;
  kind?: SurfaceResponseActionKind;
  style?: SurfaceResponseActionStyle;
  command?: string | null;
  callbackData?: string | null;
  href?: string | null;
  disabled?: boolean;
  confirmationRequired?: boolean;
  description?: string | null;
  metadata?: Record<string, unknown>;
};

export type SurfaceTableColumn = {
  key: string;
  label: string;
  width?: number;
  align?: 'left' | 'right';
};

export type SurfaceTableCell = string | number | boolean | null;

export type SurfaceTable = {
  title?: string | null;
  columns: SurfaceTableColumn[];
  rows: Array<Record<string, SurfaceTableCell>>;
  emptyText?: string | null;
};

export type SurfaceProgressStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'blocked'
  | 'failed';

export type SurfaceProgress = {
  label: string;
  status: SurfaceProgressStatus;
  current?: number | null;
  total?: number | null;
  detail?: string | null;
};

export type SurfaceReceiptStatus =
  | 'allowed'
  | 'allowed_with_redaction'
  | 'require_user_confirmation'
  | 'require_admin_policy'
  | 'denied'
  | 'blocked'
  | 'done'
  | 'failed';

export type SurfaceReceipt = {
  id: string;
  title: string;
  status: SurfaceReceiptStatus;
  reason: string;
  policyProfile?: string | null;
  redacted?: boolean;
  riskBlocked?: boolean;
  createdAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type SurfaceBlock =
  | {
      kind: 'text';
      id?: string;
      title?: string | null;
      text: string;
      tone?: SurfaceResponseTone;
    }
  | {
      kind: 'list';
      id?: string;
      title?: string | null;
      items: string[];
      tone?: SurfaceResponseTone;
    }
  | {
      kind: 'table';
      id?: string;
      table: SurfaceTable;
      tone?: SurfaceResponseTone;
    }
  | {
      kind: 'progress';
      id?: string;
      progress: SurfaceProgress;
      tone?: SurfaceResponseTone;
    }
  | {
      kind: 'receipt';
      id?: string;
      receipt: SurfaceReceipt;
      tone?: SurfaceResponseTone;
    }
  | {
      kind: 'actions';
      id?: string;
      title?: string | null;
      actions: SurfaceResponseAction[];
      tone?: SurfaceResponseTone;
    };

export type SurfaceResponse = {
  version: SurfaceResponseVersion;
  id: string;
  intent: SurfaceResponseIntent;
  title: string;
  summary?: string | null;
  tone?: SurfaceResponseTone;
  blocks: SurfaceBlock[];
  actions?: SurfaceResponseAction[];
  receipts?: SurfaceReceipt[];
  metadata?: Record<string, unknown>;
};

export type SurfaceRenderTarget =
  | 'plain'
  | 'cli'
  | 'telegram'
  | 'discord'
  | 'slack'
  | 'whatsapp'
  | 'instagram'
  | 'teams'
  | 'email'
  | 'signal'
  | 'imessage'
  | 'web';

export type SurfaceRenderedAction = {
  id: string;
  label: string;
  style: SurfaceResponseActionStyle;
  kind: SurfaceResponseActionKind;
  command: string | null;
  callbackData: string | null;
  href: string | null;
  disabled: boolean;
  confirmationRequired: boolean;
};

export type SurfaceRenderedActionRow = {
  actions: SurfaceRenderedAction[];
};

export type SurfaceRenderedResponse<TNative = Record<string, unknown> | null> = {
  target: SurfaceRenderTarget;
  format: 'plain' | 'cli' | 'telegram-text' | 'discord-markdown';
  text: string;
  actions: SurfaceRenderedActionRow[];
  native: TNative;
};

export type SurfaceRenderOptions = {
  maxActionsPerRow?: number;
  includeDisabledActions?: boolean;
  maxTextLength?: number;
};

export function createSurfaceResponse(
  input: Omit<SurfaceResponse, 'version'> & { version?: SurfaceResponseVersion },
): SurfaceResponse {
  return {
    ...input,
    version: input.version || SURFACE_RESPONSE_CONTRACT_VERSION,
    blocks: [...input.blocks],
    actions: input.actions ? [...input.actions] : [],
    receipts: input.receipts ? [...input.receipts] : [],
  };
}
