export const SEMANTIC_CARD_CONTRACT_VERSION = 'semantic-card/v1' as const;

export type SemanticControlStyle = 'primary' | 'secondary' | 'success' | 'danger';

export type SemanticChoiceOption = {
  id: string;
  label: string;
  style?: SemanticControlStyle;
  command?: string | null;
  callbackData?: string | null;
  description?: string | null;
};

export type SemanticControl =
  | {
      kind: 'choice_group';
      id: string;
      purpose: 'approval' | 'configuration' | 'generic';
      options: SemanticChoiceOption[];
      defaultOptionId?: string;
      required?: boolean;
    }
  | {
      kind: 'confirm';
      id: string;
      purpose: 'safety' | 'generic';
      confirmLabel: string;
      cancelLabel: string;
      confirmCallbackData?: string | null;
      cancelCallbackData?: string | null;
      confirmCommand?: string | null;
      cancelCommand?: string | null;
    }
  | {
      kind: 'command_hint';
      id: string;
      commands: string[];
    }
  | {
      kind: 'link_out';
      id: string;
      label: string;
      href: string;
    };

export type SemanticCard = {
  version: typeof SEMANTIC_CARD_CONTRACT_VERSION;
  id: string;
  intent: 'approval' | 'status' | 'models' | 'receipt' | 'help' | 'generic';
  title: string;
  summary?: string | null;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  bodyText?: string | null;
  controls: SemanticControl[];
  metadata?: Record<string, unknown>;
};
