export type OAuthProviderInfo = {
  name: string;
};

export type OAuthModalProps = {
  isOpen: boolean;
  provider?: string;
  providerInfo?: OAuthProviderInfo | null;
  onSuccess?: () => void;
  onClose: () => void;
  idcConfig?: unknown;
};

export type OAuthModalStep = "waiting" | "input" | "success" | "error";

export type OAuthAuthorizationSession = {
  authUrl?: string;
  redirectUri?: string;
  codeVerifier?: string;
  state?: string | null;
  [key: string]: unknown;
};

export type OAuthDeviceCodeData = {
  verification_uri: string;
  verification_uri_complete?: string;
  user_code: string;
  device_code: string;
  codeVerifier?: string;
  interval?: number;
  _clientId?: string;
  _clientSecret?: string;
  [key: string]: unknown;
};

export type OAuthCallbackData = {
  code?: string | null;
  state?: string | null;
  error?: string | null;
  errorDescription?: string | null;
  timestamp?: number;
};

export type OAuthCopyHandler = (value: string | null | undefined, key: string) => void;
