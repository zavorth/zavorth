"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ALIAS_TO_ID } from "@/shared/constants/providers";
import { pickMaskedDisplayValue } from "@/shared/utils/maskEmail";
import {
  buildChatBodyWithImages,
  DEFAULT_BODIES,
  ENDPOINT_PATHS,
  fileToBase64,
  isVisionModel,
} from "./playgroundConfig";
import type { ConnectionOption, ModelInfo, ProviderOption } from "./playgroundTypes";

export function usePlaygroundPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [allConnections, setAllConnections] = useState<ConnectionOption[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedConnection, setSelectedConnection] = useState("");
  const [selectedEndpoint, setSelectedEndpoint] = useState("chat");
  const [requestBody, setRequestBody] = useState("");
  const [responseBody, setResponseBody] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [imageData, setImageData] = useState<any>(null);
  const [transcriptionText, setTranscriptionText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseDuration, setResponseDuration] = useState<number | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  const isSearchEndpoint = selectedEndpoint === "search";
  const isTranscriptionEndpoint = selectedEndpoint === "transcription";
  const isChatEndpoint = selectedEndpoint === "chat";
  const isImageEndpoint = selectedEndpoint === "images";
  const supportsVision = isChatEndpoint && isVisionModel(selectedModel);

  const providerConnections = allConnections.filter((connection) => {
    if (!selectedProvider) return false;
    const resolvedProvider = ALIAS_TO_ID[selectedProvider] || selectedProvider;
    return connection.provider === resolvedProvider || connection.provider === selectedProvider;
  });

  const filteredModels = models
    .filter((model) => !selectedProvider || model.id.startsWith(`${selectedProvider}/`))
    .map((model) => ({ value: model.id, label: model.id }));

  useEffect(() => {
    fetch("/v1/models")
      .then((res) => res.json())
      .then((data) => {
        const modelList = (data?.data || []) as ModelInfo[];
        setModels(modelList);

        const providerSet = new Set<string>();
        modelList.forEach((model) => {
          const parts = model.id.split("/");
          if (parts.length >= 2) providerSet.add(parts[0]);
        });

        const providerOptions = Array.from(providerSet)
          .sort()
          .map((provider) => ({ value: provider, label: provider }));
        setProviders(providerOptions);
        if (providerOptions.length > 0) {
          setSelectedProvider(providerOptions[0].value);
        }
      })
      .catch(() => {});

    fetch("/api/providers/client")
      .then((res) => res.json())
      .then((data) => {
        const connections: ConnectionOption[] = [];
        for (const connection of data?.connections || []) {
          connections.push({
            id: connection.id,
            name: pickMaskedDisplayValue([connection.name, connection.email], connection.id),
            provider: connection.provider,
            authType: connection.authType || "apiKey",
          });
        }
        setAllConnections(connections);
      })
      .catch(() => {});
  }, []);

  const clearResults = () => {
    setResponseBody("");
    setResponseStatus(null);
    setResponseDuration(null);
    setAudioUrl(null);
    setImageData(null);
    setTranscriptionText(null);
  };

  const generateDefaultBody = (endpoint: string, model: string) => {
    const template = { ...DEFAULT_BODIES[endpoint] };
    if ("model" in template) {
      (template as any).model = model;
    }
    return JSON.stringify(template, null, 2);
  };

  const handleProviderChange = (newProvider: string) => {
    setSelectedProvider(newProvider);
    setSelectedConnection("");
    const providerModels = models
      .filter((model) => !newProvider || model.id.startsWith(`${newProvider}/`))
      .map((model) => model.id);
    const firstModel = providerModels[0] || "";
    setSelectedModel(firstModel);
    setRequestBody(generateDefaultBody(selectedEndpoint, firstModel));
    clearResults();
  };

  const handleModelChange = (newModel: string) => {
    setSelectedModel(newModel);
    setRequestBody(generateDefaultBody(selectedEndpoint, newModel));
    clearResults();
  };

  const handleEndpointChange = (newEndpoint: string) => {
    setSelectedEndpoint(newEndpoint);
    setRequestBody(generateDefaultBody(newEndpoint, selectedModel));
    setUploadedFile(null);
    setUploadedImages([]);
    clearResults();
  };

  const handleAudioFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setUploadedFile(file);
  };

  const handleImageFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const base64s = await Promise.all(files.map(fileToBase64));
    setUploadedImages((prev) => [...prev, ...base64s].slice(0, 4));
  };

  const removeUploadedImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const clearUploadedImages = () => {
    setUploadedImages([]);
  };

  const resetRequestBody = () => {
    const template = { ...DEFAULT_BODIES[selectedEndpoint] };
    if ("model" in template) {
      (template as any).model = selectedModel;
    }
    setRequestBody(JSON.stringify(template, null, 2));
  };

  const handleSend = async () => {
    if (!requestBody.trim() && !isTranscriptionEndpoint) return;
    setLoading(true);
    clearResults();

    const controller = new AbortController();
    abortRef.current = controller;
    const startTime = Date.now();

    try {
      const path = ENDPOINT_PATHS[selectedEndpoint];
      let res: Response;

      if (isTranscriptionEndpoint) {
        const form = new FormData();
        if (uploadedFile) {
          form.append("file", uploadedFile);
        }
        try {
          const extra = JSON.parse(requestBody || "{}");
          for (const [key, value] of Object.entries(extra)) {
            if (key !== "file") form.append(key, String(value));
          }
        } catch {
          // Ignore parse errors and send the uploaded file only.
        }
        const fetchHeaders: Record<string, string> = {};
        if (selectedConnection) {
          fetchHeaders["X-ZavorthGateway-Connection"] = selectedConnection;
        }
        res = await fetch(`/api${path}`, {
          method: "POST",
          headers: fetchHeaders,
          body: form,
          signal: controller.signal,
        });
      } else {
        let parsed = JSON.parse(requestBody);
        if (supportsVision && uploadedImages.length > 0) {
          parsed = buildChatBodyWithImages(parsed, uploadedImages);
        }
        const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (selectedConnection) {
          fetchHeaders["X-ZavorthGateway-Connection"] = selectedConnection;
        }
        res = await fetch(`/api${path}`, {
          method: "POST",
          headers: fetchHeaders,
          body: JSON.stringify(parsed),
          signal: controller.signal,
        });
      }

      setResponseStatus(res.status);
      setResponseDuration(Date.now() - startTime);

      const contentType = res.headers.get("content-type") || "";
      if (contentType.startsWith("audio/")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setResponseBody(`// Audio response (${contentType})\n// Click play below to listen.`);
      } else if (contentType.includes("text/event-stream")) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            accumulated += decoder.decode(value, { stream: true });
            setResponseBody(accumulated);
          }
        }
      } else {
        const data = await res.json();
        setResponseBody(JSON.stringify(data, null, 2));
        if (isImageEndpoint && data?.data && Array.isArray(data.data) && res.ok) {
          setImageData(data);
        }
        if (isTranscriptionEndpoint && typeof data?.text === "string") {
          setTranscriptionText(data.text || "(empty result - check provider credentials)");
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setResponseBody(JSON.stringify({ cancelled: true }, null, 2));
      } else {
        setResponseBody(JSON.stringify({ error: err.message }, null, 2));
      }
      setResponseDuration(Date.now() - startTime);
    }

    setLoading(false);
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore clipboard failures in unsupported environments.
    }
  };

  return {
    audioUrl,
    filteredModels,
    handleAudioFileChange,
    handleCancel,
    handleCopy,
    handleEndpointChange,
    handleImageFileChange,
    handleModelChange,
    handleProviderChange,
    handleSend,
    imageData,
    isSearchEndpoint,
    isTranscriptionEndpoint,
    loading,
    providerConnections,
    providers,
    removeUploadedImage,
    requestBody,
    resetRequestBody,
    responseBody,
    responseDuration,
    responseStatus,
    selectedConnection,
    selectedEndpoint,
    selectedModel,
    selectedProvider,
    setRequestBody,
    setSelectedConnection,
    supportsVision,
    transcriptionText,
    uploadedFile,
    uploadedImages,
    clearUploadedImages,
  };
}
