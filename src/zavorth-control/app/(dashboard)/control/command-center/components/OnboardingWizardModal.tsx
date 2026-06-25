"use client";

import React, { useState, useEffect } from "react";

type DetectedProvider = {
  id: string;
  name: string;
  envVar: string;
  maskedValue: string;
  type: "openai" | "anthropic" | "google" | "openrouter" | "ollama" | "openai-compatible";
};

type WorkspaceHint = {
  type: "nodejs" | "python" | "git_repo" | "docs_only" | "unknown";
  suggestedMission: string;
  readOnly: boolean;
};

type OnboardingState = {
  status: "ready" | "env_detected" | "needs_provider" | "fresh";
  detectedProviders: DetectedProvider[];
  workspace: WorkspaceHint;
};

type OnboardingWizardModalProps = {
  isOpen: boolean;
  onComplete: () => void;
};

const PROVIDER_TEMPLATES = [
  { id: "openai", name: "OpenAI", type: "openai", defaultModel: "gpt-4o", placeholderUrl: "https://api.openai.com/v1" },
  { id: "anthropic", name: "Anthropic", type: "anthropic", defaultModel: "claude-3-5-sonnet-latest", placeholderUrl: "https://api.anthropic.com" },
  { id: "google", name: "Google Gemini", type: "google", defaultModel: "gemini-1.5-pro", placeholderUrl: "https://generativelanguage.googleapis.com" },
  { id: "openrouter", name: "OpenRouter", type: "openrouter", defaultModel: "meta-llama/llama-3-8b-instruct:free", placeholderUrl: "https://openrouter.ai/api/v1" },
  { id: "ollama", name: "Ollama (Local)", type: "ollama", defaultModel: "llama3", placeholderUrl: "http://localhost:11434" },
  { id: "openai-compatible", name: "OpenAI Compatible", type: "openai-compatible", defaultModel: "custom-model", placeholderUrl: "https://your-api-endpoint/v1" }
] as const;

export function OnboardingWizardModal({ isOpen, onComplete }: OnboardingWizardModalProps) {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<OnboardingState | null>(null);
  const [step, setStep] = useState<"welcome" | "manual" | "testing" | "success">("welcome");
  
  // Selection/form state
  const [selectedProvider, setSelectedProvider] = useState<typeof PROVIDER_TEMPLATES[number] | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelId, setModelId] = useState("");
  const [customProviderId, setCustomProviderId] = useState("");
  
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingProgress, setTestingProgress] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    
    // Fetch state from api
    async function fetchOnboardingState() {
      try {
        const res = await fetch("/api/onboarding/state");
        const data = await res.json();
        if (data?.detection) {
          setState(data.detection);
          // If env providers are detected, welcome page will offer them.
        }
      } catch (err) {
        console.error("Failed to load onboarding state", err);
      } finally {
        setLoading(false);
      }
    }
    
    void fetchOnboardingState();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUseEnvProvider = async (provider: DetectedProvider) => {
    setStep("testing");
    setTestingProgress(`Ativando provider ${provider.name} detectado do ambiente...`);
    try {
      const res = await fetch("/api/onboarding/provider-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: provider.id,
          type: provider.type,
          displayName: provider.name,
          // API key is already in env var, but route will verify it
        })
      });
      const data = await res.json();
      if (data.ok) {
        setStep("success");
      } else {
        setStep("manual");
        // Pre-select manual template
        const matched = PROVIDER_TEMPLATES.find((p) => p.type === provider.type);
        if (matched) setSelectedProvider(matched);
        setTestResult({ ok: false, message: data.probe?.message || "Connection probe failed." });
      }
    } catch (err: any) {
      setStep("manual");
      setTestResult({ ok: false, message: err.message || "Failed to confirm provider." });
    }
  };

  const handleSelectManualProvider = (template: typeof PROVIDER_TEMPLATES[number]) => {
    setSelectedProvider(template);
    setApiKey("");
    setBaseUrl(template.type === "ollama" || template.type === "openai-compatible" || template.type === "openrouter" ? template.placeholderUrl : "");
    setModelId(template.defaultModel);
    setCustomProviderId(template.id);
  };

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider) return;

    setStep("testing");
    setTestingProgress(`Testando conexão com ${selectedProvider.name}...`);
    setTestResult(null);

    const providerId = customProviderId.trim() || selectedProvider.id;
    const finalApiKey = apiKey.trim();
    const finalBaseUrl = baseUrl.trim();
    const finalModelId = modelId.trim();

    try {
      const res = await fetch("/api/onboarding/provider-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          type: selectedProvider.type,
          displayName: selectedProvider.name,
          apiKey: finalApiKey || undefined,
          baseUrl: finalBaseUrl || undefined,
          modelId: finalModelId || undefined,
        })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStep("success");
      } else {
        setStep("manual");
        setTestResult({
          ok: false,
          message: data.error?.message || data.probe?.message || "A validação falhou. Verifique as credenciais."
        });
      }
    } catch (err: any) {
      setStep("manual");
      setTestResult({
        ok: false,
        message: err.message || "Erro de rede ao validar o provider."
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/90 p-8 text-white shadow-2xl backdrop-blur-md transition-all duration-300">
        
        {/* Glow effect */}
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-pink-500/10 blur-[120px]" />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            <p className="mt-4 text-sm text-zinc-400">Analisando o ambiente do Zavorth...</p>
          </div>
        ) : (
          <>
            {step === "welcome" && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Configuração Inicial</span>
                  <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                    Bem-vindo ao Zavorth
                  </h2>
                  <p className="text-sm text-zinc-400">
                    O Zavorth é um assistente autônomo local-first. Vamos deixar tudo pronto para você começar a criar.
                  </p>
                </div>

                {state?.workspace && (
                  <div className="rounded-xl border border-white/5 bg-white/5 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                      Workspace Detectado: <span className="text-indigo-400 uppercase">{state.workspace.type}</span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400 italic">
                      &ldquo;{state.workspace.suggestedMission}&rdquo;
                    </p>
                  </div>
                )}

                {state?.detectedProviders && state.detectedProviders.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-zinc-300">Encontramos chaves de API no seu ambiente:</h3>
                    <div className="grid gap-3">
                      {state.detectedProviders.map((provider) => (
                        <div
                          key={provider.id}
                          className="flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 transition hover:bg-indigo-500/10"
                        >
                          <div>
                            <div className="font-semibold text-sm">{provider.name}</div>
                            <div className="text-xs text-zinc-400">{provider.envVar}: {provider.maskedValue}</div>
                          </div>
                          <button
                            onClick={() => void handleUseEnvProvider(provider)}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-indigo-500"
                          >
                            Usar esta chave
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-between items-center border-t border-white/5">
                  <span className="text-xs text-zinc-500">Nenhum dado é enviado para a nuvem sem seu consentimento.</span>
                  <button
                    onClick={() => setStep("manual")}
                    className="w-full sm:w-auto rounded-lg bg-zinc-800 border border-zinc-700 px-6 py-2.5 text-xs font-semibold text-white hover:bg-zinc-700 transition"
                  >
                    Configurar Provedor Manualmente &rarr;
                  </button>
                </div>
              </div>
            )}

            {step === "manual" && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold">Escolha seu Provedor de LLM</h3>
                  <p className="text-xs text-zinc-400">Selecione e configure a inteligência principal do seu agente.</p>
                </div>

                {/* Grid of providers */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PROVIDER_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleSelectManualProvider(template)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                        selectedProvider?.id === template.id
                          ? "border-indigo-500 bg-indigo-500/10 text-white font-semibold"
                          : "border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800/80"
                      }`}
                    >
                      <span className="text-sm">{template.name}</span>
                    </button>
                  ))}
                </div>

                {selectedProvider && (
                  <form onSubmit={(e) => void handleTestAndSave(e)} className="space-y-4 pt-4 border-t border-white/5">
                    {selectedProvider.type !== "ollama" && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-300">Chave de API (API Key)</label>
                        <input
                          type="password"
                          required
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Cole sua chave aqui"
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/50 p-2.5 text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {(selectedProvider.type === "ollama" || selectedProvider.type === "openai-compatible" || selectedProvider.type === "openrouter") && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-300">URL Base (Base URL)</label>
                        <input
                          type="text"
                          required
                          value={baseUrl}
                          onChange={(e) => setBaseUrl(e.target.value)}
                          placeholder={selectedProvider.placeholderUrl}
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/50 p-2.5 text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-300">Modelo Padrão (Model ID)</label>
                        <input
                          type="text"
                          required
                          value={modelId}
                          onChange={(e) => setModelId(e.target.value)}
                          placeholder="ex: gpt-4o"
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/50 p-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-300">ID do Provider</label>
                        <input
                          type="text"
                          required
                          value={customProviderId}
                          onChange={(e) => setCustomProviderId(e.target.value)}
                          placeholder={selectedProvider.id}
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/50 p-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {testResult && !testResult.ok && (
                      <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-400">
                        <strong>Falha no teste:</strong> {testResult.message}
                      </div>
                    )}

                    <div className="flex gap-3 justify-end pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setStep("welcome");
                          setSelectedProvider(null);
                          setTestResult(null);
                        }}
                        className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
                      >
                        Voltar
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-indigo-600 px-6 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition"
                      >
                        Salvar e Testar Conexão
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {step === "testing" && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
                <h3 className="text-lg font-semibold">Testando a conexão...</h3>
                <p className="text-sm text-zinc-400">{testingProgress}</p>
              </div>
            )}

            {step === "success" && (
              <div className="text-center py-8 space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <svg className="h-8 w-8 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">Conexão Estabelecida com Sucesso!</h3>
                  <p className="text-sm text-zinc-400">
                    O Zavorth conseguiu testar a conexão com o provedor de IA e está pronto para receber instruções.
                  </p>
                </div>
                <div className="pt-4 border-t border-white/5">
                  <button
                    onClick={onComplete}
                    className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition"
                  >
                    Acessar Dashboard do Zavorth
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
