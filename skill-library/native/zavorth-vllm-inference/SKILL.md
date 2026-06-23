---
name: vLLM Inference
description: vLLM inference server management and model serving
license: Zavorth-Internal
---

# vLLM Inference

Use this native skill when:
- The task requires operations in the 'ml' domain.
- Performing actions matching: vLLM inference server management, model loading, serving.

## Operating Rules

- Configure vLLM engine parameters (tensor parallelism, quantization, max model length) before starting the server.
- Monitor GPU memory usage and KV cache allocation during serving to prevent OOM errors.
- Use OpenAI-compatible API endpoints for client integration with vLLM servers.
- Validate model checkpoint paths and tokenizer configs before loading into the engine.
- Apply appropriate sampling parameters (temperature, top_p, top_k) based on use case requirements.

## Output

- vLLM server configurations, deployment scripts, and performance benchmarks.
