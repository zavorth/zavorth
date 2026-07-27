export interface AuthProvider {
  readonly authType: string;
  resolveCredentials(env: Record<string, string | undefined>): Promise<ResolvedCredentials>;
  buildHeaders(credentials: ResolvedCredentials): Record<string, string>;
  buildRequestInit(credentials: ResolvedCredentials): RequestInit;
}

export interface ResolvedCredentials {
  apiKey?: string;
  token?: string;
  baseUrl?: string;
  awsAccessKey?: string;
  awsSecretKey?: string;
  awsSessionToken?: string;
  awsRegion?: string;
  projectId?: string;
  region?: string;
  extra?: Record<string, string>;
}
