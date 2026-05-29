"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components";
import { useTranslations } from "next-intl";
import CliToolCardFrame, {
  CliToolCardSection,
  CliToolLabeledField,
  CliToolMetaPill,
  CliToolNotice,
} from "./CliToolCardFrame";

const SELECTED_MODELS_KEY = "Zavorth-copilot-selected-models";
const LEGACY_SELECTED_MODELS_KEY = "ZavorthGateway-copilot-selected-models";
const SELECTED_KEY_KEY = "Zavorth-cli-key-copilot";
const LEGACY_SELECTED_KEY_KEY = "ZavorthGateway-cli-key-copilot";

const fieldClassName =
  "w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm text-text-main outline-none transition focus:border-primary/40 focus:ring-0 dark:border-white/10 dark:bg-white/[0.05]";

function toV1Url(url: string) {
  return url.endsWith("/v1") ? url : `${url}/v1`;
}

function readStoredSet() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const saved =
      localStorage.getItem(SELECTED_MODELS_KEY) ||
      localStorage.getItem(LEGACY_SELECTED_MODELS_KEY);
    return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function readSessionBackedSecret(key: string, legacyKey: string) {
  if (typeof window === "undefined") return "";
  try {
    const sessionValue = window.sessionStorage.getItem(key);
    if (sessionValue) return sessionValue;

    const legacyValue = window.localStorage.getItem(key) || window.localStorage.getItem(legacyKey);
    if (!legacyValue) return "";

    window.sessionStorage.setItem(key, legacyValue);
    window.localStorage.removeItem(key);
    window.localStorage.removeItem(legacyKey);
    return legacyValue;
  } catch {
    return "";
  }
}

function writeSessionBackedSecret(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
    }
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures; the current React state still carries the selection.
  }
}

export default function CopilotToolCard({
  tool,
  isExpanded,
  onToggle,
  baseUrl,
  apiKeys,
  cloudEnabled = false,
}) {
  const t = useTranslations("cliTools");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(() => readStoredSet());
  const [selectedApiKey, setSelectedApiKey] = useState(() => {
    if (typeof window === "undefined") return apiKeys?.length > 0 ? apiKeys[0].key : "";
    const savedKey = readSessionBackedSecret(SELECTED_KEY_KEY, LEGACY_SELECTED_KEY_KEY);
    if (savedKey && apiKeys?.some((key: any) => key.key === savedKey)) return savedKey;
    return apiKeys?.length > 0 ? apiKeys[0].key : "";
  });
  const [maxInputTokens, setMaxInputTokens] = useState(128000);
  const [maxOutputTokens, setMaxOutputTokens] = useState(16000);
  const [toolCalling, setToolCalling] = useState(true);
  const [vision, setVision] = useState(false);
  const [allModels, setAllModels] = useState<Array<{ value: string; label: string }>>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    if (!isExpanded || modelsLoaded) return;
    let cancelled = false;

    fetch("/v1/models")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const modelList = (data.data || [])
          .filter((model: any) => model && !model.type && !model.parent && model.id)
          .map((model: any) => ({
            value: model.id,
            label: model.id,
          }));
        setAllModels(modelList);
        setModelsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setModelsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isExpanded, modelsLoaded]);

  useEffect(() => {
    localStorage.setItem(SELECTED_MODELS_KEY, JSON.stringify([...selectedModels]));
  }, [selectedModels]);

  const availableModels = searchFilter
    ? allModels.filter((model) => model.label.toLowerCase().includes(searchFilter.toLowerCase()))
    : allModels;

  const toggleModel = (modelValue: string) => {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelValue)) {
        next.delete(modelValue);
      } else {
        next.add(modelValue);
      }
      return next;
    });
  };

  const getBaseUrlForConfig = () => `${toV1Url(baseUrl || "http://localhost:20128")}/chat/completions`;

  const generateConfig = () => {
    const models = [...selectedModels].map((modelId) => ({
      id: modelId,
      name: modelId,
      url: `${getBaseUrlForConfig()}#models.ai.azure.com`,
      toolCalling,
      vision,
      maxInputTokens,
      maxOutputTokens,
    }));

    return JSON.stringify(
      {
        name: "Zavorth",
        vendor: "azure",
        apiKey: "${input:chat.lm.secret.Zavorth}",
        models,
      },
      null,
      2
    );
  };

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleApiKeyChange = (value: string) => {
    setSelectedApiKey(value);
    writeSessionBackedSecret(SELECTED_KEY_KEY, value);
  };

  return (
    <CliToolCardFrame
      tool={tool}
      toolKey="copilot"
      isExpanded={isExpanded}
      onToggle={onToggle}
      eyebrow="VS Code model manifest"
      summary={
        tool.description ||
        "Generate a Copilot Chat model manifest that points VS Code back at Zavorth."
      }
      status={
        <CliToolMetaPill tone="info" icon="menu_book">
          {t("guide")}
        </CliToolMetaPill>
      }
      meta={
        <>
          <CliToolMetaPill icon="model_training">
            {selectedModels.size}/{allModels.length || "..."} models
          </CliToolMetaPill>
          <CliToolMetaPill icon="integration_instructions">Azure vendor bridge</CliToolMetaPill>
        </>
      }
    >
      <CliToolCardSection
        title="Copilot manifest strategy"
        description="This card only generates the VS Code JSON block. It does not write Copilot files directly."
        icon="schema"
        tone="info"
      >
        <CliToolNotice tone="info" icon="info" title="GitHub Copilot Config Generator">
          <p>
            Generate the <code>chatLanguageModels.json</code> block with the Azure vendor pattern,
            select the models you want exposed, then paste the JSON into VS Code.
          </p>
        </CliToolNotice>
        <CliToolNotice tone="warning" icon="warning" title="Extension compatibility">
          <p>
            This route depends on Copilot Chat accepting custom model lists through the Azure vendor
            workaround. Extension updates may change that behavior.
          </p>
        </CliToolNotice>
      </CliToolCardSection>

      {cloudEnabled && apiKeys?.length > 0 ? (
        <CliToolCardSection
          title="Credential reference"
          description="Pick the dashboard key you intend to use when VS Code prompts for the Copilot secret."
          icon="key"
        >
          <select
            value={selectedApiKey}
            onChange={(event) => handleApiKeyChange(event.target.value)}
            className={fieldClassName}
          >
            {apiKeys.map((key: any) => (
              <option key={key.id} value={key.key}>
                {key.key}
              </option>
            ))}
          </select>
        </CliToolCardSection>
      ) : null}

      <CliToolCardSection
        title={`Model selection (${selectedModels.size}/${availableModels.length})`}
        description="Search active Zavorth models and choose the subset that Copilot should advertise."
        icon="model_training"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={searchFilter}
            onChange={(event) => setSearchFilter(event.target.value)}
            placeholder="Filter models..."
            className={fieldClassName}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedModels(new Set(allModels.map((model) => model.value)))}
            disabled={allModels.length === 0}
          >
            Select all
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedModels(new Set())}>
            Clear
          </Button>
        </div>

        {!modelsLoaded && allModels.length === 0 ? (
          <CliToolNotice tone="info" icon="progress_activity" title="Loading models" />
        ) : availableModels.length === 0 && allModels.length === 0 ? (
          <CliToolNotice tone="warning" icon="warning" title={t("noActiveProviders")} />
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-2xl border border-black/8 bg-black/[0.025] dark:border-white/8 dark:bg-white/[0.03]">
            {availableModels.map((model) => (
              <label
                key={model.value}
                className="flex cursor-pointer items-center gap-3 border-b border-black/5 px-3 py-2 transition-colors last:border-0 hover:bg-black/[0.03] dark:border-white/5 dark:hover:bg-white/[0.04]"
              >
                <input
                  type="checkbox"
                  checked={selectedModels.has(model.value)}
                  onChange={() => toggleModel(model.value)}
                  className="rounded border-border accent-[#1F6FEB]"
                />
                <span className="truncate font-mono text-sm">{model.label}</span>
              </label>
            ))}
          </div>
        )}
      </CliToolCardSection>

      <CliToolCardSection
        title="Advanced model traits"
        description="Tune the advertised model capabilities that VS Code will see."
        icon="tune"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <CliToolLabeledField label="Max input tokens">
            <input
              type="number"
              value={maxInputTokens}
              onChange={(event) => setMaxInputTokens(Number(event.target.value) || 128000)}
              className={fieldClassName}
            />
          </CliToolLabeledField>
          <CliToolLabeledField label="Max output tokens">
            <input
              type="number"
              value={maxOutputTokens}
              onChange={(event) => setMaxOutputTokens(Number(event.target.value) || 16000)}
              className={fieldClassName}
            />
          </CliToolLabeledField>
          <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-black/8 bg-black/[0.025] p-3 text-sm dark:border-white/8 dark:bg-white/[0.03]">
            <input
              type="checkbox"
              checked={toolCalling}
              onChange={(event) => setToolCalling(event.target.checked)}
              className="rounded border-border accent-[#1F6FEB]"
            />
            Tool calling
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-black/8 bg-black/[0.025] p-3 text-sm dark:border-white/8 dark:bg-white/[0.03]">
            <input
              type="checkbox"
              checked={vision}
              onChange={(event) => setVision(event.target.checked)}
              className="rounded border-border accent-[#1F6FEB]"
            />
            Vision
          </label>
        </div>
      </CliToolCardSection>

      {selectedModels.size > 0 ? (
        <CliToolCardSection
          title={`Generated config (${selectedModels.size} model${selectedModels.size !== 1 ? "s" : ""})`}
          description="Paste this into VS Code, reload, then enter the Zavorth API secret when prompted."
          icon="data_object"
          tone="info"
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleCopy(generateConfig(), "config")}
              icon={copiedField === "config" ? "check" : "content_copy"}
            >
              {copiedField === "config" ? t("copied") : t("copyConfig")}
            </Button>
          }
        >
          <pre className="max-h-80 overflow-x-auto rounded-2xl border border-black/8 bg-black/[0.03] p-4 dark:border-white/8 dark:bg-black/20">
            <code className="whitespace-pre font-mono text-xs text-text-main">{generateConfig()}</code>
          </pre>
          <CliToolNotice tone="neutral" icon="folder_open" title="Paste into">
            <code>~/.config/Code/User/chatLanguageModels.json</code>
          </CliToolNotice>
        </CliToolCardSection>
      ) : null}
    </CliToolCardFrame>
  );
}
