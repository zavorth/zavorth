// Zavorth token refresh plane with local logger and proxy resolution.
import * as log from "../utils/logger";
import { updateProviderConnection } from "@/lib/localDb";
import {
  TOKEN_EXPIRY_BUFFER_MS as BUFFER_MS,
  refreshAccessToken as _refreshAccessToken,
  refreshClaudeOAuthToken as _refreshClaudeOAuthToken,
  refreshGoogleToken as _refreshGoogleToken,
  refreshQwenToken as _refreshQwenToken,
  refreshCodexToken as _refreshCodexToken,
  refreshIflowToken as _refreshIflowToken,
  refreshGitHubToken as _refreshGitHubToken,
  refreshCopilotToken as _refreshCopilotToken,
  getAccessToken as _getAccessToken,
  refreshTokenByProvider as _refreshTokenByProvider,
  formatProviderCredentials as _formatProviderCredentials,
  getAllAccessTokens as _getAllAccessTokens,
} from "../compat/openSseCompat";

export const TOKEN_EXPIRY_BUFFER_MS = BUFFER_MS;

export const refreshAccessToken = async (
  provider: string,
  refreshToken: string,
  credentials: Record<string, unknown>
) => {
  return _refreshAccessToken(provider, { ...credentials, refreshToken });
};

export const refreshClaudeOAuthToken = async (refreshToken: string) => {
  return _refreshClaudeOAuthToken({ refreshToken });
};

export const refreshGoogleToken = async (
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  _provider: string = "gemini"
) => {
  return _refreshGoogleToken({ refreshToken, clientId, clientSecret });
};

export const refreshQwenToken = async (refreshToken: string) => {
  return _refreshQwenToken({ refreshToken });
};

export const refreshCodexToken = async (refreshToken: string) => {
  return _refreshCodexToken({ refreshToken });
};

export const refreshIflowToken = async (refreshToken: string) => {
  return _refreshIflowToken({ refreshToken });
};

export const refreshGitHubToken = async (refreshToken: string) => {
  return _refreshGitHubToken({ refreshToken });
};

export const refreshCopilotToken = async (githubAccessToken: string) => {
  return _refreshCopilotToken({ accessToken: githubAccessToken });
};

export const getAccessToken = async (provider: string, credentials: Record<string, unknown>) => {
  return _getAccessToken(provider, credentials);
};

export const refreshTokenByProvider = async (provider: string, credentials: Record<string, unknown>) => {
  return _refreshTokenByProvider(provider, credentials);
};

export const formatProviderCredentials = (_provider: string, credentials: Record<string, unknown>) => {
  return _formatProviderCredentials(credentials);
};

export const getAllAccessTokens = (_userInfo: Record<string, unknown>) => {
  return _getAllAccessTokens();
};

// local-specific: Update credentials in localDb
export async function updateProviderCredentials(connectionId: string, newCredentials: Record<string, unknown>) {
  try {
    const updates: Record<string, unknown> = {};

    if (newCredentials.accessToken) {
      updates.accessToken = newCredentials.accessToken;
    }
    if (newCredentials.refreshToken) {
      updates.refreshToken = newCredentials.refreshToken;
    }
    if (newCredentials.expiresIn) {
      updates.expiresAt = new Date(Date.now() + newCredentials.expiresIn * 1000).toISOString();
      updates.expiresIn = newCredentials.expiresIn;
    }
    if (newCredentials.providerSpecificData) {
      updates.providerSpecificData = newCredentials.providerSpecificData;
    }

    const result = await updateProviderConnection(connectionId, updates);
    log.info("TOKEN_REFRESH", "Credentials updated in localDb", {
      connectionId,
      success: !!result,
    });
    return !!result;
  } catch (error: unknown) {log.error("TOKEN_REFRESH", "Error updating credentials in localDb", {
      connectionId,
      error: (error as Error).message,
    });
    return false;
  }
}

// local-specific: Check and refresh token proactively
export async function checkAndRefreshToken(provider: string, credentials: Record<string, unknown>) {
  let updatedCredentials = { ...credentials };

  // Check regular token expiry
  if (updatedCredentials.expiresAt) {
    const expiresAt = new Date(updatedCredentials.expiresAt).getTime();
    const now = Date.now();

    if (expiresAt - now < TOKEN_EXPIRY_BUFFER_MS) {
      log.info("TOKEN_REFRESH", "Token expiring soon, refreshing proactively", {
        provider,
        expiresIn: Math.round((expiresAt - now) / 1000),
      });

      const newCredentials = await getAccessToken(provider, updatedCredentials);
      if (newCredentials && newCredentials.accessToken) {
        await updateProviderCredentials(updatedCredentials.connectionId, newCredentials);

        updatedCredentials = {
          ...updatedCredentials,
          accessToken: newCredentials.accessToken,
          refreshToken: newCredentials.refreshToken || updatedCredentials.refreshToken,
          expiresAt: newCredentials.expiresIn
            ? new Date(Date.now() + newCredentials.expiresIn * 1000).toISOString()
            : updatedCredentials.expiresAt,
        };
      }
    }
  }

  // Check GitHub copilot token expiry
  if (provider === "github" && updatedCredentials.providerSpecificData?.copilotTokenExpiresAt) {
    const copilotExpiresAt = updatedCredentials.providerSpecificData.copilotTokenExpiresAt * 1000;
    const now = Date.now();

    if (copilotExpiresAt - now < TOKEN_EXPIRY_BUFFER_MS) {
      log.info("TOKEN_REFRESH", "Copilot token expiring soon, refreshing proactively", {
        provider,
        expiresIn: Math.round((copilotExpiresAt - now) / 1000),
      });

      const copilotToken = await refreshCopilotToken(updatedCredentials.accessToken);
      if (copilotToken) {
        await updateProviderCredentials(updatedCredentials.connectionId, {
          providerSpecificData: {
            ...updatedCredentials.providerSpecificData,
            copilotToken: copilotToken.token,
            copilotTokenExpiresAt: copilotToken.expiresAt,
          },
        });

        updatedCredentials.providerSpecificData = {
          ...updatedCredentials.providerSpecificData,
          copilotToken: copilotToken.token,
          copilotTokenExpiresAt: copilotToken.expiresAt,
        };
        // Sync to top-level so buildHeaders() picks up the fresh token
        updatedCredentials.copilotToken = copilotToken.token;
      }
    }
  }

  return updatedCredentials;
}

// local-specific: Refresh GitHub and Copilot tokens together
export async function refreshGitHubAndCopilotTokens(credentials: Record<string, unknown>) {
  const newGitHubCredentials = await refreshGitHubToken(credentials.refreshToken);
  if (newGitHubCredentials?.accessToken) {
    const copilotToken = await refreshCopilotToken(newGitHubCredentials.accessToken);
    if (copilotToken) {
      return {
        ...newGitHubCredentials,
        providerSpecificData: {
          copilotToken: copilotToken.token,
          copilotTokenExpiresAt: copilotToken.expiresAt,
        },
      };
    }
  }
  return newGitHubCredentials;
}
