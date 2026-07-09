import { QWEN_CONFIG } from "../constants/oauth";
import { decodeJwt } from "jose";
import { logger } from '@/shared/utils/logger';

export const qwen = {
  config: QWEN_CONFIG,
  flowType: "device_code",
  requestDeviceCode: async (config, codeChallenge) => {
    const response = await fetch(config.deviceCodeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        scope: config.scope,
        code_challenge: codeChallenge,
        code_challenge_method: config.codeChallengeMethod,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Device code request failed: ${error}`);
    }

    return await response.json();
  },
  pollToken: async (config, deviceCode, codeVerifier) => {
    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        client_id: config.clientId,
        device_code: deviceCode,
        code_verifier: codeVerifier,
      }),
    });

    return {
      ok: response.ok,
      data: await response.json(),
    };
  },
  mapTokens: (tokens) => {
    let email = null;
    let displayName = null;
    if (tokens.id_token) {
      try {
        const decoded = decodeJwt(tokens.id_token);
        email = decoded.email || decoded.preferred_username || null;
        displayName = decoded.name || email;
      } catch (error: any) { const err = error; const e = error;
      // Ignore
      logger.warn('[qwen] encoding failed', error);
    }
    }

    if (!email && tokens.access_token) {
      try {
        const decodedToken = decodeJwt(tokens.access_token);
        email = decodedToken.email || decodedToken.preferred_username || decodedToken.sub || null;
        displayName = decodedToken.name || email;
      } catch (error: any) { const err = error; const e = error;
      // Ignore
      logger.warn('[qwen] encoding failed', error);
    }
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      idToken: tokens.id_token,
      email,
      displayName,
      providerSpecificData: { resourceUrl: tokens.resource_url },
    };
  },
};
