---
name: Axolotl Trainer
description: Axolotl fine-tuning framework and training configs
license: Zavorth-Internal
---

# Axolotl Trainer

Use this native skill when:
- The task requires operations in the 'ml' domain.
- Performing actions matching: Axolotl fine-tuning framework, dataset prep, training configs.

## Operating Rules

- Prepare datasets in the correct format (Alpaca, ShareGPT, completion) expected by Axolotl.
- Configure YAML training configs with proper model, tokenizer, and hyperparameter settings.
- Validate LoRA/QLoRA parameters (rank, alpha, target modules) before initiating training.
- Monitor training loss and evaluation metrics through logging callbacks during runs.
- Handle checkpoint saving and resumption correctly for interrupted training sessions.

## Output

- Training configurations, fine-tuned adapters, and training progress reports.
