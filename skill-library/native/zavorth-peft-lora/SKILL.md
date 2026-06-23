---
name: PEFT LoRA
description: PEFT/LoRA adapter training, merge, and export
license: Zavorth-Internal
---

# PEFT LoRA

Use this native skill when:
- The task requires operations in the 'ml' domain.
- Performing actions matching: PEFT/LoRA adapter training, merge, export.

## Operating Rules

- Configure LoRA target modules (q_proj, v_proj, etc.) based on the target model architecture.
- Set rank, alpha, and dropout parameters appropriate for the dataset size and task complexity.
- Use PEFT's get_peft_model utility to wrap base models with adapter layers correctly.
- Support adapter merging into base model weights for standalone deployment.
- Export adapters in HuggingFace PEFT format for cross-platform compatibility.

## Output

- LoRA adapter weights, merged model artifacts, and training configuration files.
