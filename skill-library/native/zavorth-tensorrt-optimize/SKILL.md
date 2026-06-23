---
name: TensorRT Optimize
description: TensorRT model optimization and inference acceleration
license: Zavorth-Internal
---

# TensorRT Optimize

Use this native skill when:
- The task requires operations in the 'ml' domain.
- Performing actions matching: TensorRT model optimization, quantization, inference acceleration.

## Operating Rules

- Convert models to TensorRT engine format using ONNX as intermediate representation.
- Apply INT8/FP16 quantization with calibration datasets for optimal throughput.
- Configure dynamic batch sizes and sequence lengths for production workloads.
- Profile engine performance with trtexec to identify bottlenecks and optimal configurations.
- Validate numerical accuracy between original and TensorRT-optimized model outputs.

## Output

- TensorRT engine files, optimization profiles, and benchmark comparisons.
