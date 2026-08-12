export interface OllamaModelDescriptor {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export const ollamaModels: OllamaModelDescriptor[] = [
  {
    name: "llama3.2:latest",
    model: "llama3.2:latest",
    modified_at: new Date().toISOString(),
    size: 2019393189,
    digest: "sha256:888229afbe3c5a5d1b3d8e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4",
    details: {
      parent_model: "",
      format: "gguf",
      family: "llama",
      families: ["llama"],
      parameter_size: "3.2B",
      quantization_level: "Q4_K_M",
    },
  },
  {
    name: "llama3.1:8b",
    model: "llama3.1:8b",
    modified_at: new Date().toISOString(),
    size: 4669619448,
    digest: "sha256:3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5",
    details: {
      parent_model: "",
      format: "gguf",
      family: "llama",
      families: ["llama"],
      parameter_size: "8.0B",
      quantization_level: "Q4_K_M",
    },
  },
  {
    name: "qwen2.5:7b",
    model: "qwen2.5:7b",
    modified_at: new Date().toISOString(),
    size: 4681324958,
    digest: "sha256:5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6",
    details: {
      parent_model: "",
      format: "gguf",
      family: "qwen2",
      families: ["qwen2"],
      parameter_size: "7.6B",
      quantization_level: "Q4_K_M",
    },
  },
  {
    name: "gemma2:9b",
    model: "gemma2:9b",
    modified_at: new Date().toISOString(),
    size: 5443816868,
    digest: "sha256:7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8",
    details: {
      parent_model: "",
      format: "gguf",
      family: "gemma2",
      families: ["gemma2"],
      parameter_size: "9.4B",
      quantization_level: "Q4_K_M",
    },
  },
];
