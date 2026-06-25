export type ZavorthModality =
  | 'text'
  | 'voice'
  | 'image'
  | 'code'
  | 'table'
  | 'diagram';

export type ZavorthModalityPreference = {
  modality: ZavorthModality;
  whenToUse: string;
  enabled: boolean;
  addedAt: string;
};

export type ZavorthMultiModalPolicy = {
  schemaVersion: 'zavorth.multi-modal.policy/v1';
  preferences: ZavorthModalityPreference[];
  updatedAt: string;
};
