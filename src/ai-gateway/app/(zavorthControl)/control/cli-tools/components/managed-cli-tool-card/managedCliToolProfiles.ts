const CLOUD_URL = process.env.NEXT_PUBLIC_CLOUD_URL;

type TranslationFn = (key: string, values?: Record<string, unknown>) => string;

type ManualConfigInput = {
  selectedModel: string;
  selectedApiKey: string;
  effectiveBaseUrl: string;
  cloudEnabled: boolean;
};

type ManualConfigFile = {
  filename: string;
  content: string;
};

export type ManagedCliToolProfile = {
  toolId: "cline" | "kilo" | "external-executor" | "droid";
  displayName: string;
  endpoint: string;
  manualTitleKey: string;
  manualMode: "input" | "files";
  statusModel?: (status: any) => string;
  statusApiKey?: (status: any) => string;
  statusBaseUrl?: (status: any) => string;
  hasCanonicalProvider?: (status: any) => boolean;
  currentDetails?: (status: any, t: TranslationFn) => string | null;
  createManualConfigs?: (input: ManualConfigInput) => ManualConfigFile[];
};

export function toV1Url(url: string) {
  return url.endsWith("/v1") ? url : `${url}/v1`;
}

export function isLocalOrCloudUrl(value: string, cloudEnabled: boolean) {
  const localMatch = value.includes("localhost") || value.includes("127.0.0.1");
  const cloudMatch = cloudEnabled && CLOUD_URL && value.startsWith(CLOUD_URL);
  return localMatch || cloudMatch;
}

function findDroidModel(status: any) {
  return status?.settings?.customModels?.find((model: any) => model.id === "custom:ZavorthGateway-0");
}

function getExternalExecutorProvider(status: any) {
  return status?.settings?.models?.providers?.["ZavorthGateway"];
}

export const MANAGED_CLI_TOOL_PROFILES = {
  cline: {
    toolId: "cline",
    displayName: "Cline",
    endpoint: "/api/cli-tools/cline-settings",
    manualTitleKey: "clineManualConfiguration",
    manualMode: "input",
    statusModel(status: any) {
      return status?.settings?.openAiModelId || "";
    },
    statusBaseUrl(status: any) {
      return status?.settings?.openAiBaseUrl || "";
    },
    hasCanonicalProvider(status: any) {
      return !!status?.hasZavorthGateway;
    },
    currentDetails(status: any, t: TranslationFn) {
      if (!status?.settings?.openAiModelId) return null;
      return `${t("provider")}: openai | ${t("model")}: ${status.settings.openAiModelId}`;
    },
  },
  kilo: {
    toolId: "kilo",
    displayName: "Kilo Code",
    endpoint: "/api/cli-tools/kilo-settings",
    manualTitleKey: "kiloManualConfiguration",
    manualMode: "input",
    hasCanonicalProvider(status: any) {
      return !!status?.hasZavorthGateway;
    },
    currentDetails(status: any, t: TranslationFn) {
      const providers = status?.settings?.auth?.join(", ");
      return providers ? `${t("providers")}: ${providers}` : null;
    },
  },
  "external-executor": {
    toolId: "external-executor",
    displayName: "External Executor",
    endpoint: "/api/cli-tools/external-executor-settings",
    manualTitleKey: "externalExecutorManualConfiguration",
    manualMode: "files",
    statusModel(status: any) {
      const primary = status?.settings?.agents?.defaults?.model?.primary;
      return primary ? primary.replace("ZavorthGateway/", "") : "";
    },
    statusApiKey(status: any) {
      return getExternalExecutorProvider(status)?.apiKey || "";
    },
    statusBaseUrl(status: any) {
      return getExternalExecutorProvider(status)?.baseUrl || "";
    },
    hasCanonicalProvider(status: any) {
      return !!getExternalExecutorProvider(status);
    },
    createManualConfigs({ selectedModel, selectedApiKey, effectiveBaseUrl, cloudEnabled }: ManualConfigInput) {
      const keyToUse =
        selectedApiKey?.trim() || (!cloudEnabled ? "sk_ZavorthGateway" : "<API_KEY_FROM_DASHBOARD>");
      const modelId = selectedModel || "provider/model-id";
      return [
        {
          filename: "External Executor settings JSON",
          content: JSON.stringify(
            {
              agents: {
                defaults: {
                  model: {
                    primary: `ZavorthGateway/${modelId}`,
                  },
                },
              },
              models: {
                providers: {
                  ZavorthGateway: {
                    baseUrl: effectiveBaseUrl,
                    apiKey: keyToUse,
                    api: "openai-completions",
                    models: [
                      {
                        id: modelId,
                        name: modelId.split("/").pop(),
                      },
                    ],
                  },
                },
              },
            },
            null,
            2
          ),
        },
      ];
    },
  },
  droid: {
    toolId: "droid",
    displayName: "Factory Droid",
    endpoint: "/api/cli-tools/droid-settings",
    manualTitleKey: "droidManualConfiguration",
    manualMode: "files",
    statusModel(status: any) {
      return findDroidModel(status)?.model || "";
    },
    statusApiKey(status: any) {
      return findDroidModel(status)?.apiKey || "";
    },
    statusBaseUrl(status: any) {
      return findDroidModel(status)?.baseUrl || "";
    },
    hasCanonicalProvider(status: any) {
      return !!findDroidModel(status);
    },
    createManualConfigs({ selectedModel, selectedApiKey, effectiveBaseUrl, cloudEnabled }: ManualConfigInput) {
      const keyToUse =
        selectedApiKey?.trim() || (!cloudEnabled ? "sk_ZavorthGateway" : "<API_KEY_FROM_DASHBOARD>");
      const modelId = selectedModel || "provider/model-id";
      const settingsContent = {
        customModels: [
          {
            model: modelId,
            id: "custom:ZavorthGateway-0",
            index: 0,
            baseUrl: effectiveBaseUrl,
            apiKey: keyToUse,
            displayName: modelId,
            maxOutputTokens: 131072,
            noImageSupport: false,
            provider: "openai",
          },
        ],
      };
      const platform = typeof navigator !== "undefined" ? navigator.platform : "";
      const filename = platform?.toLowerCase().includes("win")
        ? "%APPDATA%\\Factory\\Droid\\settings.json"
        : "~/.factory/droid/settings.json";
      return [
        {
          filename,
          content: JSON.stringify(settingsContent, null, 2),
        },
      ];
    },
  },
} satisfies Record<string, ManagedCliToolProfile>;
