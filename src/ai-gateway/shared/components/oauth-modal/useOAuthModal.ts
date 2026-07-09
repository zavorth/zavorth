import { asErrorLike } from '../../../../utils/errorLike';
import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from '@/shared/utils/logger';
"use client";


import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import type {
  OAuthAuthorizationSession,
  OAuthCopyHandler,
  OAuthDeviceCodeData,
  OAuthModalProps,
  OAuthModalStep,
} from "./oauthModalTypes";

import {
buildGoogleRedirectMismatchMessage,
  buildRedirectUri,
  isAcceptedCallbackOrigin,
  isDeviceCodeProvider,
  isGoogleOAuthProvider,
  parseCallbackInput,
  readOAuthErrorMessage,
  shouldForceManualInput,
  sleep,
} from "./oauthModalUtils";

type UseOAuthModalArgs = Pick<OAuthModalProps, "idcConfig" | "isOpen" | "onSuccess" | "provider">;
type DeviceCodeExtraData = Record<string, unknown> | null;

export function useOAuthModal({
  isOpen,
  provider,
  onSuccess,
  idcConfig,
}: UseOAuthModalArgs) {
  const [step, setStep] = useState<OAuthModalStep>("waiting");
  const [authData, setAuthData] = useState<OAuthAuthorizationSession | null>(null);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDeviceCode, setIsDeviceCode] = useState(false);
  const [deviceData, setDeviceData] = useState<OAuthDeviceCodeData | null>(null);
  const [polling, setPolling] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const { copied, copy } = useCopyToClipboard();

  const [isLocalhost, setIsLocalhost] = useState(false);
  const [placeholderUrl, setPlaceholderUrl] = useState("/callback?code=...");
  const [isTrueLocalhost, setIsTrueLocalhost] = useState(false);
  const callbackProcessedRef = useRef(false);
  const flowStartedRef = useRef(false);

  void idcConfig;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const hostname = window.location.hostname;
    const localNetwork =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
    const trulyLocal = hostname === "localhost" || hostname === "127.0.0.1";

    setIsLocalhost(localNetwork);
    setIsTrueLocalhost(trulyLocal);
    setPlaceholderUrl(`${window.location.origin}/callback?code=...`);
  }, []);

  const handleCopy: OAuthCopyHandler = useCallback(
    (value, key) => {
      if (!value) return;
      copy(value, key);
    },
    [copy]
  );

  const exchangeTokens = useCallback(
    async (code: string, state?: string | null) => {
      if (!authData || !provider) return;

      try {
        if (!authData.redirectUri || !authData.codeVerifier) {
          throw new Error(
            "OAuth session is incomplete (missing redirect URI or code verifier). Restart the connection and try again."
          );
        }

        const normalizedState =
          typeof state === "string" && state.length > 0 ? state : undefined;
        const res = await fetch(`/api/oauth/${provider}/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            redirectUri: authData.redirectUri,
            codeVerifier: authData.codeVerifier,
            ...(normalizedState ? { state: normalizedState } : {}),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(readOAuthErrorMessage(data, "Exchange failed"));
        }

        setStep("success");
        onSuccess?.();
      } catch (caughtError: unknown) {
        const err = asErrorLike(caughtError);
        const error = err;
        const message =
          caughtError instanceof Error ? err.message : "Exchange failed unexpectedly";
        if (
          message.toLowerCase().includes("redirect_uri_mismatch") &&
          isGoogleOAuthProvider(provider)
        ) {
          setError(buildGoogleRedirectMismatchMessage(provider));
        } else {
          setError(message);
        }
        setStep("error");
      }
    },
    [authData, onSuccess, provider]
  );

  const startPolling = useCallback(
    async (
      deviceCode: string,
      codeVerifier: string | undefined,
      initialInterval: number,
      extraData: DeviceCodeExtraData
    ) => {
      if (!provider) return;

      setPolling(true);
      let interval = initialInterval;
      const maxAttempts = 60;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await sleep(interval * 1000);

        try {
          const res = await fetch(`/api/oauth/${provider}/poll`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceCode, codeVerifier, extraData }),
          });
          const data = await res.json();

          if (data.success) {
            setStep("success");
            setPolling(false);
            onSuccess?.();
            return;
          }

          if (data.error === "expired_token" || data.error === "access_denied") {
            throw new Error(data.errorDescription || data.error);
          }

          if (data.error === "slow_down") {
            interval = Math.min(interval + 5, 30);
          }
        } catch (caughtError: unknown) {
          const err = asErrorLike(caughtError);
          const error = err;
          const message =
            caughtError instanceof Error
              ? err.message
              : "Authorization polling failed unexpectedly";
          setError(message);
          setStep("error");
          setPolling(false);
          return;
        }
      }

      setError("Authorization timeout");
      setStep("error");
      setPolling(false);
    },
    [onSuccess, provider]
  );

  const startOAuthFlow = useCallback(async () => {
    if (!provider) return;

    try {
      callbackProcessedRef.current = false;
      setAuthData(null);
      setCallbackUrl("");
      setError(null);
      setIsDeviceCode(false);
      setDeviceData(null);
      setPolling(false);

      if (isDeviceCodeProvider(provider)) {
        setIsDeviceCode(true);
        setStep("waiting");

        const res = await fetch(`/api/oauth/${provider}/device-code`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(readOAuthErrorMessage(data, "Request failed"));
        }

        setDeviceData(data);
        const verifyUrl = data.verification_uri_complete || data.verification_uri;
        if (verifyUrl) {
          window.open(verifyUrl, "oauth_verify");
        }

        const extraData =
          provider === "kiro"
            ? { _clientId: data._clientId, _clientSecret: data._clientSecret }
            : null;
        startPolling(data.device_code, data.codeVerifier, data.interval || 5, extraData);
        return;
      }

      let forceManual = shouldForceManualInput(provider);

      if (provider === "codex" && isLocalhost) {
        try {
          const serverRes = await fetch("/api/oauth/codex/start-callback-server");
          const serverData = await serverRes.json();
          if (!serverRes.ok) {
            throw new Error(serverData.error);
          }

          setAuthData({ ...serverData, redirectUri: serverData.redirectUri });
          setStep("waiting");
          popupRef.current = window.open(serverData.authUrl, "oauth_auth");
          if (!popupRef.current) {
            setStep("input");
          }

          setPolling(true);
          const maxAttempts = 150;
          for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            await sleep(2000);

            const pollRes = await fetch("/api/oauth/codex/poll-callback", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            const pollData = await pollRes.json();

            if (pollData.success) {
              setStep("success");
              setPolling(false);
              onSuccess?.();
              return;
            }

            if (pollData.error && !pollData.pending) {
              throw new Error(pollData.errorDescription || pollData.error);
            }
          }

          setPolling(false);
          throw new Error("Authorization timeout");
        } catch (caughtError: unknown) {console.warn(
            "Codex callback server failed, falling back to standard manual flow",
            caughtError
          );
          setPolling(false);
          forceManual = true;
        }
      }

      const redirectUri = buildRedirectUri(provider, isLocalhost);
      const res = await fetch(
        `/api/oauth/${provider}/authorize?redirect_uri=${encodeURIComponent(redirectUri)}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(readOAuthErrorMessage(data, "Authorization failed"));
      }

      if (!data.authUrl) {
        throw new Error(
          data.error ||
            "Browser OAuth is unavailable for this provider in the current environment. Use the supported auth method instead."
        );
      }

      setAuthData({ ...data, redirectUri });

      if (!isTrueLocalhost || forceManual) {
        setStep("input");
        window.open(data.authUrl, "oauth_auth");
        return;
      }

      setStep("waiting");
      popupRef.current = window.open(data.authUrl, "oauth_popup", "width=600,height=700");
      if (!popupRef.current) {
        setStep("input");
      }
    } catch (caughtError: unknown) {
      const err = asErrorLike(caughtError);
      const error = err;
      const message =
        caughtError instanceof Error ? err.message : "OAuth flow failed unexpectedly";
      setError(message);
      setStep("error");
    }
  }, [isLocalhost, isTrueLocalhost, onSuccess, provider, startPolling]);

  const switchToManualInput = useCallback(() => {
    setStep("input");
  }, []);

  useEffect(() => {
    if (!isOpen) {
      flowStartedRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !provider) {
      return;
    }

    if (flowStartedRef.current) {
      return;
    }

    flowStartedRef.current = true;
    startOAuthFlow();
  }, [isOpen, provider, startOAuthFlow]);

  useEffect(() => {
    if (!authData) {
      return;
    }

    callbackProcessedRef.current = false;

    const handleCallback = async (data: {
      code?: string | null;
      state?: string | null;
      error?: string | null;
      errorDescription?: string | null;
    }) => {
      if (callbackProcessedRef.current) {
        return;
      }

      const { code, state, error: callbackError, errorDescription } = data;
      if (callbackError) {
        callbackProcessedRef.current = true;
        setError(errorDescription || callbackError);
        setStep("error");
        return;
      }

      if (!code) {
        return;
      }

      callbackProcessedRef.current = true;
      await exchangeTokens(code, state);
    };

    const handleMessage = (event: MessageEvent) => {
      if (
        !isAcceptedCallbackOrigin(event.origin, window.location.origin, window.location.port)
      ) {
        return;
      }

      if (event.data?.type === "oauth_callback") {
        void handleCallback(event.data.data);
      }
    };
    window.addEventListener("message", handleMessage);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("oauth_callback");
      channel.onmessage = (event) => {
        void handleCallback(event.data);
      };
    } catch (error: unknown) {console.log("BroadcastChannel not supported");
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "oauth_callback" || !event.newValue) {
        return;
      }

      try {
        const data = JSON.parse(event.newValue);
        void handleCallback(data);
        localStorage.removeItem("oauth_callback");
      } catch (error: unknown) {console.log("Failed to parse localStorage data");
      }
    };
    window.addEventListener("storage", handleStorage);

    try {
      const stored = localStorage.getItem("oauth_callback");
      if (stored) {
        const data = JSON.parse(stored);
        if (data.timestamp && Date.now() - data.timestamp < 30000) {
          void handleCallback(data);
          localStorage.removeItem("oauth_callback");
        }
      }
    } catch (error: unknown) {// Ignore malformed or unavailable localStorage.
      logger.warn('[use O Auth Modal] JSON parse failed', error);
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
      channel?.close();
    };
  }, [authData, exchangeTokens]);

  useEffect(() => {
    if (step !== "waiting" || isDeviceCode || !popupRef.current) {
      return;
    }

    const popupClosedInterval = setInterval(() => {
      if (callbackProcessedRef.current) {
        clearInterval(popupClosedInterval);
        return;
      }

      try {
        if (popupRef.current?.closed && step === "waiting") {
          clearInterval(popupClosedInterval);
          setStep("input");
        }
      } catch (error: unknown) {// Ignore cross-origin access errors.
      logger.warn('[use O Auth Modal] resource cleanup failed', error);
    }
    }, 1000);

    const safetyTimeout = setTimeout(() => {
      if (!callbackProcessedRef.current && step === "waiting") {
        clearInterval(popupClosedInterval);
        setStep("input");
      }
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(popupClosedInterval);
      clearTimeout(safetyTimeout);
    };
  }, [isDeviceCode, step]);

  const handleManualSubmit = useCallback(async () => {
    try {
      setError(null);

      if (!authData) {
        throw new Error("OAuth session not initialized. Restart the connection flow and try again.");
      }

      const input = callbackUrl.trim();
      const callbackData = parseCallbackInput(input, authData.state);
      if (callbackData.error) {
        throw new Error(callbackData.errorDescription || callbackData.error);
      }

      if (!callbackData.code) {
        throw new Error(
          "No authorization code found. Paste the callback URL or the Authentication Code."
        );
      }

      await exchangeTokens(callbackData.code, callbackData.state);
    } catch (caughtError: unknown) {
      const err = asErrorLike(caughtError);
      const error = err;
      const message =
        caughtError instanceof Error ? err.message : "Manual callback handling failed";
      setError(message);
      setStep("error");
    }
  }, [authData, callbackUrl, exchangeTokens]);

  return {
    authData,
    callbackUrl,
    copied,
    deviceData,
    error,
    handleCopy,
    handleManualSubmit,
    isDeviceCode,
    isTrueLocalhost,
    placeholderUrl,
    polling,
    setCallbackUrl,
    startOAuthFlow,
    step,
    switchToManualInput,
  };
}
