"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { Card, CardSkeleton, Button } from "@/shared/components";
import { AI_PROVIDERS, FREE_PROVIDERS, OAUTH_PROVIDERS } from "@/shared/constants/providers";
import ZavorthGatewayLogo from "@/shared/components/ZavorthGatewayLogo";
import { useNotificationStore } from "@/store/notificationStore";
import { ProviderModelsModal } from "./home-page/ProviderModelsModal";
import { ProviderOverviewCard } from "./home-page/ProviderOverviewCard";
import { UpdateProgressOverlay } from "./home-page/UpdateProgressOverlay";
import { mergeUpdateStep, wait, type UpdateStep } from "./home-page/updateProgress";

export default function HomePageClient({ machineId }) {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const ts = useTranslations("sidebar");
  const [providerConnections, setProviderConnections] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState("/v1");
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [providerMetrics, setProviderMetrics] = useState({});
  const [productSnapshot, setProductSnapshot] = useState<any>(null);
  const [runtimeReadiness, setRuntimeReadiness] = useState<any>(null);
  const [runtimeGuidedFixes, setRuntimeGuidedFixes] = useState<any>(null);
  const [swarmSnapshot, setSwarmSnapshot] = useState<any>(null);

  const [versionInfo, setVersionInfo] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [updateSteps, setUpdateSteps] = useState<UpdateStep[]>([]);
  const [updatePhase, setUpdatePhase] = useState<"idle" | "running" | "done" | "failed">("idle");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(`${window.location.origin}/v1`);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [provRes, modelsRes, metricsRes, versionRes, readinessRes, guidedFixesRes, swarmRes] = await Promise.all([
        fetch("/api/providers"),
        fetch("/api/models"),
        fetch("/api/provider-metrics"),
        fetch("/api/system/version"),
        fetch("/api/runtime/readiness"),
        fetch("/api/runtime/readiness/fixes"),
        fetch("/api/web/gateway/swarm-v2"),
      ]);
      const productRes = await fetch("/api/productization/protected-runtime?mode=personal&detail=simple");
      if (provRes.ok) {
        const provData = await provRes.json();
        setProviderConnections(provData.connections || []);
      }
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        setModels(modelsData.models || []);
      }
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setProviderMetrics(metricsData.metrics || {});
      }
      if (versionRes.ok) {
        const versionData = await versionRes.json();
        setVersionInfo(versionData);
      }
      if (productRes.ok) {
        const productData = await productRes.json();
        setProductSnapshot(productData);
      }
      if (readinessRes.ok) {
        const readinessData = await readinessRes.json();
        setRuntimeReadiness(readinessData.runtimeReadinessUx || null);
      }
      if (guidedFixesRes.ok) {
        const guidedFixesData = await guidedFixesRes.json();
        setRuntimeGuidedFixes(guidedFixesData.runtimeGuidedFixes || null);
      }
      if (swarmRes.ok) {
        const swarmData = await swarmRes.json();
        setSwarmSnapshot(swarmData);
      } else {
        setSwarmSnapshot({ ok: false, swarms: [] });
      }
    } catch (e) {
      console.log("Error fetching data:", e);
      setSwarmSnapshot({ ok: false, swarms: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const providerStats = useMemo(() => {
    return Object.entries(AI_PROVIDERS).map(([providerId, providerInfo]) => {
      const connections = providerConnections.filter((conn) => conn.provider === providerId);
      const connected = connections.filter(
        (conn) =>
          conn.isActive !== false &&
          (conn.testStatus === "active" ||
            conn.testStatus === "success" ||
            conn.testStatus === "unknown")
      ).length;
      const errors = connections.filter(
        (conn) =>
          conn.isActive !== false &&
          (conn.testStatus === "error" ||
            conn.testStatus === "expired" ||
            conn.testStatus === "unavailable")
      ).length;

      const providerKeys = new Set([providerId, providerInfo.alias].filter(Boolean));
      const providerModels = models.filter((m) => providerKeys.has(m.provider));

      const authType = FREE_PROVIDERS[providerId]
        ? "free"
        : OAUTH_PROVIDERS[providerId]
          ? "oauth"
          : "apikey";

      return {
        id: providerId,
        provider: providerInfo,
        total: connections.length,
        connected,
        errors,
        modelCount: providerModels.length,
        authType,
      };
    });
  }, [providerConnections, models]);

  const selectedProviderModels = useMemo(() => {
    if (!selectedProvider) return [];
    const providerKeys = new Set(
      [selectedProvider.id, selectedProvider.provider?.alias].filter(Boolean)
    );
    return models.filter((model) => providerKeys.has(model.provider));
  }, [selectedProvider, models]);

  const configuredProvidersCount = useMemo(
    () => providerStats.filter((item) => item.total > 0).length,
    [providerStats]
  );

  const healthyConnectionsCount = useMemo(
    () =>
      providerConnections.filter(
        (conn) =>
          conn.isActive !== false &&
          (conn.testStatus === "active" ||
            conn.testStatus === "success" ||
            conn.testStatus === "unknown")
      ).length,
    [providerConnections]
  );

  const attentionProvidersCount = useMemo(
    () => providerStats.filter((item) => item.errors > 0).length,
    [providerStats]
  );

  const oauthReadyCount = useMemo(
    () => providerStats.filter((item) => item.authType === "oauth" && item.connected > 0).length,
    [providerStats]
  );

  const providerSignal =
    healthyConnectionsCount > 0
      ? { value: `${healthyConnectionsCount} ready`, tone: "ready", detail: "A provider is available for live work." }
      : configuredProvidersCount > 0
        ? { value: "Needs test", tone: "attention", detail: "Provider credentials exist, but a health test is recommended." }
        : { value: "Setup needed", tone: "attention", detail: "Connect OpenAI, Gemini, Ollama or another provider when you need live model calls." };

  const sandboxSignal = productSnapshot?.sandbox?.doctor
    ? {
        value: productSnapshot.sandbox.doctor.simpleStatus === "ready" ? "Ready" : "Preview only",
        tone: productSnapshot.sandbox.doctor.simpleStatus === "ready" ? "ready" : "attention",
        detail: productSnapshot.sandbox.doctor.safeDefault,
      }
    : {
        value: "Checking",
        tone: "neutral",
        detail: "Doctor will explain whether Docker, gVisor or another sandbox is ready.",
      };

  const channelSignal = {
    value: "Web + CLI",
    tone: "ready",
    detail: "Start here. Add Telegram or other channels only when you need them.",
  };

  const approvalsSignal = productSnapshot?.receipt?.summary
    ? {
        value: `${productSnapshot.receipt.summary.approvals || 0} pending`,
        tone: productSnapshot.receipt.summary.approvals > 0 ? "attention" : "ready",
        detail:
          productSnapshot.receipt.summary.approvals > 0
            ? "Sensitive work will wait for a scoped decision."
            : "No pending decision in the starter mission.",
      }
    : {
        value: "0 pending",
        tone: "ready",
        detail: "Approvals appear here when a mission needs permission.",
      };

  const readinessTone = runtimeReadiness?.status || "attention";
  const readinessToneClass =
    readinessTone === "ready"
      ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-300"
      : readinessTone === "blocked"
        ? "border-red-500/25 bg-red-500/[0.08] text-red-600 dark:text-red-300"
        : "border-amber-500/25 bg-amber-500/[0.08] text-amber-600 dark:text-amber-300";
  const runtimeReadinessHighlights = (runtimeReadiness?.cards || [])
    .filter((card) => card.status !== "ready")
    .concat((runtimeReadiness?.cards || []).filter((card) => card.status === "ready"))
    .slice(0, 4);
  const runtimeReadinessActionHref =
    runtimeReadiness?.primaryAction?.route ||
    runtimeReadiness?.dashboardProjection?.route ||
    "/dashboard/health";
  const runtimeGuidedFixHighlights = (runtimeGuidedFixes?.fixes || []).slice(0, 3);
  const swarmRuns = Array.isArray(swarmSnapshot?.swarms) ? swarmSnapshot.swarms : [];
  const activeSwarms = swarmRuns.filter((swarm) => swarm?.status === "running");
  const latestSwarm = activeSwarms[0] || swarmRuns[0] || null;
  const latestSwarmRoles = Array.isArray(latestSwarm?.roles) ? latestSwarm.roles : [];
  const latestSwarmMetrics = latestSwarm?.metrics || null;
  const swarmTone =
    swarmSnapshot?.ok === false
      ? "attention"
      : activeSwarms.length > 0
        ? "active"
        : "ready";
  const swarmToneClass =
    swarmTone === "active"
      ? "border-primary/25 bg-primary/[0.08] text-primary"
      : swarmTone === "attention"
        ? "border-amber-500/25 bg-amber-500/[0.08] text-amber-600 dark:text-amber-300"
        : "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-300";
  const swarmStatusLabel =
    swarmTone === "active"
      ? `${activeSwarms.length} running`
      : swarmTone === "attention"
        ? "Unavailable"
        : "Ready";
  const swarmStatusDetail =
    latestSwarm?.objective ||
    (swarmTone === "attention"
      ? "Swarm status could not be loaded."
      : "No multi-agent run is active right now.");
  const swarmRoleProgress = latestSwarmMetrics
    ? `${latestSwarmMetrics.completedRoles}/${latestSwarmMetrics.totalRoles} roles`
    : `${latestSwarmRoles.length} roles`;
  const swarmBatchProgress = latestSwarmMetrics
    ? `${latestSwarmMetrics.completedBatchCount}/${latestSwarmMetrics.batchCount} batches`
    : "queue ready";

  const basicStatus = [
    { icon: "psychology", label: "Provider", ...providerSignal, href: "/dashboard/providers" },
    { icon: "shield_lock", label: "Sandbox", ...sandboxSignal, href: "/dashboard/health" },
    { icon: "hub", label: "Channels", ...channelSignal, href: "/dashboard/cli-tools" },
    {
      icon: "account_tree",
      label: "Swarm",
      value: swarmStatusLabel,
      tone: swarmTone === "attention" ? "attention" : "ready",
      detail: swarmStatusDetail,
      href: "/dashboard/cli-tools",
    },
    { icon: "verified_user", label: "Approvals", ...approvalsSignal, href: "/dashboard/logs" },
  ];

  const homeAreas = [
    {
      id: "inbox",
      title: "Inbox",
      summary: "Requests, messages and items waiting for your attention.",
      icon: "inbox",
      href: "/dashboard",
      status: "Start here",
      action: "Ask or resume",
    },
    {
      id: "tasks",
      title: "Tasks",
      summary: "Guided missions, active work and the next safe step.",
      icon: "checklist",
      href: "/dashboard/cli-tools",
      status: "Preview first",
      action: "Pick a mission",
    },
    {
      id: "approvals",
      title: "Approvals",
      summary: "Sensitive actions wait for a scoped yes or no.",
      icon: "rule",
      href: "/dashboard/logs",
      status: approvalsSignal.value,
      action: "Review decisions",
    },
    {
      id: "receipts",
      title: "Receipts",
      summary: "Proof of what happened, what was blocked and why.",
      icon: "receipt_long",
      href: "/dashboard/logs",
      status: "Evidence",
      action: "Read proof",
    },
    {
      id: "connectors",
      title: "Connectors",
      summary: "Providers and channels connected without exposing raw secrets.",
      icon: "hub",
      href: "/dashboard/providers",
      status: configuredProvidersCount > 0 ? `${configuredProvidersCount} setup` : "Setup needed",
      action: "Connect safely",
    },
  ];

  const permissionPanelItems = [
    {
      id: "permissions",
      label: "Permissões",
      summary: "Pendentes, aprovadas, recusadas e expiradas em uma fila só.",
      icon: "verified_user",
      href: "/dashboard/logs",
      status: approvalsSignal.value,
      action: "Review",
      risk: "low",
    },
    {
      id: "auto-approvals",
      label: "Auto-aprovações",
      summary: "Regras persistentes com escopo, prazo, limite e recibo.",
      icon: "rule_settings",
      href: "/dashboard/settings",
      status: "Limited",
      action: "Manage",
      risk: "medium",
    },
    {
      id: "extreme-mode",
      label: "Modo extremo",
      summary: "Break-glass com confirmação forte e bloqueios de catástrofe.",
      icon: "emergency_home",
      href: "/dashboard/settings",
      status: "Guarded",
      action: "Inspect",
      risk: "critical",
    },
    {
      id: "revoke",
      label: "Revogar",
      summary: "Corte permissões persistentes, canais ou sessões sensíveis.",
      icon: "lock_reset",
      href: "/dashboard/settings",
      status: "Fast off",
      action: "Revoke",
      risk: "medium",
    },
    {
      id: "receipts",
      label: "Receipts",
      summary: "Prova legível para cada decisão sensível.",
      icon: "receipt_long",
      href: "/dashboard/logs",
      status: "Audit",
      action: "Open proof",
      risk: "low",
    },
  ];

  const memoryPanelItems = [
    {
      id: "memory-health",
      label: "Memory Health",
      summary: "Wiki lint, source links and secret checks before memory is trusted.",
      icon: "neurology",
      command: "zavorth memory mnemos",
      status: "Read-only",
    },
    {
      id: "procedural-rules",
      label: "Procedural Rules",
      summary: "Operator habits become scoped, reviewable and revocable rules.",
      icon: "rule_folder",
      command: "zavorth memory procedural list",
      status: "Approval gated",
    },
    {
      id: "wiki-query",
      label: "Wiki Query",
      summary: "Ask synthesized memory with top-k context instead of raw dumps.",
      icon: "manage_search",
      command: "zavorth memory mnemos query",
      status: "Safe recall",
    },
  ];

  const firstSteps = [
    {
      id: "setup",
      label: "Setup",
      summary: "Preview profile, workspace and safety defaults.",
      command: "zavorth setup --dry-run",
      href: "/dashboard/onboarding",
      icon: "tune",
      optional: false,
    },
    {
      id: "go",
      label: "Go",
      summary: "Open or return to this Home for daily use.",
      command: "zavorth go",
      href: "/dashboard",
      icon: "home",
      optional: false,
    },
    {
      id: "demo",
      label: "Demo",
      summary: "Optional browser visual and guided demo.",
      command: "zavorth demo browser",
      href: "/dashboard?demo=guided",
      icon: "play_circle",
      optional: true,
    },
    {
      id: "connectors",
      label: "Connectors",
      summary: "Check GitHub, Telegram and Discord setup.",
      command: "zavorth connectors doctor",
      href: "/dashboard/providers",
      icon: "hub",
      optional: true,
    },
  ];

  const experienceProfiles = [
    {
      id: "personal",
      title: "Personal",
      summary: "Daily help, reminders, files, messages and safe organization.",
      icon: "home",
      href: "/dashboard/onboarding?profile=personal",
    },
    {
      id: "developer",
      title: "Developer",
      summary: "Repository review, tests, patches, receipts and rollback evidence.",
      icon: "code_blocks",
      href: "/dashboard/cli-tools",
    },
    {
      id: "business",
      title: "Business",
      summary: "Approvals, audit trails, channels, reports and governed execution.",
      icon: "business_center",
      href: "/dashboard/health",
    },
  ];

  const postureSignals = [
    {
      icon: "dns",
      label: "Configured providers",
      value: configuredProvidersCount,
      detail: `${providerStats.length} available in the catalog`,
    },
    {
      icon: "health_and_safety",
      label: "Healthy connections",
      value: healthyConnectionsCount,
      detail:
        attentionProvidersCount > 0
          ? `${attentionProvidersCount} provider lane(s) need attention`
          : "No provider lanes are currently alerting",
    },
    {
      icon: "account_tree",
      label: "Model catalog",
      value: models.length,
      detail: `${oauthReadyCount} OAuth-backed provider lane(s) ready`,
    },
    {
      icon: "deployed_code",
      label: "Runtime channel",
      value: versionInfo?.current ? `v${versionInfo.current}` : "Checking",
      detail: machineId ? `Node ${machineId}` : "Local operator node",
    },
  ];

  const operatorActions = [
    {
      label: ts("providers"),
      href: "/dashboard/providers",
      icon: "dns",
      description: "Connect upstream accounts, test health, and review provider posture.",
    },
    {
      label: ts("endpoint"),
      href: "/dashboard/endpoint",
      icon: "link",
      description: "Expose the Zavorth endpoint, auth mode, and compatibility surface.",
    },
    {
      label: ts("cliTools"),
      href: "/dashboard/cli-tools",
      icon: "terminal",
      description: "Configure local developer tools without losing gateway policy control.",
    },
    {
      label: ts("analytics"),
      href: "/dashboard/analytics",
      icon: "monitoring",
      description: "Inspect usage, latency, and routing quality before issues spread.",
    },
  ];

  const quickLinks = [
    { label: "Documentation", href: "/docs", icon: "menu_book" },
    { label: ts("combos"), href: "/dashboard/combos", icon: "layers" },
    { label: t("healthMonitor"), href: "/dashboard/health", icon: "health_and_safety" },
    {
      label: "Report an issue",
      href: "https://github.com/greyvritra/zavorth/issues",
      external: true,
      icon: "bug_report",
    },
  ];

  const guidedStarts =
    productSnapshot?.templates?.length > 0
      ? productSnapshot.templates.slice(0, 6).map((template) => ({
          label: template.label,
          description: template.summary || template.prompt,
          prompt: template.prompt,
          href: `/dashboard?template=${encodeURIComponent(template.id)}`,
          icon:
            template.id === "dev-repo-review"
              ? "code_blocks"
              : template.id === "pdf-summary"
                ? "picture_as_pdf"
                : template.id === "daily-assistant"
                  ? "event_available"
                  : template.id === "safe-audit"
                    ? "policy"
                    : "auto_awesome",
          risk: template.defaultRisk || "low",
        }))
      : [
    {
      label: "Organize my day",
      description: "Turn scattered tasks into a simple plan before anything is sent or changed.",
      prompt: "Help me organize my day safely.",
      href: "/dashboard",
      icon: "event_available",
      risk: "Low",
    },
    {
      label: "Review a repository",
      description: "Read first, find risks, then ask before patches or commands.",
      prompt: "Review this repository and show me the risks first.",
      href: "/dashboard/cli-tools",
      icon: "code_blocks",
      risk: "Medium",
    },
    {
      label: "Connect a channel",
      description: "Set up Telegram, email or another channel with guided SecretRef handling.",
      prompt: "Help me connect a channel.",
      href: "/dashboard/providers",
      icon: "hub",
      risk: "Medium",
    },
    {
      label: "Check readiness",
      description: "See what is ready, blocked or waiting for setup without live probes.",
      prompt: "What is ready and what still needs setup?",
      href: "/dashboard/health",
      icon: "fact_check",
      risk: "Low",
    },
  ];

  const runtimeQuestions = [
    "Which providers are ready?",
    "Which channels can I use now?",
    "Do I have pending approvals?",
    "What can Zavorth do without asking first?",
  ];

  const pollBackgroundUpdate = useCallback(
    async ({
      channel,
      message,
      targetVersion,
    }: {
      channel: string;
      message: string;
      targetVersion: string;
    }) => {
      const notify = useNotificationStore.getState();
      const initialSteps =
        channel === "docker-compose"
          ? [
              {
                step: "install",
                status: "done",
                message: message || `Queued Zavorth runtime update to v${targetVersion}.`,
              },
              {
                step: "rebuild",
                status: "running",
                message: "Container image is rebuilding in the background.",
              },
              {
                step: "restart",
                status: "pending",
                message: "Waiting for the Zavorth service to come back online.",
              },
            ]
          : [
              {
                step: "install",
                status: "running",
                message: message || `Installing Zavorth runtime v${targetVersion}.`,
              },
              {
                step: "restart",
                status: "pending",
                message: "Waiting for the Zavorth service to come back online.",
              },
            ];

      setUpdateSteps(initialSteps);

      const maxAttempts = channel === "docker-compose" ? 72 : 36;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await wait(5000);

        try {
          const versionRes = await fetch("/api/system/version", { cache: "no-store" });
          if (!versionRes.ok) {
            throw new Error(`Version check returned ${versionRes.status}`);
          }

          const latestInfo = await versionRes.json();
          setVersionInfo(latestInfo);

          if (latestInfo.current === targetVersion) {
            setUpdateSteps((prev) => {
              let next = prev.map((step) => {
                if (step.step === "install" || step.step === "rebuild" || step.step === "restart") {
                  return { ...step, status: "done" };
                }
                return step;
              });

              next = mergeUpdateStep(next, {
                step: "complete",
                status: "done",
                message: `Zavorth is now running v${targetVersion}.`,
              });

              return next;
            });
            setUpdating(false);
            setUpdatePhase("done");
            notify.success(`Zavorth updated to v${targetVersion}.`);
            await fetchData();
            return;
          }

          setUpdateSteps((prev) => {
            let next = prev;
            if (channel === "docker-compose") {
              next = mergeUpdateStep(next, {
                step: "rebuild",
                status: "running",
                message: `Container image is still rebuilding for v${targetVersion}.`,
              });
            } else {
              next = mergeUpdateStep(next, {
                step: "install",
                status: "running",
                message: `Installing Zavorth runtime v${targetVersion} in the background.`,
              });
            }

            next = mergeUpdateStep(next, {
              step: "restart",
              status: "pending",
              message: `Waiting for Zavorth to return on v${targetVersion}.`,
            });

            return next;
          });
        } catch {
          setUpdateSteps((prev) => {
            let next = prev;
            if (channel === "docker-compose") {
              next = mergeUpdateStep(next, {
                step: "rebuild",
                status: "running",
                message: "Container rebuild is still in progress.",
              });
            } else {
              next = mergeUpdateStep(next, {
                step: "install",
                status: "running",
                message: `Installing Zavorth runtime v${targetVersion} in the background.`,
              });
            }

            next = mergeUpdateStep(next, {
              step: "restart",
              status: "running",
              message: "Restart in progress. Waiting for Zavorth to come back online.",
            });

            return next;
          });
        }
      }

      setUpdateSteps((prev) =>
        mergeUpdateStep(prev, {
          step: "error",
          status: "failed",
          message: `Update started, but v${targetVersion} did not become available before timeout. Refresh the page or inspect service logs.`,
        })
      );
      setUpdating(false);
      setUpdatePhase("failed");
      notify.error(`Update to v${targetVersion} timed out.`);
    },
    [fetchData]
  );

  const handleUpdate = async () => {
    const notify = useNotificationStore.getState();
    setUpdating(true);
    setUpdatePhase("running");
    setUpdateSteps([]);

    try {
      const res = await fetch("/api/system/version", { method: "POST" });

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (!res.ok || !data.success) {
          notify.error(data.error || "Failed to start update.");
          setUpdating(false);
          setUpdatePhase("idle");
          return;
        }
        notify.success(data.message || "Update started.");
        await pollBackgroundUpdate({
          channel: data.channel || "docker-compose",
          message: data.message || "",
          targetVersion: data.to || data.latest,
        });
        return;
      }

      if (!res.body) {
        notify.error("No response stream received.");
        setUpdating(false);
        setUpdatePhase("idle");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            setUpdateSteps((prev) => mergeUpdateStep(prev, event));

            if (event.step === "complete") {
              setUpdatePhase("done");
              setUpdating(false);
              notify.success(event.message || "Update complete.");
            } else if (event.step === "error") {
              setUpdatePhase("failed");
              notify.error(event.message || "Update failed.");
              setUpdating(false);
            }
          } catch {
            // Keep listening even if one streamed progress event is malformed.
          }
        }
      }
    } catch {
      setUpdatePhase("failed");
      setUpdateSteps((prev) => [
        ...prev,
        {
          step: "error",
          status: "failed",
          message: "Network error - connection lost during update.",
        },
      ]);
      setUpdating(false);
    }
  };

  useEffect(() => {
    if (updatePhase !== "done") return;
    const timer = setTimeout(() => {
      window.location.reload();
    }, 8000);
    return () => clearTimeout(timer);
  }, [updatePhase]);

  const showUpdateOverlay = updatePhase !== "idle";
  const identityMarkers = [
    "Zavorth Control Plane",
    "operator surface",
    "Open provider arena",
    "Inspect endpoint surface",
  ];

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const currentEndpoint = baseUrl;

  return (
    <div className="flex flex-col gap-8">
      <span className="sr-only">{identityMarkers.join(" | ")}</span>
      <UpdateProgressOverlay
        updatePhase={updatePhase}
        updateSteps={updateSteps}
        onClose={() => {
          setUpdating(false);
          setUpdatePhase("idle");
          setUpdateSteps([]);
          if (updatePhase === "done") window.location.reload();
        }}
        onRetry={handleUpdate}
      />

      <Card className="border-primary/15 bg-surface shadow-sm">
        <div className="relative grid gap-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
              <ZavorthGatewayLogo size={16} className="text-primary" />
              Zavorth Home
            </div>

            <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-text-main sm:text-4xl">
              Chat, Overview, Channels, Approvals and Receipts.
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">
              Zavorth is ready. Start with the thing you need, ask naturally, and Zavorth will show a
              preview, ask when it matters, then leave a receipt you can inspect later.
            </p>

            <div className="mt-5 flex flex-col gap-4 rounded-lg border border-border bg-bg-subtle/60 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${readinessToneClass}`}>
                    {runtimeReadiness?.statusLabel || "Atencao"}
                  </span>
                  <p className="text-sm font-semibold text-text-main">
                    {runtimeReadiness?.headline || "Zavorth readiness is loading."}
                  </p>
                </div>
                <p className="mt-2 text-xs leading-5 text-text-muted">
                  {runtimeReadiness?.subhead || "Checking provider, dashboard, Telegram, approvals, skills, memory and transaction safety."}
                </p>
                {runtimeReadinessHighlights.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {runtimeReadinessHighlights.map((card) => (
                      <span
                        key={card.id}
                        className="rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-muted"
                      >
                        {card.title}: {card.statusLabel}
                      </span>
                    ))}
                  </div>
                )}
                {runtimeGuidedFixHighlights.length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {runtimeGuidedFixHighlights.map((fix) => (
                      <div
                        key={fix.id}
                        className="min-w-0 rounded-md border border-border bg-surface px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-semibold text-text-main">{fix.label}</p>
                          {fix.route && (
                            <Link
                              href={fix.route}
                              className="shrink-0 text-[11px] font-semibold text-primary"
                            >
                              Abrir
                            </Link>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-text-muted">
                          {fix.summary}
                        </p>
                        {fix.command && (
                          <code className="mt-2 block overflow-hidden text-ellipsis rounded bg-bg-subtle px-2 py-1 text-[10px] text-text-muted">
                            {fix.command}
                          </code>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Link
                href={runtimeReadinessActionHref}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-main transition-colors hover:bg-surface"
              >
                {runtimeReadiness?.primaryAction?.label || "Ver readiness"}
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>

            <div className="mt-5 rounded-lg border border-border bg-bg-subtle/60 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-[17px]">account_tree</span>
                    </div>
                    <p className="text-sm font-semibold text-text-main">Swarm</p>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${swarmToneClass}`}>
                      {swarmStatusLabel}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-text-muted">
                    {swarmStatusDetail}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <span className="rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-muted">
                    {swarmRuns.length} total
                  </span>
                  <span className="rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-muted">
                    {swarmRoleProgress}
                  </span>
                  <span className="rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-muted">
                    {swarmBatchProgress}
                  </span>
                  <span className="rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-muted">
                    {latestSwarm?.official ? "official" : "legacy"}
                  </span>
                  <span className="rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-muted">
                    {latestSwarm?.swarmId ? `id ${String(latestSwarm.swarmId).slice(0, 8)}` : "no run"}
                  </span>
                  <Link
                    href="/dashboard/cli-tools"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-surface hover:text-text-main"
                  >
                    Agents
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-border bg-bg-subtle/60 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-[17px]">admin_panel_settings</span>
                    </div>
                    <p className="text-sm font-semibold text-text-main">Permissões</p>
                    <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                      Governed
                    </span>
                  </div>
                  <p className="mt-2 max-w-2xl text-xs leading-5 text-text-muted">
                    Auto-aprovações, modo extremo e revogações aparecem como controle de confiança,
                    não como atalho silencioso para executar ações sensíveis.
                  </p>
                </div>
                <Link
                  href="/dashboard/logs"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-surface hover:text-text-main"
                >
                  Receipts
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {permissionPanelItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="group rounded-lg border border-border bg-surface/80 p-3 transition-colors hover:border-primary/25 hover:bg-surface"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                          item.risk === "critical"
                            ? "border-red-500/25 bg-red-500/[0.08] text-red-600 dark:text-red-300"
                            : item.risk === "medium"
                              ? "border-amber-500/25 bg-amber-500/[0.08] text-amber-600 dark:text-amber-300"
                              : "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-300"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-text-main">{item.label}</p>
                    <p className="mt-1 min-h-[40px] text-xs leading-5 text-text-muted">{item.summary}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      {item.action}
                      <span className="material-symbols-outlined text-[14px] transition-transform group-hover:translate-x-0.5">
                        arrow_forward
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-border bg-bg-subtle/60 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-[17px]">neurology</span>
                    </div>
                    <p className="text-sm font-semibold text-text-main">Mnemos Memory</p>
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-300">
                      Governed
                    </span>
                  </div>
                  <p className="mt-2 max-w-2xl text-xs leading-5 text-text-muted">
                    Memory Health, Procedural Rules and Wiki Query stay visible without giving the
                    dashboard silent write authority.
                  </p>
                </div>
                <Link
                  href="/dashboard/logs"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-surface hover:text-text-main"
                >
                  Memory receipts
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-3">
                {memoryPanelItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border bg-surface/80 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                      </div>
                      <span className="rounded-full border border-border bg-bg-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-text-main">{item.label}</p>
                    <p className="mt-1 min-h-[40px] text-xs leading-5 text-text-muted">{item.summary}</p>
                    <code className="mt-3 block overflow-hidden text-ellipsis rounded bg-bg-subtle px-2 py-1 text-[10px] text-text-muted">
                      {item.command}
                    </code>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-7 rounded-lg border border-primary/15 bg-primary/[0.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text-main">Primeiros passos</p>
                  <p className="mt-1 text-xs leading-5 text-text-muted">
                    Setup is onboarding, Go is daily use, and Demo is optional.
                  </p>
                </div>
                <Link
                  href="/dashboard/providers"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-surface hover:text-text-main"
                >
                  Connectors
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {firstSteps.map((step) => (
                  <Link
                    key={step.id}
                    href={step.href}
                    className="group rounded-lg border border-border bg-surface/80 p-3 transition-colors hover:border-primary/25 hover:bg-surface"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-[18px]">{step.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-text-main">{step.label}</p>
                          {step.optional && (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                              Optional
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-text-muted">{step.summary}</p>
                        <code className="mt-2 block truncate rounded-md bg-bg-subtle px-2 py-1 text-[11px] text-text-muted">
                          {step.command}
                        </code>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {homeAreas.map((area) => (
                <Link
                  key={area.id}
                  href={area.href}
                  className="group flex min-h-[188px] flex-col justify-between rounded-lg border border-border bg-bg-subtle/70 p-4 transition-all hover:border-primary/25 hover:bg-surface"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-[19px]">{area.icon}</span>
                      </div>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                        {area.status}
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-text-main">{area.title}</p>
                    <p className="mt-2 text-xs leading-5 text-text-muted">{area.summary}</p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    {area.action}
                    <span className="material-symbols-outlined text-[14px] transition-transform group-hover:translate-x-0.5">
                      arrow_forward
                    </span>
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-7 grid gap-3 lg:grid-cols-3">
              {experienceProfiles.map((profile) => (
                <Link
                  key={profile.id}
                  href={profile.href}
                  className="group rounded-lg border border-black/5 bg-bg-subtle/60 p-4 transition-all hover:border-primary/25 hover:bg-surface dark:border-white/10"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-[19px]">{profile.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-main">{profile.title}</p>
                      <p className="mt-1 text-xs leading-5 text-text-muted">{profile.summary}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </Card>

      {versionInfo?.updateAvailable && !showUpdateOverlay && (
        <div className="flex min-h-[72px] items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/[0.08] px-5 py-4 text-primary">
          <div className="flex items-center gap-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/[0.12]">
              <span className="material-symbols-outlined text-[22px]">system_update_alt</span>
            </div>
            <div>
              <p className="text-sm font-semibold">Zavorth runtime update ready: v{versionInfo.latest}</p>
              <p className="mt-0.5 text-xs opacity-80">
                {versionInfo.autoUpdateSupported
                  ? `Current Zavorth service is v${versionInfo.current}. Apply the update to refresh fixes and capabilities.`
                  : versionInfo.autoUpdateError ||
                    "Manual update required for this installation type."}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={versionInfo.autoUpdateSupported ? handleUpdate : undefined}
            disabled={updating || !versionInfo.autoUpdateSupported}
            className="shrink-0 font-semibold"
            title={versionInfo.autoUpdateError || ""}
          >
            {versionInfo.autoUpdateSupported ? "Apply update" : "Manual update"}
          </Button>
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Guided missions</h2>
              <p className="text-sm text-text-muted">
                Pick a safe starting point. Each mission begins with preview, risk and a receipt.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {guidedStarts.map((mission) => (
              <Link
                key={mission.label}
                href={mission.href}
                className="group rounded-2xl border border-border bg-bg-subtle/70 p-4 transition-all hover:border-primary/25 hover:bg-surface"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-[18px]">{mission.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-text-main">{mission.label}</p>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                        {mission.risk}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-text-muted">{mission.description}</p>
                    <p className="mt-3 line-clamp-2 rounded-xl bg-surface/80 px-3 py-2 text-xs text-text-muted">
                      {mission.prompt}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <div>
            <h2 className="text-lg font-semibold">Ask naturally</h2>
            <p className="text-sm text-text-muted">
              You can ask these directly in chat, CLI or a connected channel. They are read-only.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {runtimeQuestions.map((question) => (
              <div
                key={question}
                className="rounded-2xl border border-border bg-bg-subtle/70 px-4 py-3"
              >
                <p className="text-sm font-medium text-text-main">{question}</p>
                <p className="mt-2 text-xs leading-5 text-text-muted">
                  Zavorth answers from the current runtime state and explains what still needs setup.
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <details className="group rounded-2xl border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-text-main">Advanced details</p>
            <p className="mt-1 text-xs text-text-muted">
              Provider health, endpoint details, node identity and operator shortcuts.
            </p>
          </div>
          <span className="material-symbols-outlined text-[20px] text-text-muted transition-transform group-open:rotate-180">
            expand_more
          </span>
        </summary>

        <div className="grid gap-8 border-t border-border p-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-3 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-5">
            {basicStatus.map((signal) => (
              <Link
                key={signal.label}
                href={signal.href}
                className="rounded-lg border border-border bg-bg-subtle/70 p-4 transition-colors hover:border-primary/25 hover:bg-surface"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      {signal.label}
                    </p>
                    <p
                      className={`mt-3 text-lg font-semibold tracking-tight ${
                        signal.tone === "attention" ? "text-amber-500" : "text-text-main"
                      }`}
                    >
                      {signal.value}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-text-muted">{signal.detail}</p>
                  </div>
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-[18px]">{signal.icon}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Operator actions</h2>
                <p className="text-sm text-text-muted">
                  Move through the detailed surfaces that shape routing, access, and resilience.
                </p>
              </div>
              <Link
                href="/docs"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-main"
              >
                <span className="material-symbols-outlined text-[14px]">menu_book</span>
                Documentation
              </Link>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {operatorActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group rounded-2xl border border-border bg-bg-subtle/70 p-4 transition-all hover:border-primary/25 hover:bg-surface"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-[18px]">{action.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-main">{action.label}</p>
                      <p className="mt-1 text-xs leading-5 text-text-muted">{action.description}</p>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                        Open surface
                        <span className="material-symbols-outlined text-[14px] transition-transform group-hover:translate-x-0.5">
                          arrow_forward
                        </span>
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Runtime details</h2>
                <p className="text-sm text-text-muted">
                  Endpoint, node identity and deeper operator surfaces.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-border bg-bg-subtle/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Endpoint
                </p>
                <code className="mt-2 block break-all text-sm text-text-main">{currentEndpoint}</code>
              </div>
              <div className="rounded-2xl border border-border bg-bg-subtle/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Node
                </p>
                <p className="mt-2 text-sm text-text-main">{machineId || "Local operator node"}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {quickLinks.map((link) =>
                link.external ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between rounded-2xl border border-border bg-bg-subtle/70 px-4 py-3 transition-all hover:border-primary/25 hover:bg-surface"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-[18px]">{link.icon}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-main">{link.label}</p>
                        <p className="text-xs text-text-muted">Open a linked external surface.</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-text-muted transition-transform group-hover:translate-x-0.5">
                      open_in_new
                    </span>
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group flex items-center justify-between rounded-2xl border border-border bg-bg-subtle/70 px-4 py-3 transition-all hover:border-primary/25 hover:bg-surface"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-[18px]">{link.icon}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-main">{link.label}</p>
                        <p className="text-xs text-text-muted">Inspect the latest Zavorth operator state.</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-text-muted transition-transform group-hover:translate-x-0.5">
                      arrow_forward
                    </span>
                  </Link>
                )
              )}
            </div>
          </Card>
        </div>

        <div className="border-t border-border p-5 pt-0">
          <Card>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold">Provider arena</h2>
                <p className="text-sm text-text-muted">
                  Click any provider lane to inspect its model catalog and current connection posture.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-3 text-[11px] text-text-muted">
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-green-500" /> {tc("free")}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-blue-500" /> {t("oauthLabel")}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-amber-500" /> {t("apiKeyLabel")}
                  </span>
                </div>
                <Link
                  href="/dashboard/providers"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-main"
                >
                  <span className="material-symbols-outlined text-[14px]">settings</span>
                  {tc("manage")}
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {providerStats.map((item) => (
                <ProviderOverviewCard
                  key={item.id}
                  item={item}
                  metrics={providerMetrics[item.provider.alias] || providerMetrics[item.id]}
                  onClick={() => setSelectedProvider(item)}
                />
              ))}
            </div>
          </Card>
        </div>
      </details>

      {selectedProvider && (
        <ProviderModelsModal
          provider={selectedProvider}
          models={selectedProviderModels}
          onClose={() => setSelectedProvider(null)}
        />
      )}
    </div>
  );
}

HomePageClient.propTypes = {
  machineId: PropTypes.string,
};
