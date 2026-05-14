export type ComboFormModalProps = {
  isOpen: boolean;
  combo: any;
  onClose: () => void;
  onSave: (data: any) => Promise<void> | void;
  activeProviders: any[];
};

export type CreateDraftSnapshot = {
  name: string;
  models: any[];
  strategy: string;
  config: Record<string, unknown>;
  showAdvanced: boolean;
  nameError: string;
  agentSystemMessage: string;
  agentToolFilter: string;
  agentContextCache: boolean;
};
