export type ConnectionAuthType = 'oauth2' | 'api_key' | 'local_path' | 'env_secret' | 'custom';

export type ConnectionHealthStatus = 'healthy' | 'degraded' | 'expiring' | 'error' | 'unknown';

/**
 * Descriptor that declares how a plugin or service can be connected.
 * Used by the connection resolver to drive the handshake.
 */
export interface PluginConnectionDescriptor {
  /** Type of authentication required to establish the connection. */
  authType: ConnectionAuthType;

  /** Whether PKCE must be used for OAuth2 authorization code flow (RFC 8252). */
  usePkce: boolean;

  /** OAuth2-specific configuration. Optional: omitted when authType is not 'oauth2'. */
  oauth?: {
    /** URL where the user is redirected to authorize the application. Required for 'oauth2'. */
    authorizationUrl?: string;

    /** Token endpoint URL. Required for 'oauth2'. */
    tokenUrl: string;

    /** RFC 7009 token revocation endpoint. Optional. */
    revokeUrl?: string;

    /** Scopes requested during authorization. Required for 'oauth2'. */
    scopes: string[];

    /** Whether the provider supports device authorization grant (RFC 8628). */
    supportsDeviceCode?: boolean;

    /** Device code endpoint URL. Required when supportsDeviceCode is true. */
    deviceCodeUrl?: string;

    /** Web verification URL where the user enters the device code (RFC 8628). Optional. */
    verificationUri?: string;

    /** Optional userinfo or ping endpoint to verify that the access token is valid. */
    userinfoUrl?: string;

    /** Client ID for OAuth2 application. Optional. */
    clientId?: string;

    /** Client secret for confidential clients. Optional. */
    clientSecret?: string;
  };

  /** API key configuration. Optional: used when authType is 'api_key'. */
  apiKey?: {
    /** Human-readable label for the key (e.g., "API Key"). */
    label: string;

    /** Placeholder text shown in the input field. */
    placeholder: string;

    /** Optional link to documentation explaining how to obtain the key. */
    helpUrl?: string;

    /** Optional endpoint to verify the key is valid (HEAD/GET). */
    verificationEndpoint?: string;
  };

  /** Local path configuration. Optional: used when authType is 'local_path'. */
  localPath?: {
    /** Whether the target is a directory or a file. */
    kind: 'directory' | 'file';

    /** Human-readable label for the path (e.g., "Obsidian Vault"). */
    label: string;

    /** Optional file/folder marker that proves the path is valid (e.g., ".obsidian"). */
    expectedMarker?: string;
  };
}

/**
 * Descriptor for rendering a connection card in Desktop/Web surfaces,
 * or for generating a one-touch deep-link on chat surfaces.
 */
export interface ConnectionCardDescriptor {
  /** Unique identifier of the target (e.g., "github", "stripe", "obsidian"). */
  targetId: string;

  /** Human-readable display name (e.g., "GitHub", "Stripe", "Obsidian Vault"). */
  displayName: string;

  /** Lucide icon identifier (e.g., "github", "database", "key") or absolute asset URI. */
  icon: string;

  /** Authentication type, mirrored from the descriptor for UI rendering. */
  authType: ConnectionAuthType;

  /** Current connection lifecycle state. */
  status: 'disconnected' | 'authenticating' | 'connected' | 'error' | 'expired';

  /** Optional health indicator for the established connection. */
  healthStatus?: 'healthy' | 'degraded' | 'expiring' | 'error' | 'unknown';

  /** Primary OAuth authorization deep-link (present when authType is 'oauth2'). */
  actionUrl?: string;

  /** Input guidance for API key or local directory input (used when authType is 'api_key' or 'local_path'). */
  inputPrompt?: {
    label: string;
    placeholder: string;
    helpUrl?: string;
  };

  // Enriched Device Code fields (RFC 8628)
  deviceCodeUserCode?: string;
  deviceCodeVerificationUrl?: string;
  deviceCodePollIntervalSeconds?: number;
  deviceCodeExpiresAt?: string;

  /** Optional help link for troubleshooting. */
  helpUrl?: string;

  /** Handshake timeout ceiling in seconds (e.g., 300 for browser, 900 for device code). */
  handshakeTimeoutSeconds?: number;
}