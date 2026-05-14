"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { fetchAndDownload } from "./systemStorageDownloads";
import { formatBackupReason, formatBytes, formatRelativeTime } from "./systemStorageFormatters";
import {
  DEFAULT_STORAGE_HEALTH,
  type BackupEntry,
  type SettingsTranslator,
  type StatusMessage,
  type StorageHealth,
} from "./systemStorageTypes";

export const useSystemStorageTab = ({ t }: { t: SettingsTranslator }) => {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupsExpanded, setBackupsExpanded] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<StatusMessage>({ type: "", message: "" });
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [manualBackupLoading, setManualBackupLoading] = useState(false);
  const [manualBackupStatus, setManualBackupStatus] = useState<StatusMessage>({
    type: "",
    message: "",
  });
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<StatusMessage>({ type: "", message: "" });
  const [confirmImport, setConfirmImport] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [clearCacheLoading, setClearCacheLoading] = useState(false);
  const [clearCacheStatus, setClearCacheStatus] = useState<StatusMessage>({
    type: "",
    message: "",
  });
  const [purgeLogsLoading, setPurgeLogsLoading] = useState(false);
  const [purgeLogsStatus, setPurgeLogsStatus] = useState<StatusMessage>({
    type: "",
    message: "",
  });
  const [storageHealth, setStorageHealth] = useState<StorageHealth>(DEFAULT_STORAGE_HEALTH);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const loadBackups = async () => {
    setBackupsLoading(true);
    try {
      const res = await fetch("/api/db-backups");
      const data = await res.json();
      setBackups(data.backups || []);
    } catch (err) {
      console.error("Failed to fetch backups:", err);
    } finally {
      setBackupsLoading(false);
    }
  };

  const loadStorageHealth = async () => {
    try {
      const res = await fetch("/api/storage/health");
      if (!res.ok) return;
      const data = await res.json();
      setStorageHealth((prev) => ({ ...prev, ...data }));
    } catch (err) {
      console.error("Failed to fetch storage health:", err);
    }
  };

  const refreshStorageAfterMutation = async () => {
    await loadStorageHealth();
    if (backupsExpanded) await loadBackups();
  };

  const handleManualBackup = async () => {
    setManualBackupLoading(true);
    setManualBackupStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/db-backups", { method: "PUT" });
      const data = await res.json();
      if (res.ok) {
        if (data.filename) {
          setManualBackupStatus({
            type: "success",
            message: t("backupCreated", { file: data.filename }),
          });
        } else {
          setManualBackupStatus({
            type: "info",
            message: data.message || t("noChangesSinceBackup"),
          });
        }
        await refreshStorageAfterMutation();
      } else {
        setManualBackupStatus({ type: "error", message: data.error || t("backupFailed") });
      }
    } catch {
      setManualBackupStatus({ type: "error", message: t("errorOccurred") });
    } finally {
      setManualBackupLoading(false);
    }
  };

  const handleRestore = async (backupId: string) => {
    setRestoringId(backupId);
    setRestoreStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/db-backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId }),
      });
      const data = await res.json();
      if (res.ok) {
        setRestoreStatus({
          type: "success",
          message: t("restoreSuccess", {
            connections: data.connectionCount,
            nodes: data.nodeCount,
            combos: data.comboCount,
            apiKeys: data.apiKeyCount,
          }),
        });
        await loadBackups();
        await loadStorageHealth();
      } else {
        setRestoreStatus({ type: "error", message: data.error || t("restoreFailed") });
      }
    } catch {
      setRestoreStatus({ type: "error", message: t("errorDuringRestore") });
    } finally {
      setRestoringId(null);
      setConfirmRestoreId(null);
    }
  };

  const handleExportJson = async () => {
    setExportLoading(true);
    try {
      await fetchAndDownload(
        "/api/settings/export-json",
        `ZavorthGateway-settings-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
        "JSON Export failed"
      );
    } catch (err) {
      console.error("Export JSON failed:", err);
      setImportStatus({
        type: "error",
        message: t("exportFailedWithError", { error: (err as Error).message }),
      });
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportJsonClick = () => {
    jsonInputRef.current?.click();
  };

  const handleJsonSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      setImportStatus({
        type: "error",
        message: "Invalid file type. Only .json allowed.",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      try {
        setImportLoading(true);
        const res = await fetch("/api/settings/import-json", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: loadEvent.target?.result as string,
        });
        const data = await res.json();
        if (res.ok) {
          setImportStatus({
            type: "success",
            message: data.message || "Settings backup imported successfully!",
          });
          await refreshStorageAfterMutation();
        } else {
          setImportStatus({ type: "error", message: data.error || "Failed to import JSON" });
        }
      } catch {
        setImportStatus({ type: "error", message: "Error during JSON import" });
      } finally {
        setImportLoading(false);
        if (jsonInputRef.current) jsonInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      await fetchAndDownload(
        "/api/db-backups/export",
        `ZavorthGateway-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
        t("exportFailed")
      );
    } catch (err) {
      console.error("Export failed:", err);
      setImportStatus({
        type: "error",
        message: t("exportFailedWithError", { error: (err as Error).message }),
      });
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportAll = async () => {
    setExportLoading(true);
    try {
      await fetchAndDownload(
        "/api/db-backups/exportAll",
        "ZavorthGateway-full-backup.tar.gz",
        t("exportFailed")
      );
    } catch (err) {
      setImportStatus({
        type: "error",
        message: t("fullExportFailedWithError", { error: (err as Error).message }),
      });
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".sqlite")) {
      setImportStatus({
        type: "error",
        message: t("invalidFileType"),
      });
      return;
    }
    setPendingImportFile(file);
    setConfirmImport(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImportConfirm = async () => {
    if (!pendingImportFile) return;
    setImportLoading(true);
    setImportStatus({ type: "", message: "" });
    setConfirmImport(false);
    try {
      const arrayBuffer = await pendingImportFile.arrayBuffer();
      const res = await fetch(
        `/api/db-backups/import?filename=${encodeURIComponent(pendingImportFile.name)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: arrayBuffer,
        }
      );
      const data = await res.json();
      if (res.ok) {
        setImportStatus({
          type: "success",
          message: t("importSuccess", {
            connections: data.connectionCount,
            nodes: data.nodeCount,
            combos: data.comboCount,
            apiKeys: data.apiKeyCount,
          }),
        });
        await refreshStorageAfterMutation();
      } else {
        setImportStatus({ type: "error", message: data.error || t("importFailed") });
      }
    } catch {
      setImportStatus({ type: "error", message: t("errorDuringImport") });
    } finally {
      setImportLoading(false);
      setPendingImportFile(null);
    }
  };

  const handleImportCancel = () => {
    setConfirmImport(false);
    setPendingImportFile(null);
  };

  const handleClearCache = async () => {
    setClearCacheLoading(true);
    setClearCacheStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/cache", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setClearCacheStatus({
          type: "success",
          message: t("cacheCleared") || "Cache cleared successfully",
        });
      } else {
        setClearCacheStatus({
          type: "error",
          message: data.error || t("clearCacheFailed") || "Failed to clear cache",
        });
      }
    } catch {
      setClearCacheStatus({ type: "error", message: t("errorOccurred") });
    } finally {
      setClearCacheLoading(false);
    }
  };

  const handlePurgeLogs = async () => {
    setPurgeLogsLoading(true);
    setPurgeLogsStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/settings/purge-logs", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setPurgeLogsStatus({
          type: "success",
          message:
            t("logsDeleted", { count: data.deleted }) || `Purged ${data.deleted} expired log(s)`,
        });
      } else {
        setPurgeLogsStatus({
          type: "error",
          message: data.error || t("purgeLogsFailed") || "Failed to purge logs",
        });
      }
    } catch {
      setPurgeLogsStatus({ type: "error", message: t("errorOccurred") });
    } finally {
      setPurgeLogsLoading(false);
    }
  };

  const handleToggleBackups = () => {
    setBackupsExpanded((wasExpanded) => {
      const nextExpanded = !wasExpanded;
      if (nextExpanded && backups.length === 0) void loadBackups();
      return nextExpanded;
    });
  };

  useEffect(() => {
    void loadStorageHealth();
  }, []);

  return {
    backups,
    backupsExpanded,
    backupsLoading,
    clearCacheLoading,
    clearCacheStatus,
    confirmImport,
    confirmRestoreId,
    exportLoading,
    fileInputRef,
    handleClearCache,
    handleExport,
    handleExportAll,
    handleExportJson,
    handleFileSelected,
    handleImportCancel,
    handleImportClick,
    handleImportConfirm,
    handleImportJsonClick,
    handleJsonSelected,
    handleManualBackup,
    handlePurgeLogs,
    handleRestore,
    handleToggleBackups,
    importLoading,
    importStatus,
    jsonInputRef,
    loadBackups,
    manualBackupLoading,
    manualBackupStatus,
    pendingImportFile,
    purgeLogsLoading,
    purgeLogsStatus,
    restoreStatus,
    restoringId,
    setConfirmRestoreId,
    storageHealth,
    formatBackupReason: (reason: string) => formatBackupReason(reason, t),
    formatBytes,
    formatRelativeTime: (isoString: string | null | undefined) => formatRelativeTime(isoString, t),
  };
};
