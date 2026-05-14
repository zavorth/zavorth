"use client";

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslations } from "next-intl";
import { Badge, Button, Input, Modal } from "@/shared/components";
import { isAnthropicCompatibleProvider, isOpenAICompatibleProvider } from "@/shared/constants/providers";
import { maskEmail } from "@/shared/utils/maskEmail";
import {
  DEFAULT_BAILIAN_BASE_URL,
  DEFAULT_VERTEX_REGION,
  ERROR_TYPE_LABELS,
  normalizeAndValidateHttpBaseUrl,
} from "./provider-detail-modals.shared";

function EditConnectionModal({ isOpen, connection, onSave, onClose }: EditConnectionModalProps) {
  const t = useTranslations("providers");
  const [formData, setFormData] = useState({
    name: "",
    priority: 1,
    apiKey: "",
    healthCheckInterval: 60,
    baseUrl: "",
    region: "",
    apiRegion: "international",
    validationModelId: "",
    tag: "",
    customUserAgent: "",
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [extraApiKeys, setExtraApiKeys] = useState<string[]>([]);
  const [newExtraKey, setNewExtraKey] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  const isBailian = connection?.provider === "bailian-coding-plan";
  const isVertex = connection?.provider === "vertex";
  const isGlm = connection?.provider === "glm";

  useEffect(() => {
    if (connection) {
      const rawBaseUrl = connection.providerSpecificData?.baseUrl;
      const existingBaseUrl = typeof rawBaseUrl === "string" ? rawBaseUrl : "";
      const rawRegion = connection.providerSpecificData?.region;
      const existingRegion = typeof rawRegion === "string" ? rawRegion : "";
      const rawCustomUserAgent = connection.providerSpecificData?.customUserAgent;
      const existingCustomUserAgent =
        typeof rawCustomUserAgent === "string" ? rawCustomUserAgent : "";
      setFormData({
        name: connection.name || "",
        priority: connection.priority || 1,
        apiKey: "",
        healthCheckInterval: connection.healthCheckInterval ?? 60,
        baseUrl: existingBaseUrl || (isBailian ? DEFAULT_BAILIAN_BASE_URL : ""),
        region: existingRegion || (isVertex ? DEFAULT_VERTEX_REGION : ""),
        apiRegion: (connection.providerSpecificData?.apiRegion as string) || "international",
        validationModelId: (connection.providerSpecificData?.validationModelId as string) || "",
        tag: (connection.providerSpecificData?.tag as string) || "",
        customUserAgent: existingCustomUserAgent,
      });
      const existing = connection.providerSpecificData?.extraApiKeys;
      setExtraApiKeys(Array.isArray(existing) ? existing : []);
      setNewExtraKey("");
      setShowAdvanced(!!existingCustomUserAgent);
      setShowEmail(false);
      setTestResult(null);
      setValidationResult(null);
      setSaveError(null);
    }
  }, [connection, isBailian, isVertex]);

  const isOAuth = connection?.authType === "oauth";
  const isCompatible =
    isOpenAICompatibleProvider(connection?.provider) ||
    isAnthropicCompatibleProvider(connection?.provider);
  const testErrorMeta =
    !testResult?.valid && testResult?.diagnosis?.type
      ? ERROR_TYPE_LABELS[testResult.diagnosis.type] || null
      : null;

  const handleTest = async () => {
    if (!connection?.provider) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/providers/${connection.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validationModelId: formData.validationModelId || undefined,
        }),
      });
      const data = await res.json();
      setTestResult({
        valid: !!data.valid,
        diagnosis: data.diagnosis || null,
        message: data.error || null,
      });
    } catch {
      setTestResult({
        valid: false,
        diagnosis: { type: "network_error" },
        message: t("failedTestConnection"),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleValidate = async () => {
    if (!connection?.provider || !formData.apiKey) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const res = await fetch("/api/providers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: connection.provider,
          apiKey: formData.apiKey,
          validationModelId: formData.validationModelId || undefined,
          customUserAgent: formData.customUserAgent.trim() || undefined,
          baseUrl: formData.baseUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      setValidationResult(data.valid ? "success" : "failed");
    } catch {
      setValidationResult("failed");
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const updates: any = {
        name: formData.name,
        priority: formData.priority,
        healthCheckInterval: formData.healthCheckInterval,
      };

      let validatedBailianBaseUrl = null;
      if (isBailian) {
        const checked = normalizeAndValidateHttpBaseUrl(formData.baseUrl, DEFAULT_BAILIAN_BASE_URL);
        if (checked.error) {
          setSaveError(checked.error);
          return;
        }
        validatedBailianBaseUrl = checked.value;
      }

      if (!isOAuth && formData.apiKey) {
        updates.apiKey = formData.apiKey;
        let isValid = validationResult === "success";
        if (!isValid) {
          try {
            setValidating(true);
            setValidationResult(null);
            const res = await fetch("/api/providers/validate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                provider: connection.provider,
                apiKey: formData.apiKey,
                validationModelId: formData.validationModelId || undefined,
                customUserAgent: formData.customUserAgent.trim() || undefined,
                baseUrl: formData.baseUrl.trim() || undefined,
              }),
            });
            const data = await res.json();
            isValid = !!data.valid;
            setValidationResult(isValid ? "success" : "failed");
          } catch {
            setValidationResult("failed");
          } finally {
            setValidating(false);
          }
        }
        if (isValid) {
          updates.testStatus = "active";
          updates.lastError = null;
          updates.lastErrorAt = null;
          updates.lastErrorType = null;
          updates.lastErrorSource = null;
          updates.errorCode = null;
          updates.rateLimitedUntil = null;
        }
      }
      if (!isOAuth) {
        updates.providerSpecificData = {
          ...(connection.providerSpecificData || {}),
          extraApiKeys: extraApiKeys.filter((k) => k.trim().length > 0),
          tag: formData.tag.trim() || undefined,
          customUserAgent: formData.customUserAgent.trim(),
        };
        if (formData.validationModelId) {
          updates.providerSpecificData.validationModelId = formData.validationModelId;
        }
        if (isBailian) {
          updates.providerSpecificData.baseUrl = validatedBailianBaseUrl;
        } else if (isVertex) {
          updates.providerSpecificData.region = formData.region;
        } else if (isGlm) {
          updates.providerSpecificData.apiRegion = formData.apiRegion;
        }
      } else {
        updates.providerSpecificData = {
          ...(connection.providerSpecificData || {}),
          tag: formData.tag.trim() || undefined,
        };
      }
      const error = (await onSave(updates)) as void | unknown;
      if (error) {
        setSaveError(typeof error === "string" ? error : t("failedSaveConnection"));
      }
    } finally {
      setSaving(false);
    }
  };

  if (!connection) return null;

  return (
    <Modal isOpen={isOpen} title={t("editConnection")} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input
          label={t("nameLabel")}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={isOAuth ? t("accountName") : t("productionKey")}
        />
        <Input
          label="Tag / Group"
          value={formData.tag}
          onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
          placeholder="e.g. personal, work, team-a"
          hint="Used to group accounts in the provider view"
        />
        {isOAuth && connection.email && (
          <div className="bg-sidebar/50 p-3 rounded-lg">
            <p className="text-sm text-text-muted mb-1">{t("email")}</p>
            <div className="flex items-center gap-2">
              <p className="font-medium" title={showEmail ? connection.email : undefined}>
                {showEmail ? connection.email : maskEmail(connection.email)}
              </p>
              <button
                type="button"
                onClick={() => setShowEmail((current) => !current)}
                className="rounded p-1 text-text-muted hover:bg-sidebar hover:text-primary"
                title={showEmail ? "Hide email" : "Show email"}
              >
                <span className="material-symbols-outlined text-sm">
                  {showEmail ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>
        )}
        {isOAuth && (
          <Input
            label={t("healthCheckMinutes")}
            type="number"
            value={formData.healthCheckInterval}
            onChange={(e) =>
              setFormData({
                ...formData,
                healthCheckInterval: Math.max(0, Number.parseInt(e.target.value) || 0),
              })
            }
            hint={t("healthCheckHint")}
          />
        )}
        <Input
          label={t("priorityLabel")}
          type="number"
          value={formData.priority}
          onChange={(e) =>
            setFormData({ ...formData, priority: Number.parseInt(e.target.value) || 1 })
          }
        />
        {!isOAuth && (
          <>
            <div className="flex gap-2">
              <Input
                label={t("apiKeyLabel")}
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder={isVertex ? "Cole o Service Account JSON aqui" : t("enterNewApiKey")}
                hint={t("leaveBlankKeepCurrentApiKey")}
                className="flex-1"
              />
              <div className="pt-6">
                <Button
                  onClick={handleValidate}
                  disabled={!formData.apiKey || validating || saving}
                  variant="secondary"
                >
                  {validating ? t("checking") : t("check")}
                </Button>
              </div>
            </div>
            {validationResult && (
              <Badge variant={validationResult === "success" ? "success" : "error"}>
                {validationResult === "success" ? t("valid") : t("invalid")}
              </Badge>
            )}
            {saveError && (
              <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {saveError}
              </div>
            )}
            <button
              type="button"
              className="text-sm text-text-muted hover:text-text-primary flex items-center gap-1"
              onClick={() => setShowAdvanced(!showAdvanced)}
              aria-expanded={showAdvanced}
              aria-controls="edit-connection-advanced-settings"
            >
              <span
                className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                aria-hidden="true"
              >
                ▶
              </span>
              {t("advancedSettings")}
            </button>
            {showAdvanced && (
              <div
                id="edit-connection-advanced-settings"
                className="flex flex-col gap-3 pl-2 border-l-2 border-border"
              >
                <Input
                  label="Custom User-Agent"
                  value={formData.customUserAgent}
                  onChange={(e) => setFormData({ ...formData, customUserAgent: e.target.value })}
                  placeholder="my-app/1.0"
                  hint="Optional override sent upstream as the User-Agent header for this connection"
                />
              </div>
            )}
            <Input
              label="Model ID (opcional)"
              placeholder="ex: grok-3 ou meta-llama/Llama-3.1-8B-Instruct"
              value={formData.validationModelId}
              onChange={(e) => setFormData({ ...formData, validationModelId: e.target.value })}
              hint="Usado como fallback se a listagem de models não estiver disponível"
            />
          </>
        )}

        {isBailian && (
          <Input
            label="Base URL"
            value={formData.baseUrl}
            onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
            placeholder={DEFAULT_BAILIAN_BASE_URL}
            hint="Custom base URL for bailian-coding-plan provider"
          />
        )}

        {isVertex && (
          <Input
            label="Região (Region)"
            value={formData.region}
            onChange={(e) => setFormData({ ...formData, region: e.target.value })}
            placeholder={DEFAULT_VERTEX_REGION}
            hint="ex: us-central1 ou europe-west4. Partner models usam a região global automaticamente."
          />
        )}

        {isGlm && (
          <div>
            <label className="text-sm font-medium text-text-main mb-1 block">API Region</label>
            <select
              value={formData.apiRegion}
              onChange={(e) => setFormData({ ...formData, apiRegion: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
            >
              <option value="international">International (api.z.ai)</option>
              <option value="china">China Mainland (open.bigmodel.cn)</option>
            </select>
            <p className="text-xs text-text-muted mt-1">
              Select the endpoint region for API access and quota tracking.
            </p>
          </div>
        )}

        {!isOAuth && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-main">
              Extra API Keys
              <span className="ml-2 text-[11px] font-normal text-text-muted">
                (round-robin rotation - optional)
              </span>
            </label>
            {extraApiKeys.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {extraApiKeys.map((key, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="flex-1 font-mono text-xs bg-sidebar/50 px-3 py-2 rounded border border-border text-text-muted truncate">
                      {`Key #${idx + 2}: ${key.slice(0, 6)}...${key.slice(-4)}`}
                    </span>
                    <button
                      onClick={() => setExtraApiKeys(extraApiKeys.filter((_, i) => i !== idx))}
                      className="p-1.5 rounded hover:bg-red-500/10 text-red-400 hover:text-red-500"
                      title="Remove this key"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="password"
                value={newExtraKey}
                onChange={(e) => setNewExtraKey(e.target.value)}
                placeholder="Add another API key..."
                className="flex-1 text-sm bg-sidebar/50 border border-border rounded px-3 py-2 text-text-main placeholder:text-text-muted focus:ring-1 focus:ring-primary outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newExtraKey.trim()) {
                    setExtraApiKeys([...extraApiKeys, newExtraKey.trim()]);
                    setNewExtraKey("");
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newExtraKey.trim()) {
                    setExtraApiKeys([...extraApiKeys, newExtraKey.trim()]);
                    setNewExtraKey("");
                  }
                }}
                disabled={!newExtraKey.trim()}
                className="px-3 py-2 rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 text-sm font-medium"
              >
                Add
              </button>
            </div>
            {extraApiKeys.length > 0 && (
              <p className="text-[11px] text-text-muted">
                {extraApiKeys.length + 1} keys total - rotating round-robin on each request.
              </p>
            )}
          </div>
        )}

        {!isCompatible && (
          <div className="flex items-center gap-3">
            <Button onClick={handleTest} variant="secondary" disabled={testing}>
              {testing ? t("testing") : t("testConnection")}
            </Button>
            {testResult && (
              <>
                <Badge variant={testResult.valid ? "success" : "error"}>
                  {testResult.valid ? t("valid") : t("failed")}
                </Badge>
                {testErrorMeta && (
                  <Badge variant={testErrorMeta.variant}>{t(testErrorMeta.labelKey)}</Badge>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSubmit} fullWidth disabled={saving}>
            {saving ? t("saving") : t("save")}
          </Button>
          <Button onClick={onClose} variant="ghost" fullWidth>
            {t("cancel")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

EditConnectionModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  connection: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    email: PropTypes.string,
    priority: PropTypes.number,
    authType: PropTypes.string,
    provider: PropTypes.string,
  }),
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export { EditConnectionModal };
