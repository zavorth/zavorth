---
title: "Providers"
description: "Choose an AI model provider for Zavorth — Gemini, Claude, GPT-4o, DeepSeek, local models, or any OpenAI-compatible endpoint."
---

Zavorth works with any major AI provider, local models, or any custom endpoint. You pick the model — Zavorth handles the rest.

## Quick switch

```bash
zavorth providers switch
```

This opens a guided wizard to pick a provider and model. No restart needed.

## Built-in providers

These are natively supported — just add an API key:

| Provider | Models | Get a key |
|---|---|---|
| **Google Gemini** | Gemini 2.5 Flash, Pro, Ultra | [aistudio.google.com](https://aistudio.google.com) |
| **Anthropic (Claude)** | Claude Sonnet, Opus, Haiku | [console.anthropic.com](https://console.anthropic.com) |
| **OpenAI** | GPT-4o, GPT-4o mini, o1 | [platform.openai.com](https://platform.openai.com) |
| **DeepSeek** | DeepSeek Chat, Coder | [platform.deepseek.com](https://platform.deepseek.com) |
| **OpenRouter** | 200+ models from multiple providers | [openrouter.ai](https://openrouter.ai) |
| **MiniMax** | MiniMax M2.7 | [platform.minimaxi.com](https://platform.minimaxi.com) |
| **Qwen (Alibaba)** | Qwen 3.5+ | [dashscope.aliyuncs.com](https://dashscope.aliyuncs.com) |
| **Groq** | Llama, Mixtral (fast inference) | [console.groq.com](https://console.groq.com) |
| **Mistral** | Mistral, Codestral | [console.mistral.ai](https://console.mistral.ai) |
| **xAI (Grok)** | Grok 3, Grok Vision | [console.x.ai](https://console.x.ai) |
| **Perplexity** | Sonar models with web search | [perplexity.ai/api](https://perplexity.ai/api) |
| **GitHub Models** | GPT-4o, Phi, Llama (free tier) | [github.com/marketplace/models](https://github.com/marketplace/models) |

## Local models

Run a model on your own machine — no API key, no data leaving your computer:

| Provider | Models | Setup |
|---|---|---|
| **Ollama** | Gemma, Llama, Qwen, Phi, and more | [ollama.ai](https://ollama.ai) |
| **LM Studio** | Any GGUF model | [lmstudio.ai](https://lmstudio.ai) |
| **vLLM** | Any HuggingFace model | [github.com/vllm-project](https://github.com/vllm-project/vllm) |

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=gemma2:2b
```

## Any OpenAI-compatible endpoint

If your provider is not listed, you can use it as a custom endpoint:

```env
LLM_PROVIDER=custom-openai-compatible
CUSTOM_OPENAI_COMPATIBLE_BASE_URL=https://my-endpoint.com/v1
CUSTOM_OPENAI_COMPATIBLE_API_KEY=my_key
```

This works with any endpoint that follows the OpenAI API format — including self-hosted models, proxies, and enterprise AI platforms.

## Adding a provider

```bash
zavorth providers add
```

The wizard asks for the provider name, API key (stored securely, never printed), and optionally a base URL. It previews the configuration before writing anything.

## Switching providers

```bash
zavorth providers switch
```

Switches the default provider and model without restarting. The change takes effect on your next message.

Or switch directly:

```bash
zavorth providers switch --provider anthropic --model claude-sonnet-4-6
zavorth providers switch --provider gemini --model gemini-2.5-flash
zavorth providers switch --provider ollama --model llama3.2
```

## Checking provider status

```bash
zavorth providers           # list all providers and their readiness
zavorth providers test openai        # check if OpenAI is configured
zavorth providers test openai --live  # actually ping the API (uses a token)
```

Status values:
- **ready** — configured and usable
- **missing_auth** — API key not found
- **missing_base_url** — local or custom endpoint URL not set
- **degraded** — configured but not responding correctly

## Claude via AWS Bedrock or Google Vertex

Zavorth supports Claude through AWS and Google Cloud as well:

```env
# AWS Bedrock
LLM_PROVIDER=bedrock-claude
BEDROCK_CLAUDE_MODEL=anthropic.claude-sonnet-4-5-20250929-v1:0

# Google Vertex AI
LLM_PROVIDER=anthropic-vertex
ANTHROPIC_VERTEX_MODEL=claude-sonnet-4-6
```

These use your cloud credentials (AWS IAM or Google Application Default Credentials) — no separate API key required.

## Default provider setup

The simplest setup — just set these two variables:

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

## Related

- [Getting started](/docs/produto/start/getting-started)
- [Features](/docs/produto/conceitos/features)
- [Troubleshooting](/docs/produto/ajuda/troubleshooting)
