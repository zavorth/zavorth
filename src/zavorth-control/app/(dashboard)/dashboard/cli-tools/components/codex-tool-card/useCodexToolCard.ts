"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function useCodexToolCard({
  apiKeys,
  baseUrl,
  batchStatus,
  cloudEnabled,
  isExpanded,
}) {
  const t = useTranslations("cliTools");
  const [codexStatus, setCodexStatus] = useState(null);
  const [checkingCodex, setCheckingCodex] = useState(false);
  const [applying, setApplying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modelAliases, setModelAliases] = useState({});
  const [showManualConfigModal, setShowManualConfigModal] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [showProfiles, setShowProfiles] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [activatingProfile, setActivatingProfile] = useState(null);
  const [backups, setBackups] = useState([]);
  const [showBackups, setShowBackups] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(null);
  const cliReady = !!(codexStatus?.installed && codexStatus?.runnable);

  useEffect(() => {
    if (apiKeys?.length > 0 && !selectedApiKey) {
      setSelectedApiKey(apiKeys[0].key);
    }
  }, [apiKeys, selectedApiKey]);

  useEffect(() => {
    if (isExpanded && !codexStatus) {
      checkCodexStatus();
      fetchModelAliases();
      fetchProfiles();
      fetchBackups();
    }
  }, [isExpanded, codexStatus]);

  useEffect(() => {
    if (codexStatus?.config) {
      const modelMatch = codexStatus.config.match(/^model\s*=\s*"([^"]+)"/m);
      if (modelMatch) setSelectedModel(modelMatch[1]);
    }
  }, [codexStatus]);

  const fetchModelAliases = async () => {
    try {
      const res = await fetch("/api/models/alias");
      const data = await res.json();
      if (res.ok) setModelAliases(data.aliases || {});
    } catch (error) {
      console.log("Error fetching model aliases:", error);
    }
  };

  const getConfigStatus = () => {
    if (!cliReady) return null;
    if (!codexStatus.config) return "not_configured";
    const hasBaseUrl =
      codexStatus.config.includes(baseUrl) ||
      codexStatus.config.includes("localhost") ||
      codexStatus.config.includes("127.0.0.1");
    return hasBaseUrl ? "configured" : "other";
  };

  const configStatus = getConfigStatus();
  const effectiveConfigStatus = configStatus || batchStatus?.configStatus || null;

  const getEffectiveBaseUrl = () => {
    const url = customBaseUrl || `${baseUrl}/v1`;
    return url.endsWith("/v1") ? url : `${url}/v1`;
  };

  const getDisplayUrl = () => customBaseUrl || `${baseUrl}/v1`;

  const checkCodexStatus = async () => {
    setCheckingCodex(true);
    try {
      const res = await fetch("/api/cli-tools/codex-settings");
      const data = await res.json();
      setCodexStatus(data);
    } catch (error) {
      setCodexStatus({ installed: false, error: error.message });
    } finally {
      setCheckingCodex(false);
    }
  };

  const handleApplySettings = async () => {
    setApplying(true);
    setMessage(null);
    try {
      const keyToUse =
        selectedApiKey && selectedApiKey.trim()
          ? selectedApiKey
          : !cloudEnabled
            ? "sk_ZavorthGateway"
            : selectedApiKey;

      const res = await fetch("/api/cli-tools/codex-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: getEffectiveBaseUrl(),
          apiKey: keyToUse,
          model: selectedModel,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: t("settingsApplied") });
        checkCodexStatus();
      } else {
        setMessage({ type: "error", text: data.error || t("failedApplySettings") });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setApplying(false);
    }
  };

  const handleResetSettings = async () => {
    setRestoring(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cli-tools/codex-settings", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: t("settingsReset") });
        setSelectedModel("");
        checkCodexStatus();
      } else {
        setMessage({ type: "error", text: data.error || t("failedResetSettings") });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setRestoring(false);
    }
  };

  const handleModelSelect = (model) => {
    setSelectedModel(model.value);
    setModalOpen(false);
  };

  const fetchProfiles = async () => {
    try {
      const res = await fetch("/api/cli-tools/codex-profiles");
      const data = await res.json();
      if (res.ok) setProfiles(data.profiles || []);
    } catch (error) {
      console.log("Error fetching profiles:", error);
    }
  };

  const handleSaveProfile = async () => {
    if (!newProfileName.trim()) return;
    setSavingProfile(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cli-tools/codex-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProfileName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: t("profileSaved", { name: newProfileName }) });
        setNewProfileName("");
        fetchProfiles();
      } else {
        setMessage({ type: "error", text: data.error || t("failedSaveProfile") });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleActivateProfile = async (profileId) => {
    setActivatingProfile(profileId);
    setMessage(null);
    try {
      const res = await fetch("/api/cli-tools/codex-profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message || t("profileActivated") });
        checkCodexStatus();
        fetchBackups();
      } else {
        setMessage({ type: "error", text: data.error || t("failedActivateProfile") });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setActivatingProfile(null);
    }
  };

  const handleDeleteProfile = async (profileId) => {
    try {
      const res = await fetch("/api/cli-tools/codex-profiles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      if (res.ok) fetchProfiles();
    } catch (error) {
      console.log("Error deleting profile:", error);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await fetch("/api/cli-tools/backups?tool=codex");
      const data = await res.json();
      if (res.ok) setBackups(data.backups || []);
    } catch (error) {
      console.log("Error fetching backups:", error);
    }
  };

  const handleRestoreBackup = async (backupId) => {
    setRestoringBackup(backupId);
    setMessage(null);
    try {
      const res = await fetch("/api/cli-tools/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "codex", backupId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: t("backupRestored") });
        checkCodexStatus();
        fetchBackups();
      } else {
        setMessage({ type: "error", text: data.error || t("failedRestore") });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setRestoringBackup(null);
    }
  };

  const getManualConfigs = () => {
    const keyToUse =
      selectedApiKey && selectedApiKey.trim()
        ? selectedApiKey
        : !cloudEnabled
          ? "sk_ZavorthGateway"
          : "<API_KEY_FROM_DASHBOARD>";

    const configContent = `# Zavorth compatibility profile for Codex CLI
model = "${selectedModel}"
model_provider = "ZavorthGateway"

[model_providers.ZavorthGateway]
name = "Zavorth"
base_url = "${getEffectiveBaseUrl()}"
wire_api = "responses"
`;

    const authContent = JSON.stringify(
      {
        OPENAI_API_KEY: keyToUse,
      },
      null,
      2
    );

    return [
      {
        filename: "~/.codex/config.toml",
        content: configContent,
      },
      {
        filename: "~/.codex/auth.json",
        content: authContent,
      },
    ];
  };

  return {
    activatingProfile,
    applying,
    backups,
    checkingCodex,
    cliReady,
    codexStatus,
    customBaseUrl,
    effectiveConfigStatus,
    fetchBackups,
    fetchProfiles,
    getDisplayUrl,
    getManualConfigs,
    handleActivateProfile,
    handleApplySettings,
    handleDeleteProfile,
    handleModelSelect,
    handleResetSettings,
    handleRestoreBackup,
    handleSaveProfile,
    message,
    modalOpen,
    modelAliases,
    newProfileName,
    profiles,
    restoring,
    restoringBackup,
    savingProfile,
    selectedApiKey,
    selectedModel,
    setCustomBaseUrl,
    setModalOpen,
    setNewProfileName,
    setSelectedApiKey,
    setSelectedModel,
    setShowBackups,
    setShowInstallGuide,
    setShowManualConfigModal,
    setShowProfiles,
    showBackups,
    showInstallGuide,
    showManualConfigModal,
    showProfiles,
    t,
  };
}
