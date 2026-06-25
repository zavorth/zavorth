export interface ModelInfo {
  id: string;
  object: string;
  owned_by: string;
}

export interface ProviderOption {
  value: string;
  label: string;
}

export interface ConnectionOption {
  id: string;
  name: string;
  provider: string;
  authType: string;
}

export interface PlaygroundOption {
  value: string;
  label: string;
}

export interface PlaygroundImageResult {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}
