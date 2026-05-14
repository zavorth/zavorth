"use client";

import { useState, useEffect } from "react";
import {
  Card,
  Button,
  Modal,
  CardSkeleton,
  ProxyConfigModal,
  EmptyState,
} from "@/shared/components";
import ModelRoutingSection from "@/shared/components/ModelRoutingSection";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useNotificationStore } from "@/store/notificationStore";
import { useTranslations } from "next-intl";
import {
  COMBO_USAGE_GUIDE_STORAGE_KEY,
  getI18nOrFallback,
  moveArrayItem,
} from "./combos-page-helpers";
import { ComboCard, ComboUsageGuide, TestResultsView } from "./combos-page-shared";
import { ComboFormModal } from "./combos-form-modal";
export default function CombosPage() {
  const t = useTranslations("combos");
  const tc = useTranslations("common");
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState(null);
  const [activeProviders, setActiveProviders] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [testResults, setTestResults] = useState(null);
  const [testingCombo, setTestingCombo] = useState(null);
  const { copied, copy } = useCopyToClipboard();
  const notify = useNotificationStore();
  const [proxyTargetCombo, setProxyTargetCombo] = useState(null);
  const [proxyConfig, setProxyConfig] = useState(null);
  const [providerNodes, setProviderNodes] = useState([]);
  const [showUsageGuide, setShowUsageGuide] = useState(true);
  const [recentlyCreatedCombo, setRecentlyCreatedCombo] = useState("");
  const [comboDragIndex, setComboDragIndex] = useState(null);
  const [comboDragOverIndex, setComboDragOverIndex] = useState(null);
  const [savingComboOrder, setSavingComboOrder] = useState(false);

  useEffect(() => {
    fetchData();
    fetch("/api/settings/proxy")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => setProxyConfig(c))
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      if (globalThis.localStorage?.getItem(COMBO_USAGE_GUIDE_STORAGE_KEY) === "1") {
        setShowUsageGuide(false);
      }
    } catch {
      // Ignore storage access errors (privacy mode / restricted environments)
    }
  }, []);

  const fetchData = async () => {
    try {
      const [combosRes, providersRes, metricsRes, nodesRes] = await Promise.all([
        fetch("/api/combos"),
        fetch("/api/providers"),
        fetch("/api/combos/metrics"),
        fetch("/api/provider-nodes"),
      ]);
      const combosData = await combosRes.json();
      const providersData = await providersRes.json();
      const metricsData = await metricsRes.json();
      const nodesData = nodesRes.ok ? await nodesRes.json() : { nodes: [] };

      if (combosRes.ok) setCombos(combosData.combos || []);
      if (providersRes.ok) {
        const active = (providersData.connections || []).filter(
          (c) => c.testStatus === "active" || c.testStatus === "success"
        );
        setActiveProviders(active);
      }
      if (metricsRes.ok) setMetrics(metricsData.metrics || {});
      setProviderNodes(nodesData.nodes || []);
    } catch (error) {
      console.log("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    try {
      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchData();
        setShowCreateModal(false);
        setRecentlyCreatedCombo(data.name?.trim() || "");
        notify.success(t("comboCreated"));
      } else {
        const err = await res.json();
        notify.error(err.error?.message || err.error || t("failedCreate"));
      }
    } catch (error) {
      notify.error(t("errorCreating"));
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      const res = await fetch(`/api/combos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchData();
        setEditingCombo(null);
        notify.success(t("comboUpdated"));
      } else {
        const err = await res.json();
        notify.error(err.error?.message || err.error || t("failedUpdate"));
      }
    } catch (error) {
      notify.error(t("errorUpdating"));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      const res = await fetch(`/api/combos/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCombos(combos.filter((c) => c.id !== id));
        notify.success(t("comboDeleted"));
      }
    } catch (error) {
      notify.error(t("errorDeleting"));
    }
  };

  const handleDuplicate = async (combo) => {
    const baseName = combo.name.replace(/-copy(-\d+)?$/, "");
    const existingNames = combos.map((c) => c.name);
    let newName = `${baseName}-copy`;
    let counter = 1;
    while (existingNames.includes(newName)) {
      counter++;
      newName = `${baseName}-copy-${counter}`;
    }

    const data = {
      name: newName,
      models: combo.models,
      strategy: combo.strategy || "priority",
      config: combo.config || {},
    };

    await handleCreate(data);
  };

  const handleTestCombo = async (combo) => {
    setTestingCombo(combo.name);
    setTestResults(null);
    try {
      const res = await fetch("/api/combos/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboName: combo.name }),
      });
      const data = await res.json();
      setTestResults(data);
    } catch (error) {
      setTestResults({ error: t("testFailed") });
      notify.error(t("testFailed"));
    }
  };

  const handleToggleCombo = async (combo) => {
    const newActive = combo.isActive === false ? true : false;
    // Optimistic update
    setCombos((prev) => prev.map((c) => (c.id === combo.id ? { ...c, isActive: newActive } : c)));
    try {
      await fetch(`/api/combos/${combo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newActive }),
      });
    } catch (error) {
      // Revert on error
      setCombos((prev) =>
        prev.map((c) => (c.id === combo.id ? { ...c, isActive: !newActive } : c))
      );
      notify.error(t("failedToggle"));
    }
  };

  const handleHideUsageGuideForever = () => {
    setShowUsageGuide(false);
    try {
      globalThis.localStorage?.setItem(COMBO_USAGE_GUIDE_STORAGE_KEY, "1");
    } catch {}
  };

  const handleShowUsageGuide = () => {
    setShowUsageGuide(true);
    try {
      globalThis.localStorage?.removeItem(COMBO_USAGE_GUIDE_STORAGE_KEY);
    } catch {}
  };

  const resetComboDragState = () => {
    setComboDragIndex(null);
    setComboDragOverIndex(null);
  };

  const handleComboDragStart = (e, index) => {
    if (savingComboOrder || combos.length < 2) {
      e.preventDefault();
      return;
    }
    setComboDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", combos[index]?.id || `${index}`);
    if (e.currentTarget instanceof HTMLElement) {
      setTimeout(() => {
        e.currentTarget.style.opacity = "0.5";
      }, 0);
    }
  };

  const handleComboDragEnd = (e) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    resetComboDragState();
  };

  const handleComboDragOver = (e, index) => {
    e.preventDefault();
    if (comboDragIndex === null || comboDragIndex === index) return;
    e.dataTransfer.dropEffect = "move";
    setComboDragOverIndex(index);
  };

  const handleComboDrop = async (e, dropIndex) => {
    e.preventDefault();
    const fromIndex = comboDragIndex;
    resetComboDragState();

    if (fromIndex === null || fromIndex === dropIndex) return;

    const previousCombos = combos;
    const nextCombos = moveArrayItem(combos, fromIndex, dropIndex);
    setCombos(nextCombos);
    setSavingComboOrder(true);

    try {
      const res = await fetch("/api/combos/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboIds: nextCombos.map((combo) => combo.id) }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || data.error || "Failed to reorder combos");
      }

      if (Array.isArray(data.combos)) {
        setCombos(data.combos);
      }
    } catch {
      setCombos(previousCombos);
      notify.error(getI18nOrFallback(t, "failedReorder", "Failed to save combo order"));
    } finally {
      setSavingComboOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-text-muted mt-1">{t("description")}</p>
        </div>
        <div className="flex items-center gap-2">
          {!showUsageGuide && (
            <Button size="sm" variant="ghost" onClick={handleShowUsageGuide}>
              {getI18nOrFallback(t, "usageGuideShow", "Show guide")}
            </Button>
          )}
          <Button icon="add" onClick={() => setShowCreateModal(true)}>
            {t("createCombo")}
          </Button>
        </div>
      </div>

      {showUsageGuide && (
        <ComboUsageGuide
          onHide={() => setShowUsageGuide(false)}
          onHideForever={handleHideUsageGuideForever}
        />
      )}

      {recentlyCreatedCombo && (
        <Card
          padding="sm"
          className="border border-emerald-500/20 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.08]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {getI18nOrFallback(
                  t,
                  "quickTestTitle",
                  `Combo "${recentlyCreatedCombo}" ready to validate`
                )}
              </p>
              <code className="inline-block text-[11px] mt-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                {recentlyCreatedCombo}
              </code>
              <p className="text-xs text-text-muted mt-0.5">
                {getI18nOrFallback(
                  t,
                  "quickTestDescription",
                  "Run a test now to confirm fallback and latency behavior."
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon="play_arrow"
                onClick={() => {
                  handleTestCombo({ name: recentlyCreatedCombo });
                  setRecentlyCreatedCombo("");
                }}
              >
                {getI18nOrFallback(t, "testNow", "Test now")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRecentlyCreatedCombo("")}>
                {tc("close")}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Model Routing Rules (#563) */}
      <ModelRoutingSection combos={combos} />

      {/* Combos List */}
      {combos.length === 0 ? (
        <EmptyState
          icon="ðŸ§©"
          title={t("noCombosYet")}
          description={t("description")}
          actionLabel={t("createCombo")}
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {combos.map((combo, index) => (
            <div
              key={combo.id}
              data-testid={`combo-card-${combo.id}`}
              onDragOver={(e) => handleComboDragOver(e, index)}
              onDrop={(e) => handleComboDrop(e, index)}
            >
              <ComboCard
                combo={combo}
                metrics={metrics[combo.name]}
                providerNodes={providerNodes}
                copied={copied}
                onCopy={copy}
                onEdit={() => setEditingCombo(combo)}
                onDelete={() => handleDelete(combo.id)}
                onDuplicate={() => handleDuplicate(combo)}
                onTest={() => handleTestCombo(combo)}
                testing={testingCombo === combo.name}
                onProxy={() => setProxyTargetCombo(combo)}
                hasProxy={!!proxyConfig?.combos?.[combo.id]}
                onToggle={() => handleToggleCombo(combo)}
                dragDisabled={savingComboOrder || combos.length < 2}
                isDragged={comboDragIndex === index}
                isDropTarget={comboDragOverIndex === index && comboDragIndex !== index}
                onDragStart={(e) => handleComboDragStart(e, index)}
                onDragEnd={handleComboDragEnd}
              />
            </div>
          ))}
        </div>
      )}

      {/* Test Results Modal */}
      {testResults && (
        <Modal
          isOpen={!!testResults}
          onClose={() => {
            setTestResults(null);
            setTestingCombo(null);
          }}
          title={t("testResults", { name: testingCombo })}
        >
          <TestResultsView results={testResults} />
        </Modal>
      )}

      {/* Create Modal */}
      <ComboFormModal
        key="create"
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreate}
        activeProviders={activeProviders}
        combo={null}
      />

      {/* Edit Modal */}
      <ComboFormModal
        key={editingCombo?.id || "new"}
        isOpen={!!editingCombo}
        combo={editingCombo}
        onClose={() => setEditingCombo(null)}
        onSave={(data) => handleUpdate(editingCombo.id, data)}
        activeProviders={activeProviders}
      />

      {/* Proxy Config Modal */}
      {proxyTargetCombo && (
        <ProxyConfigModal
          isOpen={!!proxyTargetCombo}
          onClose={() => setProxyTargetCombo(null)}
          level="combo"
          levelId={proxyTargetCombo.id}
          levelLabel={proxyTargetCombo.name}
        />
      )}
    </div>
  );
}

