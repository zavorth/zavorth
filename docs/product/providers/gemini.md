---
title: "Gemini"
description: "Use Google Gemini with Zavorth — the recommended default provider."
---

Google Gemini is the recommended default provider for Zavorth. It is fast, capable, and has a generous free tier through Google AI Studio.

## Get an API key

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with your Google account
3. Click **Get API key** → **Create API key**
4. Copy the key

<Tip>
AI Studio has a free tier that covers most personal use. You only need to add billing if you exceed the free limits.
</Tip>

## Setup

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Or run the wizard:

```bash
zavorth providers add
```

Select **Gemini** and enter your API key when prompted. The wizard stores the key securely and never prints it.

## Available models

| Model | Best for | Speed |
|---|---|---|
| `gemini-2.5-flash` | Daily use, fast responses | ⚡ Fast |
| `gemini-2.5-pro` | Complex reasoning, long context | 🔍 Slower |
| `gemini-2.0-flash` | Previous generation, stable | ⚡ Fast |
| `gemini-1.5-pro` | Long documents, 1M token context | 🔍 Slower |

Switch models without restarting:

```bash
zavorth providers switch --provider gemini --model gemini-2.5-pro
```

## Using Gemini via Google Cloud (Vertex AI)

If you have a Google Cloud account with Vertex AI enabled:

```env
LLM_PROVIDER=gemini-vertex
GEMINI_VERTEX_PROJECT_ID=your-gcp-project-id
GEMINI_VERTEX_LOCATION=us-central1
GEMINI_VERTEX_MODEL=gemini-2.5-flash
```

This uses Application Default Credentials (run `gcloud auth application-default login` first).

## Check status

```bash
zavorth providers test gemini          # check configuration
zavorth providers test gemini --live   # ping the API (uses a token)
```

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes (AI Studio) | Your Google AI Studio API key |
| `GEMINI_MODEL` | No | Default: `gemini-2.5-flash` |
| `GEMINI_VERTEX_PROJECT_ID` | Yes (Vertex) | GCP project ID |
| `GEMINI_VERTEX_LOCATION` | No | Default: `us-central1` |

## Related

- [All providers](/docs/product/providers)
- [Switching providers](/docs/product/providers#switching-providers)
