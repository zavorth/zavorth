import { validateQoderCliPat } from "@ZavorthGateway/open-sse/services/qoderCli.ts";
import {
  applyCustomUserAgent,
  buildBearerHeaders,
  normalizeBaseUrl,
  withCustomUserAgent,
} from "./validationHttpSupport.ts";
import { assertProviderValidationTargetAllowed } from "../security/egressGuard.ts";

import { logger } from '@/shared/utils/logger';interface SpecialtyProviderInput {
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}

interface SpecialtyProviderFullInput {
  provider: string;
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}

interface ValidationSuccess {
  valid: true;
  error: null;
}

interface ValidationFailure {
  valid: false;
  error: string;
}

type ValidationResult = ValidationSuccess | ValidationFailure;

interface SearchValidationResult extends ValidationFailure {
  unsupported: false;
}

interface SearchValidationSuccess extends ValidationSuccess {
  unsupported: false;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Validation failed";
}

async function validateDeepgramProvider({
  apiKey,
  providerSpecificData = {},
}: SpecialtyProviderInput): Promise<ValidationResult> {
  try {
    const response = await fetch("https://api.deepgram.com/v1/auth/token", {
      method: "GET",
      headers: applyCustomUserAgent(
        { Authorization: `Token ${apiKey}` },
        providerSpecificData,
      ),
    });
    if (response.ok) return { valid: true, error: null };
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }
    return { valid: false, error: `Validation failed: ${response.status}` };
  } catch (error: unknown) {logger.warn('[validation Specialty s] validation failed', error);
    return { valid: false, error: extractErrorMessage(error) };
  }
}

async function validateAssemblyAIProvider({
  apiKey,
  providerSpecificData = {},
}: SpecialtyProviderInput): Promise<ValidationResult> {
  try {
    const response = await fetch(
      "https://api.assemblyai.com/v2/transcript...limit=1",
      {
        method: "GET",
        headers: applyCustomUserAgent(
          {
            Authorization: apiKey,
            "Content-Type": "application/json",
          },
          providerSpecificData,
        ),
      },
    );
    if (response.ok) return { valid: true, error: null };
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }
    return { valid: false, error: `Validation failed: ${response.status}` };
  } catch (error: unknown) {logger.warn('[validation Specialty s] validation failed', error);
    return { valid: false, error: extractErrorMessage(error) };
  }
}

async function validateNanoBananaProvider({
  apiKey,
  providerSpecificData = {},
}: SpecialtyProviderInput): Promise<ValidationResult> {
  try {
    const response = await fetch(
      "https://api.nanobananaapi.ai/api/v1/nanobanana/generate",
      {
        method: "POST",
        headers: applyCustomUserAgent(
          {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          providerSpecificData,
        ),
        body: JSON.stringify({
          prompt: "test",
          model: "nanobanana-flash",
        }),
      },
    );
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }
    return { valid: true, error: null };
  } catch (error: unknown) {logger.warn('[validation Specialty s] validation failed', error);
    return { valid: false, error: extractErrorMessage(error) };
  }
}

async function validateElevenLabsProvider({
  apiKey,
  providerSpecificData = {},
}: SpecialtyProviderInput): Promise<ValidationResult> {
  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: applyCustomUserAgent(
        {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        providerSpecificData,
      ),
    });

    if (response.ok) return { valid: true, error: null };
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }

    return { valid: false, error: `Validation failed: ${response.status}` };
  } catch (error: unknown) {logger.warn('[validation Specialty s] validation failed', error);
    return { valid: false, error: extractErrorMessage(error) };
  }
}

async function validateInworldProvider({
  apiKey,
  providerSpecificData = {},
}: SpecialtyProviderInput): Promise<ValidationResult> {
  try {
    const response = await fetch("https://api.inworld.ai/tts/v1/voice", {
      method: "POST",
      headers: applyCustomUserAgent(
        {
          Authorization: `Basic ${apiKey}`,
          "Content-Type": "application/json",
        },
        providerSpecificData,
      ),
      body: JSON.stringify({
        text: "test",
        modelId: "inworld-tts-1.5-mini",
        audioConfig: { audioEncoding: "MP3" },
      }),
    });

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }

    return { valid: true, error: null };
  } catch (error: unknown) {logger.warn('[validation Specialty s] validation failed', error);
    return { valid: false, error: extractErrorMessage(error) };
  }
}

async function validateBailianCodingPlanProvider({
  apiKey,
  providerSpecificData = {},
}: SpecialtyProviderInput): Promise<ValidationResult> {
  try {
    const rawBaseUrl =
      normalizeBaseUrl(providerSpecificData.baseUrl as string) ||
      "https://coding-intl.dashscope.aliyuncs.com/apps/anthropic/v1";
    const baseUrl = rawBaseUrl.endsWith("/messages")
      ? rawBaseUrl.slice(0, -"/messages".length)
      : rawBaseUrl;
    const messagesUrl = `${baseUrl}/messages`;

    await assertProviderValidationTargetAllowed(messagesUrl);
    const response = await fetch(messagesUrl, {
      method: "POST",
      headers: applyCustomUserAgent(
        {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        providerSpecificData,
      ),
      body: JSON.stringify({
        model: "qwen3-coder-plus",
        max_tokens: 1,
        messages: [{ role: "user", content: "test" }],
      }),
    });

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }

    if (response.status >= 400 && response.status < 500) {
      return { valid: true, error: null };
    }

    if (response.ok) {
      return { valid: true, error: null };
    }

    return { valid: false, error: `Validation failed: ${response.status}` };
  } catch (error: unknown) {logger.warn('[validation Specialty s] validation failed', error);
    return { valid: false, error: extractErrorMessage(error) };
  }
}

async function validateLongCatProvider({
  apiKey,
  providerSpecificData = {},
}: SpecialtyProviderInput): Promise<ValidationResult> {
  try {
    const res = await fetch(
      "https://api.longcat.chat/openai/v1/chat/completions",
      {
        method: "POST",
        headers: buildBearerHeaders(apiKey, providerSpecificData),
        body: JSON.stringify({
          model: "longcat",
          messages: [{ role: "user", content: "test" }],
          max_tokens: 1,
        }),
      },
    );
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }
    return { valid: true, error: null };
  } catch (error: unknown) {logger.warn('[validation Specialty s] validation failed', error);
    return { valid: false, error: extractErrorMessage(error) || "Connection failed" };
  }
}

async function validateSearchProvider(
  url: string,
  init: RequestInit,
  providerSpecificData: Record<string, unknown> = {},
): Promise<SearchValidationResult | SearchValidationSuccess> {
  try {
    await assertProviderValidationTargetAllowed(url);
    const response = await fetch(
      url,
      withCustomUserAgent(init, providerSpecificData),
    );
    if (response.ok)
      return { valid: true, error: null, unsupported: false };
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key", unsupported: false };
    }
    if (response.status < 500) {
      return { valid: true, error: null, unsupported: false };
    }
    return {
      valid: false,
      error: `Validation failed: ${response.status}`,
      unsupported: false,
    };
  } catch (error: unknown) {logger.warn('[validation Specialty s] validation failed', error);
    return {
      valid: false,
      error: extractErrorMessage(error),
      unsupported: false,
    };
  }
}

const SEARCH_VALIDATOR_CONFIGS: Record<
  string,
  (apiKey: string) => { url: string; init: RequestInit }
> = {
  "serper-search": (apiKey) => ({
    url: "https://google.serper.dev/search",
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ q: "test", num: 1 }),
    },
  }),
  "brave-search": (apiKey) => ({
    url: "https://api.search.brave.com/res/v1/web/search?q=test&count=1",
    init: {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    },
  }),
  "perplexity-search": (apiKey) => ({
    url: "https://api.perplexity.ai/search",
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: "test", max_results: 1 }),
    },
  }),
  "exa-search": (apiKey) => ({
    url: "https://api.exa.ai/search",
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ query: "test", numResults: 1 }),
    },
  }),
  "tavily-search": (apiKey) => ({
    url: "https://api.tavily.com/search",
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: "test", max_results: 1 }),
    },
  }),
};

const SPECIALTY_VALIDATORS: Record<
  string,
  (input: SpecialtyProviderInput) => Promise<ValidationResult | SearchValidationResult | SearchValidationSuccess | null>
> = {
  qoder: ({ apiKey, providerSpecificData }: SpecialtyProviderInput) =>
    validateQoderCliPat({ apiKey, providerSpecificData }),
  deepgram: validateDeepgramProvider,
  assemblyai: validateAssemblyAIProvider,
  nanobanana: validateNanoBananaProvider,
  elevenlabs: validateElevenLabsProvider,
  inworld: validateInworldProvider,
  "bailian-coding-plan": validateBailianCodingPlanProvider,
  longcat: validateLongCatProvider,
  ...Object.fromEntries(
    Object.entries(SEARCH_VALIDATOR_CONFIGS).map(([id, configFn]) => [
      id,
      ({ apiKey, providerSpecificData }: SpecialtyProviderInput) => {
        const { url, init } = configFn(apiKey);
        return validateSearchProvider(url, init, providerSpecificData);
      },
    ]),
  ),
};

export async function validateSpecialtyProvider({
  provider,
  apiKey,
  providerSpecificData = {},
}: SpecialtyProviderFullInput): Promise<ValidationResult | SearchValidationResult | SearchValidationSuccess | null> {
  const validator = SPECIALTY_VALIDATORS[provider];
  if (!validator) {
    return null;
  }

  try {
    return await validator({ apiKey, providerSpecificData });
  } catch (error: unknown) {logger.warn('[validation Specialty s] validation failed', error);
    return {
      valid: false,
      error: extractErrorMessage(error),
      unsupported: false,
    };
  }
}
