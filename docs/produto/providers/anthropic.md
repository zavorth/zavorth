---
title: "Anthropic (Claude)"
description: "Use Claude with Zavorth — Anthropic directly, via AWS Bedrock, or via Google Vertex AI."
---

Zavorth supports Claude through three connection paths: Anthropic directly (API key), AWS Bedrock, or Google Cloud Vertex AI.

## Anthropic directly

The simplest way — just an API key.

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account and go to **API Keys**
3. Create a key and copy it

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here
ANTHROPIC_MODEL=claude-sonnet-4-5
```

## Available models

| Model | Best for |
|---|---|
| `claude-opus-4-5` | Most capable — complex tasks, long reasoning |
| `claude-sonnet-4-5` | Balanced — recommended for daily use |
| `claude-haiku-3-5` | Fast, lightweight — quick tasks |

Switch without restarting:

```bash
zavorth providers switch --provider anthropic --model claude-opus-4-5
```

## AWS Bedrock

Use Claude through your AWS account — useful if you already have AWS infrastructure or need enterprise compliance.

```env
LLM_PROVIDER=bedrock-claude
BEDROCK_CLAUDE_MODEL=anthropic.claude-sonnet-4-5-20250929-v1:0
AWS_REGION=us-east-1
```

Authentication uses your AWS credentials. Set up with:

```bash
aws configure
# or
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
```

## Google Cloud Vertex AI

Use Claude through Google Cloud:

```env
LLM_PROVIDER=anthropic-vertex
ANTHROPIC_VERTEX_MODEL=claude-sonnet-4-5@20251007
ANTHROPIC_VERTEX_PROJECT_ID=your-gcp-project
ANTHROPIC_VERTEX_REGION=us-east5
```

Requires Vertex AI to be enabled in your project and Application Default Credentials:

```bash
gcloud auth application-default login
```

## Check status

```bash
zavorth providers test anthropic
zavorth providers test anthropic --live
```

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes (direct) | Your Anthropic API key |
| `ANTHROPIC_MODEL` | No | Default: `claude-sonnet-4-5` |
| `AWS_REGION` | Yes (Bedrock) | AWS region with Bedrock access |
| `ANTHROPIC_VERTEX_PROJECT_ID` | Yes (Vertex) | GCP project ID |
| `ANTHROPIC_VERTEX_REGION` | No | Default: `us-east5` |

## Related

- [All providers](/docs/produto/providers)
- [Gemini](/docs/produto/providers/gemini)
- [Local models](/docs/produto/providers/local)
