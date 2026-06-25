"use client";

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslations } from "next-intl";
import { Badge, Button, Input, Modal, Select } from "@/shared/components";
import {
  CC_COMPATIBLE_DEFAULT_CHAT_PATH,
  CC_COMPATIBLE_DETAILS_TITLE,
} from "./provider-detail-modals.shared";

function EditCompatibleNodeModal({
  isOpen,
  node,
  onSave,
  onClose,
  isAnthropic,
  isCcCompatible,
}: EditCompatibleNodeModalProps) {
  const t = useTranslations("providers");
  const [formData, setFormData] = useState({
    name: "",
    prefix: "",
    apiType: "chat",
    baseUrl: "https://api.openai.com/v1",
    chatPath: "",
    modelsPath: "",
  });
  const [saving, setSaving] = useState(false);
  const [checkKey, setCheckKey] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (node) {
      setFormData({
        name: node.name || "",
        prefix: node.prefix || "",
        apiType: node.apiType || "chat",
        baseUrl:
          node.baseUrl ||
          (isCcCompatible
            ? "https://api.anthropic.com"
            : isAnthropic
              ? "https://api.anthropic.com/v1"
              : "https://api.openai.com/v1"),
        chatPath: node.chatPath || (isCcCompatible ? CC_COMPATIBLE_DEFAULT_CHAT_PATH : ""),
        modelsPath: isCcCompatible ? "" : node.modelsPath || "",
      });
      setShowAdvanced(
        !!(
          node.chatPath ||
          (!isCcCompatible && node.modelsPath) ||
          (isCcCompatible && !node.chatPath)
        )
      );
    }
  }, [node, isAnthropic, isCcCompatible]);

  const apiTypeOptions = [
    { value: "chat", label: t("chatCompletions") },
    { value: "responses", label: t("responsesApi") },
  ];

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.prefix.trim() || !formData.baseUrl.trim()) return;
    setSaving(true);
    try {
      const payload: any = {
        name: formData.name,
        prefix: formData.prefix,
        baseUrl: formData.baseUrl,
        chatPath: formData.chatPath || (isCcCompatible ? CC_COMPATIBLE_DEFAULT_CHAT_PATH : ""),
        modelsPath: isCcCompatible ? "" : formData.modelsPath,
      };
      if (!isAnthropic) {
        payload.apiType = formData.apiType;
      }
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await fetch("/api/provider-nodes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: formData.baseUrl,
          apiKey: checkKey,
          type: isAnthropic ? "anthropic-compatible" : "openai-compatible",
          compatMode: isCcCompatible ? "cc" : undefined,
          chatPath: formData.chatPath || (isCcCompatible ? CC_COMPATIBLE_DEFAULT_CHAT_PATH : ""),
          modelsPath: isCcCompatible ? "" : formData.modelsPath,
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

  if (!node) return null;

  return (
    <Modal
      isOpen={isOpen}
      title={
        isCcCompatible
          ? CC_COMPATIBLE_DETAILS_TITLE
          : t("editCompatibleTitle", { type: isAnthropic ? t("anthropic") : t("openai") })
      }
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <Input
          label={isCcCompatible ? "Name" : t("nameLabel")}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={
            isCcCompatible
              ? "CC Compatible Production"
              : t("compatibleProdPlaceholder", {
                  type: isAnthropic ? t("anthropic") : t("openai"),
                })
          }
          hint={isCcCompatible ? "Display name for this provider" : t("nameHint")}
        />
        <Input
          label={isCcCompatible ? "Prefix" : t("prefixLabel")}
          value={formData.prefix}
          onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
          placeholder={
            isCcCompatible
              ? "cc"
              : isAnthropic
                ? t("anthropicPrefixPlaceholder")
                : t("openaiPrefixPlaceholder")
          }
          hint={isCcCompatible ? "Used for aliases such as prefix/model-id" : t("prefixHint")}
        />
        {!isAnthropic && (
          <Select
            label={t("apiTypeLabel")}
            options={apiTypeOptions}
            value={formData.apiType}
            onChange={(e) => setFormData({ ...formData, apiType: e.target.value })}
          />
        )}
        <Input
          label={isCcCompatible ? "Base URL" : t("baseUrlLabel")}
          value={formData.baseUrl}
          onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
          placeholder={
            isCcCompatible
              ? "https://example.com/v1"
              : isAnthropic
                ? t("anthropicBaseUrlPlaceholder")
                : t("openaiBaseUrlPlaceholder")
          }
          hint={
            isCcCompatible
              ? "Base URL for the CC-compatible site. Do not include /messages."
              : t("compatibleBaseUrlHint", {
                  type: isAnthropic ? t("anthropic") : t("openai"),
                })
          }
        />
        <button
          type="button"
          className="text-sm text-text-muted hover:text-text-primary flex items-center gap-1"
          onClick={() => setShowAdvanced(!showAdvanced)}
          aria-expanded={showAdvanced}
          aria-controls="advanced-settings"
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
          <div id="advanced-settings" className="flex flex-col gap-3 pl-2 border-l-2 border-border">
            <Input
              label={isCcCompatible ? "Chat Path" : t("chatPathLabel")}
              value={formData.chatPath}
              onChange={(e) => setFormData({ ...formData, chatPath: e.target.value })}
              placeholder={
                isCcCompatible
                  ? CC_COMPATIBLE_DEFAULT_CHAT_PATH
                  : isAnthropic
                    ? "/messages"
                    : t("chatPathPlaceholder")
              }
              hint={
                isCcCompatible
                  ? "Defaults to the strict Claude Code-compatible messages path"
                  : t("chatPathHint")
              }
            />
            {!isCcCompatible && (
              <Input
                label={t("modelsPathLabel")}
                value={formData.modelsPath}
                onChange={(e) => setFormData({ ...formData, modelsPath: e.target.value })}
                placeholder={t("modelsPathPlaceholder")}
                hint={t("modelsPathHint")}
              />
            )}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            label={t("apiKeyForCheck")}
            type="password"
            value={checkKey}
            onChange={(e) => setCheckKey(e.target.value)}
            className="flex-1"
          />
          <div className="pt-6">
            <Button
              onClick={handleValidate}
              disabled={!checkKey || validating || !formData.baseUrl.trim()}
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
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            fullWidth
            disabled={
              !formData.name.trim() || !formData.prefix.trim() || !formData.baseUrl.trim() || saving
            }
          >
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

EditCompatibleNodeModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  node: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    prefix: PropTypes.string,
    apiType: PropTypes.string,
    baseUrl: PropTypes.string,
    chatPath: PropTypes.string,
    modelsPath: PropTypes.string,
  }),
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  isAnthropic: PropTypes.bool,
  isCcCompatible: PropTypes.bool,
};

export { EditCompatibleNodeModal };
