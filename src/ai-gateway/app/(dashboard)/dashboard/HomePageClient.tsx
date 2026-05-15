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
      const [provRes, modelsRes, metricsRes, versionRes] = await Promise.all([
        fetch("/api/providers"),
        fetch("/api/models"),
        fetch("/api/provider-metrics"),
        fetch("/api/system/version"),
      ]);
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
    } catch (e) {
      console.log("Error fetching data:", e);
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

  const guidedStarts = [
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
                message: "Waiting for the Zavorth control plane to come back online.",
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
                message: "Waiting for the Zavorth control plane to come back online.",
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

      <Card className="relative overflow-hidden border-primary/15 bg-gradient-to-br from-surface via-surface to-bg-subtle shadow-sm">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 left-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl dark:bg-primary/[0.16]" />
          <div className="absolute bottom-0 right-0 h-44 w-44 rounded-full bg-accent/[0.10] blur-3xl dark:bg-accent/[0.14]" />
        </div>

        <div className="relative grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
              <ZavorthGatewayLogo size={16} className="text-primary" />
              Zavorth Control Plane
            </div>

            <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-text-main sm:text-4xl">
              What should Zavorth help with today?
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">
              Hello, Operator. This operator surface keeps daily missions, readiness, approvals and receipts in one place.
              Ask naturally. Zavorth will show risk, ask when needed and leave receipts behind.
              Start with a guided mission or inspect the runtime quietly.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-black/5 bg-surface/80 p-4 dark:border-white/10">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">
                  Endpoint
                </p>
                <code className="mt-2 block break-all text-sm font-medium text-text-main">
                  {currentEndpoint}
                </code>
                <p className="mt-2 text-xs leading-5 text-text-muted">
                  OpenAI-compatible ingress for apps, tools, and operator scripts.
                </p>
              </div>
              <div className="rounded-2xl border border-black/5 bg-surface/80 p-4 dark:border-white/10">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">
                  Node
                </p>
                <p className="mt-2 text-sm font-medium text-text-main">
                  {machineId || "Local operator node"}
                </p>
                <p className="mt-2 text-xs leading-5 text-text-muted">
                  Runtime identity used to connect routing policy, versions, and health posture.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                href="/dashboard/providers"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-primary to-primary-hover px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-transform hover:-translate-y-0.5"
              >
                <span className="material-symbols-outlined text-[18px]">dns</span>
                Open provider arena
              </Link>
              <Link
                href="/dashboard/endpoint"
                className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white/70 px-4 py-2.5 text-sm font-medium text-text-main transition-colors hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-[18px]">deployed_code</span>
                Inspect endpoint surface
              </Link>
              <Link
                href="/dashboard/cli-tools"
                className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white/70 px-4 py-2.5 text-sm font-medium text-text-main transition-colors hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-[18px]">terminal</span>
                Configure local tools
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {postureSignals.map((signal) => (
              <div
                key={signal.label}
                className="rounded-2xl border border-black/5 bg-surface/80 p-4 backdrop-blur dark:border-white/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                      {signal.label}
                    </p>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-text-main">
                      {signal.value}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-text-muted">{signal.detail}</p>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-[18px]">{signal.icon}</span>
                  </div>
                </div>
              </div>
            ))}
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
                  ? `Current control plane is v${versionInfo.current}. Apply the update to refresh runtime fixes and operational capabilities.`
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
              <h2 className="text-lg font-semibold">Guided starts</h2>
              <p className="text-sm text-text-muted">
                Pick a gentle starting point. Sensitive work still becomes preview, approval and receipt.
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
            <h2 className="text-lg font-semibold">Ask the runtime</h2>
            <p className="text-sm text-text-muted">
              Natural questions are read-only. They explain state without changing configuration.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {runtimeQuestions.map((question) => (
              <div
                key={question}
                className="rounded-2xl border border-border bg-bg-subtle/70 px-4 py-3"
              >
                <p className="text-sm font-medium text-text-main">{question}</p>
                <code className="mt-2 block break-all text-xs text-text-muted">
                  zavorth ask-runtime &quot;{question.toLowerCase()}&quot;
                </code>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Operator actions</h2>
              <p className="text-sm text-text-muted">
                Move through the surfaces that shape routing, access, and resilience.
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
              <h2 className="text-lg font-semibold">Control-plane shortcuts</h2>
              <p className="text-sm text-text-muted">
                Jump to the surfaces most operators check during setup and recovery.
              </p>
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
