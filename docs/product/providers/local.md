---
title: "Local models"
description: "Run AI models locally on your own machine — no API key, no data leaving your computer."
---

Zavorth works with models running on your own machine. No API key, no usage costs, no data leaving your computer.

## Ollama

[Ollama](https://ollama.ai) is the easiest way to run local models. It manages model downloads and provides an OpenAI-compatible API.

<Steps>
  <Step title="Install Ollama">
    Download from [ollama.ai](https://ollama.ai) — available for macOS, Linux, and Windows.

    Verify:
    ```bash
    ollama --version
    ```
  </Step>

  <Step title="Pull a model">
    ```bash
    ollama pull gemma2:2b         # fast, lightweight
    ollama pull llama3.2          # general purpose
    ollama pull qwen2.5-coder:7b  # code-focused
    ollama pull deepseek-r1:7b    # reasoning
    ```

    List installed models:
    ```bash
    ollama list
    ```
  </Step>

  <Step title="Configure Zavorth">
    ```env
    LLM_PROVIDER=ollama
    OLLAMA_BASE_URL=http://localhost:11434/v1
    OLLAMA_MODEL=gemma2:2b
    ```

    Or run the wizard:
    ```bash
    zavorth providers add
    ```
  </Step>

  <Step title="Verify">
    ```bash
    zavorth providers test ollama
    ```
  </Step>
</Steps>

## Recommended models for Zavorth

| Model | Size | Best for |
|---|---|---|
| `gemma2:2b` | 1.6 GB | Lightweight daily use, fast on CPU |
| `gemma3:4b` | 3.3 GB | Good balance of speed and quality |
| `llama3.2:3b` | 2.0 GB | General use, good reasoning |
| `qwen2.5-coder:7b` | 4.7 GB | Code generation and review |
| `deepseek-r1:7b` | 4.7 GB | Reasoning tasks |
| `phi4:14b` | 8.5 GB | High quality, needs more RAM |

<Tip>
For best performance on CPU: use models ≤ 4B parameters. For GPU: models up to 13B run well on 8GB VRAM.
</Tip>

## LM Studio

[LM Studio](https://lmstudio.ai) provides a UI for downloading and running models, with an OpenAI-compatible local server.

<Steps>
  <Step title="Install and download a model">
    Download from [lmstudio.ai](https://lmstudio.ai), search for a model in the Discover tab, and download it.
  </Step>

  <Step title="Start the local server">
    In LM Studio: **Local Server** tab → load your model → **Start Server**.

    Default port: `1234`.
  </Step>

  <Step title="Configure Zavorth">
    ```env
    LLM_PROVIDER=lm-studio
    LM_STUDIO_BASE_URL=http://localhost:1234/v1
    LM_STUDIO_MODEL=loaded-model-name
    ```
  </Step>
</Steps>

## vLLM (advanced)

vLLM is for running larger models with GPU acceleration on Linux. Best for self-hosted setups.

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-8B-Instruct --port 8000
```

```env
LLM_PROVIDER=vllm
VLLM_BASE_URL=http://localhost:8000/v1
VLLM_MODEL=meta-llama/Llama-3.1-8B-Instruct
```

## Switching between local and cloud

Switch anytime, no restart needed:

```bash
# Switch to local
zavorth providers switch --provider ollama --model gemma2:2b

# Switch back to cloud
zavorth providers switch --provider gemini --model gemini-2.5-flash
```

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | No | Default: `http://localhost:11434/v1` |
| `OLLAMA_MODEL` | Yes (Ollama) | Model name as shown in `ollama list` |
| `LM_STUDIO_BASE_URL` | No | Default: `http://localhost:1234/v1` |
| `LM_STUDIO_MODEL` | Yes (LM Studio) | Model identifier |
| `VLLM_BASE_URL` | Yes (vLLM) | Your vLLM server URL |
| `VLLM_MODEL` | Yes (vLLM) | HuggingFace model ID |

## Related

- [All providers](/docs/product/providers)
- [Custom endpoints](/docs/product/providers/custom)
