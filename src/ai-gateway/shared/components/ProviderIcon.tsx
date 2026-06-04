"use client";

/**
 * ProviderIcon renders provider logos from Zavorth-owned static assets.
 *
 * Strategy:
 * 1. Try /providers/{id}.png
 * 2. Fall back to /providers/{id}.svg
 * 3. Fall back to a generic AI icon
 */

import { memo, useState } from "react";
import Image from "next/image";

interface ProviderIconProps {
  providerId: string;
  size?: number;
  type?: "mono" | "color";
  className?: string;
  style?: React.CSSProperties;
}

const PROVIDER_ASSET_ALIASES: Record<string, string> = {
  "aws-bedrock": "bedrock",
  "azure-openai": "azure",
  blackboxai: "blackbox",
  "cloudflare-ai": "cloudflare-ai",
  "fireworks-ai": "fireworks",
  "github-copilot": "copilot",
  "hugging-face": "huggingface",
  mistralai: "mistral",
  "open-router": "openrouter",
  "stability-ai": "stability",
  togetherai: "together",
};

const KNOWN_PNGS = new Set([
  "aimlapi",
  "alibaba",
  "alicode-intl",
  "alicode",
  "anthropic-m",
  "anthropic",
  "zavorthBridge",
  "bailian-coding-plan",
  "blackbox",
  "brave-search",
  "brave",
  "cerebras",
  "claude",
  "cline",
  "codex",
  "cohere",
  "continue",
  "copilot",
  "cursor",
  "deepgram",
  "deepseek",
  "droid",
  "exa-search",
  "fireworks",
  "gemini-cli",
  "gemini",
  "github",
  "glm",
  "groq",
  "iflow",
  "ironclaw",
  "kilo-gateway",
  "kilocode",
  "kimi-coding-apikey",
  "kimi-coding",
  "kimi",
  "kiro",
  "longcat",
  "minimax-cn",
  "minimax",
  "mistral",
  "nanobot",
  "nebius",
  "nvidia",
  "oai-cc",
  "oai-r",
  "ollama-cloud",
  "openai",
  "openrouter",
  "perplexity-search",
  "perplexity",
  "pollinations",
  "qwen",
  "roo",
  "serper-search",
  "serper",
  "siliconflow",
  "tavily-search",
  "tavily",
  "together",
  "xai",
  "zeroclaw",
]);

const KNOWN_SVGS = new Set([
  "apikey",
  "assemblyai",
  "brave",
  "cartesia",
  "cloudflare-ai",
  "comfyui",
  "elevenlabs",
  "exa-search",
  "exa",
  "huggingface",
  "hyperbolic",
  "inworld",
  "nanobanana",
  "oauth",
  "opencode-go",
  "opencode-zen",
  "opencode",
  "playht",
  "puter",
  "scaleway",
  "sdwebui",
  "synthetic",
  "vertex",
  "windsurf",
  "zai",
]);

function GenericProviderIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flex: "none" }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function normalizeProviderAssetId(providerId: string): string {
  const normalized = providerId.toLowerCase();
  return PROVIDER_ASSET_ALIASES[normalized] || normalized;
}

const ProviderIcon = memo(function ProviderIcon({
  providerId,
  size = 24,
  className,
  style,
}: ProviderIconProps) {
  const assetId = normalizeProviderAssetId(providerId);
  const hasPng = KNOWN_PNGS.has(assetId);
  const hasSvg = KNOWN_SVGS.has(assetId);

  const [usePng, setUsePng] = useState(hasPng);
  const [useSvg, setUseSvg] = useState(!hasPng && hasSvg);

  if (usePng) {
    return (
      <span className={className} style={{ display: "inline-flex", alignItems: "center", ...style }}>
        <Image
          src={`/providers/${assetId}.png`}
          alt={providerId}
          width={size}
          height={size}
          style={{ objectFit: "contain" }}
          onError={() => {
            setUsePng(false);
            setUseSvg(hasSvg);
          }}
          unoptimized
        />
      </span>
    );
  }

  if (useSvg) {
    return (
      <span className={className} style={{ display: "inline-flex", alignItems: "center", ...style }}>
        <Image
          src={`/providers/${assetId}.svg`}
          alt={providerId}
          width={size}
          height={size}
          style={{ objectFit: "contain" }}
          onError={() => setUseSvg(false)}
          unoptimized
        />
      </span>
    );
  }

  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", ...style }}>
      <GenericProviderIcon size={size} />
    </span>
  );
});

export default ProviderIcon;
export type { ProviderIconProps };
