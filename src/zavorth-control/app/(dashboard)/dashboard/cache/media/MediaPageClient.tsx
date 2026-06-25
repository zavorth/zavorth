"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { ImageResults } from "./ImageResults";
import {
  LOCAL_PROVIDERS,
  MAX_TRANSCRIPTION_FILE_SIZE,
  MODALITY_CONFIG,
  PROVIDER_MODELS,
  SPEECH_FORMATS,
  type GenerationResult,
  type Modality,
  formatFileSize,
  getVoiceList,
  parseApiError,
} from "./mediaPageConfig";

export default function MediaPageClient() {
  const t = useTranslations("media");
  const initialProvider = PROVIDER_MODELS.image[0];
  const [activeTab, setActiveTab] = useState<Modality>("image");
  const [prompt, setPrompt] = useState("");

  // Selected provider and model per modality
  const [selectedProvider, setSelectedProvider] = useState<string>(initialProvider?.id ?? "");
  const [selectedModel, setSelectedModel] = useState<string>(
    initialProvider?.models[0]?.id ?? ""
  );

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCredentialsError, setIsCredentialsError] = useState(false);

  // Speech-specific
  const [speechVoice, setSpeechVoice] = useState("alloy");
  const [speechFormat, setSpeechFormat] = useState("mp3");

  // Transcription-specific
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);

  // Fix #390: hide local media providers when they have not been configured.
  const [configuredLocalProviders, setConfiguredLocalProviders] = useState<Set<string>>(
    new Set(LOCAL_PROVIDERS) // Optimistic: show all until we know otherwise
  );

  useEffect(() => {
    // Fetch configured provider connections to determine which local providers are set up.
    fetch("/api/providers")
      .then((r) => r.json())
      .then((data) => {
        const connections: { provider?: string; testStatus?: string }[] = Array.isArray(data)
          ? data
          : (data?.connections ?? data?.providers ?? []);
        const configured = new Set<string>();
        for (const conn of connections) {
          const pId = conn?.provider;
          if (pId && LOCAL_PROVIDERS.includes(pId)) {
            configured.add(pId);
          }
        }
        if (configured.size > 0) {
          setConfiguredLocalProviders(configured);
        } else {
          setConfiguredLocalProviders(new Set());
        }
      })
      .catch(() => {
        // On error, keep showing all (fail-open).
      });
  }, []);

  // Filter out unconfigured local providers from the provider list.
  const currentProviders = (PROVIDER_MODELS[activeTab] ?? []).filter(
    (p) => !LOCAL_PROVIDERS.includes(p.id) || configuredLocalProviders.has(p.id)
  );
  const currentModels = currentProviders.find((p) => p.id === selectedProvider)?.models ?? [];

  const switchTab = (tab: Modality) => {
    setActiveTab(tab);
    setPrompt("");
    setResult(null);
    setError(null);
    setIsCredentialsError(false);
    setAudioFile(null);
    // Pick first provider and first model automatically.
    const providers = PROVIDER_MODELS[tab] ?? [];
    const firstProvider = providers[0];
    setSelectedProvider(firstProvider?.id ?? "");
    const firstModel = firstProvider?.models[0]?.id ?? "";
    setSelectedModel(firstModel);
    if (tab === "speech") {
      setSpeechVoice(getVoiceList(firstProvider?.id ?? "")[0]?.id ?? "alloy");
    }
  };

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    const models = PROVIDER_MODELS[activeTab]?.find((p) => p.id === providerId)?.models ?? [];
    const firstModel = models[0]?.id ?? "";
    setSelectedModel(firstModel);
    if (activeTab === "speech") {
      setSpeechVoice(getVoiceList(providerId)[0]?.id ?? "alloy");
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setIsCredentialsError(false);
    setResult(null);

    try {
      const config = MODALITY_CONFIG[activeTab];
      const modelId = selectedModel;

      if (activeTab === "speech") {
        if (!prompt.trim()) {
          setError("Please enter text to synthesize.");
          setLoading(false);
          return;
        }
        const res = await fetch(config.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelId,
            input: prompt.trim(),
            voice: speechVoice,
            response_format: speechFormat,
          }),
        });
        if (!res.ok) {
          const raw = await res.json().catch(() => ({}));
          const { message, isCredentials } = parseApiError(raw, res.status);
          setIsCredentialsError(isCredentials);
          throw new Error(message);
        }
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        setResult({
          type: "speech",
          data: { format: speechFormat },
          timestamp: Date.now(),
          audioUrl,
        });
        setLoading(false);
        return;
      }

      if (activeTab === "transcription") {
        if (!audioFile) {
          setError("Please select an audio file to transcribe.");
          setLoading(false);
          return;
        }
        const form = new FormData();
        form.append("file", audioFile);
        form.append("model", modelId);
        const res = await fetch(config.endpoint, { method: "POST", body: form });
        if (!res.ok) {
          const raw = await res.json().catch(() => ({}));
          const { message, isCredentials } = parseApiError(raw, res.status);
          setIsCredentialsError(isCredentials);
          throw new Error(message);
        }
        const data = await res.json();
        // Check for noSpeechDetected flag (music, silence, etc.) - NOT a credential error.
        if (data?.noSpeechDetected) {
          setError(
            `No speech detected in the audio file. If you uploaded music or a silent file, try an audio file with spoken words. Provider: "${selectedProvider}".`
          );
          setIsCredentialsError(false);
          setLoading(false);
          return;
        }
        // Warn if text is empty without the noSpeechDetected flag (unexpected).
        if (data && typeof data.text === "string" && data.text.trim() === "") {
          setError(
            `Transcription returned empty text. The audio may contain no recognizable speech, or the "${selectedProvider}" API key may be invalid. Check Dashboard -> Logs -> Proxy for details.`
          );
          setIsCredentialsError(false);
          setLoading(false);
          return;
        }
        setResult({ type: "transcription", data, timestamp: Date.now() });
        setLoading(false);
        return;
      }

      if (!prompt.trim()) {
        setError("Please enter a prompt.");
        setLoading(false);
        return;
      }
      const res = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          prompt: prompt.trim(),
          ...(activeTab === "image" ? { size: "1024x1024", n: 1 } : {}),
        }),
      });
      if (!res.ok) {
        const raw = await res.json().catch(() => ({}));
        const { message, isCredentials } = parseApiError(raw, res.status);
        setIsCredentialsError(isCredentials);
        throw new Error(message);
      }
      const data = await res.json();
      setResult({ type: activeTab, data, timestamp: Date.now() });
    } catch (err: any) {
      setError(err.message || "Generation failed");
    }
    setLoading(false);
  };

  const config = MODALITY_CONFIG[activeTab];
  const voiceList = getVoiceList(selectedProvider);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-main">{t("title")}</h1>
        <p className="text-text-muted text-sm mt-1">{t("subtitle")}</p>
      </div>

      {/* Modality Tabs */}
      <div className="flex flex-wrap gap-2 p-1 bg-surface/50 rounded-xl border border-black/5 dark:border-white/5">
        {(Object.keys(MODALITY_CONFIG) as Modality[]).map((key) => {
          const cfg = MODALITY_CONFIG[key];
          const isActive = key === activeTab;
          return (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={`flex-1 min-w-[110px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                  : "text-text-muted hover:text-text-main hover:bg-surface/80"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{cfg.icon}</span>
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Generation Form */}
      <div className="bg-surface/30 rounded-xl border border-black/5 dark:border-white/5 p-6 space-y-4">
        {/* Provider + Model row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Provider dropdown */}
          <div>
            <label className="block text-sm font-medium text-text-main mb-2">Provider</label>
            <select
              value={selectedProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-black/10 dark:border-white/10 text-text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {currentProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model dropdown */}
          <div>
            <label className="block text-sm font-medium text-text-main mb-2">{t("model")}</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-black/10 dark:border-white/10 text-text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {currentModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Credential hint */}
        {selectedProvider && !["sdwebui", "comfyui", "qwen"].includes(selectedProvider) && (
          <p className="text-xs text-text-muted flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-amber-500">info</span>
            Requires <strong className="capitalize">{selectedProvider}</strong> API key in{" "}
            <Link
              href="/dashboard/providers"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Providers
            </Link>
          </p>
        )}

        {/* Speech: voice + format */}
        {activeTab === "speech" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-main mb-2">Voice</label>
              <select
                value={speechVoice}
                onChange={(e) => setSpeechVoice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-black/10 dark:border-white/10 text-text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {voiceList.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-2">Format</label>
              <select
                value={speechFormat}
                onChange={(e) => setSpeechFormat(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-black/10 dark:border-white/10 text-text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {SPEECH_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Transcription: file upload */}
        {activeTab === "transcription" ? (
          <div>
            <label className="block text-sm font-medium text-text-main mb-2">
              Audio / Video File
            </label>
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setFileSizeError(null);
                if (file && file.size > MAX_TRANSCRIPTION_FILE_SIZE) {
                  setFileSizeError(
                    `File too large (${formatFileSize(file.size)}). Maximum allowed: 4 GB.`
                  );
                  setAudioFile(null);
                  e.target.value = "";
                  return;
                }
                setAudioFile(file);
              }}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-black/10 dark:border-white/10 text-text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary/10 file:text-primary file:text-sm"
            />
            {fileSizeError && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">error</span>
                {fileSizeError}
              </p>
            )}
            {audioFile && !fileSizeError && (
              <p className="text-xs text-text-muted mt-1">
                {audioFile.name} ({formatFileSize(audioFile.size)})
              </p>
            )}
            <p className="text-[10px] text-text-muted/60 mt-1">
              Supports audio and video files up to 4 GB
            </p>
          </div>
        ) : (
          /* Prompt / Text */
          <div>
            <label className="block text-sm font-medium text-text-main mb-2">
              {activeTab === "speech" ? "Text" : t("prompt")}
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={config.placeholder}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-black/10 dark:border-white/10 text-text-main text-sm placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={loading || (activeTab === "transcription" ? !audioFile : !prompt.trim())}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white font-medium transition-all bg-gradient-to-r ${config.color} ${
            loading || (activeTab === "transcription" ? !audioFile : !prompt.trim())
              ? "opacity-50 cursor-not-allowed"
              : "hover:opacity-90 hover:shadow-lg"
          }`}
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined animate-spin text-[18px]">
                progress_activity
              </span>
              {activeTab === "speech"
                ? "Synthesizing..."
                : activeTab === "transcription"
                  ? "Transcribing..."
                  : t("generating")}
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">
                {activeTab === "speech"
                  ? "volume_up"
                  : activeTab === "transcription"
                    ? "mic"
                    : "auto_awesome"}
              </span>
              {activeTab === "speech"
                ? "Synthesize Speech"
                : activeTab === "transcription"
                  ? "Transcribe Audio"
                  : `${t("generate")} ${config.label}`}
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className={`rounded-xl p-4 flex items-start gap-3 ${isCredentialsError ? "bg-amber-500/10 border border-amber-500/20" : "bg-red-500/10 border border-red-500/20"}`}
        >
          <span
            className={`material-symbols-outlined text-[20px] mt-0.5 ${isCredentialsError ? "text-amber-500" : "text-red-500"}`}
          >
            {isCredentialsError ? "key" : "error"}
          </span>
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-medium ${isCredentialsError ? "text-amber-500" : "text-red-500"}`}
            >
              {isCredentialsError ? "API Key Required" : t("error")}
            </p>
            <p className="text-sm text-text-muted mt-1 break-words">{error}</p>
            {isCredentialsError && (
              <Link
                href="/dashboard/providers"
                className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                Configure API keys in Providers {"->"}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-surface/30 rounded-xl border border-black/5 dark:border-white/5 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span
              className={`material-symbols-outlined text-[20px] bg-gradient-to-r ${config.color} bg-clip-text text-transparent`}
            >
              {config.icon}
            </span>
            <h3 className="text-sm font-medium text-text-main">{t("result")}</h3>
            <span className="text-xs text-text-muted ml-auto">
              {new Date(result.timestamp).toLocaleTimeString()}
            </span>
          </div>

          {result.type === "speech" && result.audioUrl ? (
            <div className="space-y-3">
              <audio controls src={result.audioUrl} className="w-full rounded-lg" autoPlay />
              <a
                href={result.audioUrl}
                download={`speech.${result.data?.format || "mp3"}`}
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Download {result.data?.format?.toUpperCase() || "MP3"}
              </a>
            </div>
          ) : result.type === "image" ? (
            <ImageResults data={result.data} />
          ) : result.type === "transcription" ? (
            <div className="space-y-3">
              <div className="bg-surface rounded-lg p-4 text-sm text-text-main leading-relaxed whitespace-pre-wrap">
                {result.data?.text || (
                  <span className="text-text-muted italic">No text returned</span>
                )}
              </div>
              {result.data?.words && (
                <details className="mt-2">
                  <summary className="text-xs text-text-muted cursor-pointer hover:text-text-main">
                    Word-level timestamps ({result.data.words.length} words)
                  </summary>
                  <pre className="bg-surface rounded mt-2 p-3 text-xs text-text-muted overflow-auto max-h-48 custom-scrollbar">
                    {JSON.stringify(result.data.words, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ) : (
            <pre className="bg-surface rounded-lg p-4 text-xs text-text-muted overflow-auto max-h-96 custom-scrollbar">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {(Object.keys(MODALITY_CONFIG) as Modality[]).map((key) => {
          const cfg = MODALITY_CONFIG[key];
          const providerCount = PROVIDER_MODELS[key]?.length ?? 0;
          return (
            <div
              key={key}
              className="bg-surface/30 rounded-xl border border-black/5 dark:border-white/5 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`flex items-center justify-center size-8 rounded-lg bg-gradient-to-r ${cfg.color}`}
                >
                  <span className="material-symbols-outlined text-white text-[16px]">
                    {cfg.icon}
                  </span>
                </div>
                <span className="text-sm font-medium text-text-main">{cfg.label}</span>
              </div>
              <p className="text-xs text-text-muted">{providerCount} providers</p>
              <code className="block mt-2 text-xs text-primary/70 bg-primary/5 rounded px-2 py-1">
                POST {cfg.endpoint}
              </code>
            </div>
          );
        })}
      </div>
    </div>
  );
}
