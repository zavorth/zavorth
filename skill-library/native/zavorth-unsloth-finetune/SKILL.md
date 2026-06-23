---
name: Unsloth Finetune
description: Unsloth fast LLM fine-tuning with LoRA/QLoRA
license: Zavorth-Internal
---

# Unsloth Finetune

Use this native skill when:
- The task requires operations in the 'ml' domain.
- Performing actions matching: Unsloth fast fine-tuning for LLMs, LoRA, QLoRA.

## Operating Rules

- Leverage Unsloth's patched models for 2x faster training with reduced memory usage.
- Configure 4-bit quantization (QLoRA) for memory-efficient fine-tuning on consumer GPUs.
- Set appropriate LoRA rank and alpha values balancing model quality and training speed.
- Use Unsloth's built-in chat templates for instruction-tuned model formats.
- Export trained adapters to GGUF, merged, or HuggingFace format as needed.

## Output

- Fine-tuned model adapters, merged models, and training statistics.
