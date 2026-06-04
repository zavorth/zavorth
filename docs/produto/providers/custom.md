---
title: "Custom endpoints"
description: "Connect Zavorth to any AI endpoint that follows the OpenAI API format."
---

If your AI provider is not in Zavorth's built-in list, you can connect it as a custom OpenAI-compatible endpoint. Any server that follows the OpenAI API format works — hosted or self-hosted.

## What this covers

- **Groq** — fast inference (Llama, Mixtral)
- **Mistral** — Mistral and Codestral
- **Together AI** — open models at scale
- **Fireworks AI** — fast open model inference
- **Cerebras** — ultra-fast inference
- **SambaNova** — enterprise deployment
- **Moonshot AI** — Chinese language models
- **NVIDIA NIM** — enterprise GPU inference
- **Vercel AI Gateway** — unified proxy
- **HuggingFace Inference Endpoints** — any HuggingFace model
- **Your own proxy or gateway**

## Setup

```env
LLM_PROVIDER=custom-openai-compatible
CUSTOM_OPENAI_COMPATIBLE_BASE_URL=https://api.groq.com/openai
CUSTOM_OPENAI_COMPATIBLE_API_KEY=your_key_here
CUSTOM_OPENAI_COMPATIBLE_MODEL=llama-3.3-70b-versatile
```

Or add via the wizard:

```bash
zavorth providers add
```

Select **Custom (OpenAI-compatible)** and enter the base URL, API key, and model name.

## Common endpoint configurations

<Accordion title="Groq">
```env
CUSTOM_OPENAI_COMPATIBLE_BASE_URL=https://api.groq.com/openai
CUSTOM_OPENAI_COMPATIBLE_API_KEY=gsk_your_key
CUSTOM_OPENAI_COMPATIBLE_MODEL=llama-3.3-70b-versatile
```
Get a key at [console.groq.com](https://console.groq.com).
</Accordion>

<Accordion title="Mistral">
```env
CUSTOM_OPENAI_COMPATIBLE_BASE_URL=https://api.mistral.ai/v1
CUSTOM_OPENAI_COMPATIBLE_API_KEY=your_key
CUSTOM_OPENAI_COMPATIBLE_MODEL=mistral-large-latest
```
Get a key at [console.mistral.ai](https://console.mistral.ai).
</Accordion>

<Accordion title="Together AI">
```env
CUSTOM_OPENAI_COMPATIBLE_BASE_URL=https://api.together.xyz/v1
CUSTOM_OPENAI_COMPATIBLE_API_KEY=your_key
CUSTOM_OPENAI_COMPATIBLE_MODEL=meta-llama/Llama-3.3-70B-Instruct-Turbo
```
Get a key at [api.together.ai](https://api.together.ai).
</Accordion>

<Accordion title="xAI (Grok)">
```env
CUSTOM_OPENAI_COMPATIBLE_BASE_URL=https://api.x.ai/v1
CUSTOM_OPENAI_COMPATIBLE_API_KEY=your_key
CUSTOM_OPENAI_COMPATIBLE_MODEL=grok-3-latest
```
Get a key at [console.x.ai](https://console.x.ai).
</Accordion>

<Accordion title="GitHub Models (free tier)">
```env
CUSTOM_OPENAI_COMPATIBLE_BASE_URL=https://models.inference.ai.azure.com
CUSTOM_OPENAI_COMPATIBLE_API_KEY=your_github_token
CUSTOM_OPENAI_COMPATIBLE_MODEL=gpt-4o
```
Uses a GitHub personal access token. Free tier available.
</Accordion>

<Accordion title="OpenRouter (200+ models)">
```env
CUSTOM_OPENAI_COMPATIBLE_BASE_URL=https://openrouter.ai/api/v1
CUSTOM_OPENAI_COMPATIBLE_API_KEY=sk-or-your-key
CUSTOM_OPENAI_COMPATIBLE_MODEL=anthropic/claude-sonnet-4-5
```
Access 200+ models from one key at [openrouter.ai](https://openrouter.ai).
</Accordion>

## Verify the connection

```bash
zavorth providers test custom-openai-compatible
zavorth providers test custom-openai-compatible --live
```

## Multiple custom endpoints

To define more than one custom endpoint, use named provider slots:

```env
CUSTOM_OPENAI_COMPATIBLE_SLOT2_BASE_URL=https://api.groq.com/openai
CUSTOM_OPENAI_COMPATIBLE_SLOT2_API_KEY=your_groq_key
CUSTOM_OPENAI_COMPATIBLE_SLOT2_MODEL=llama-3.3-70b-versatile
```

Switch between them:

```bash
zavorth providers switch --provider custom-openai-compatible-slot2
```

## Related

- [All providers](/docs/produto/providers)
- [Local models](/docs/produto/providers/local)
- [Gemini](/docs/produto/providers/gemini)
