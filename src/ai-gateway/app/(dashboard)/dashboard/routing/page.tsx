"use client";

import { useEffect, useState } from "react";
import { Card } from "@/shared/components";

type GatewaySnapshot = {
  gateway?: { files?: number; batches?: number; store?: string };
  cache?: { hitRate?: string; hits?: number; misses?: number; tokensSaved?: number };
  models?: number;
  combos?: number;
  batches?: Array<{ id: string; status: string; request_counts?: { total: number; completed: number; failed: number }; output_file_id?: string | null }>;
  files?: Array<{ id: string; filename: string; bytes: number; purpose: string }>;
  providerMetrics?: Record<string, { totalRequests: number; totalSuccesses: number; successRate: number; avgLatencyMs: number }>;
  comboHealth?: Array<{
    comboName: string;
    strategy: string;
    performance?: { totalRequests: number; successRate: number; avgLatencyMs: number };
    quotaHealth?: { worstRemainingPct: number };
  }>;
  compression?: { passed?: boolean; averageRatio?: number; totalSavedBytes?: number; cases?: Array<{ name: string; ratio: number; savedBytes: number; latestIntentPreserved: boolean }> };
};

export default function RoutingDashboardPage() {
  const [snapshot, setSnapshot] = useState<GatewaySnapshot>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [health, cache, models, combos, batches, files, providerMetrics, comboHealth, compression] = await Promise.all([
        fetch("/api/v1/ws").then((r) => r.json()).catch(() => ({})),
        fetch("/api/cache").then((r) => r.json()).catch(() => ({})),
        fetch("/api/v1/models").then((r) => r.json()).catch(() => ({})),
        fetch("/api/combos").then((r) => r.json()).catch(() => ({})),
        fetch("/api/v1/batches").then((r) => r.json()).catch(() => ({})),
        fetch("/api/v1/files").then((r) => r.json()).catch(() => ({})),
        fetch("/api/provider-metrics").then((r) => r.json()).catch(() => ({})),
        fetch("/api/usage/combo-health?range=24h").then((r) => r.json()).catch(() => ({})),
        fetch("/api/v1/compression/benchmark").then((r) => r.json()).catch(() => ({})),
      ]);
      if (cancelled) return;
      setSnapshot({
        gateway: health.gateway,
        cache: cache.semanticCache,
        models: Array.isArray(models.data) ? models.data.length : 0,
        combos: Array.isArray(combos.combos) ? combos.combos.length : 0,
        batches: Array.isArray(batches.data) ? batches.data : [],
        files: Array.isArray(files.data) ? files.data : [],
        providerMetrics: providerMetrics.metrics || {},
        comboHealth: Array.isArray(comboHealth.combos) ? comboHealth.combos : [],
        compression: compression.object ? compression : undefined,
      });
    }
    load();
    const timer = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <section>
        <p className="text-xs uppercase tracking-[0.24em] text-primary">Zavorth Native Gateway</p>
        <h1 className="mt-2 text-2xl font-semibold text-text-main">AI routing plane</h1>
        <p className="mt-2 max-w-3xl text-sm text-text-muted">
          Providers, model catalog, combos, cache and local gateway state in one routing-focused view.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric title="Models" value={snapshot.models ?? 0} detail="available through /v1/models" />
        <Metric title="Combos" value={snapshot.combos ?? 0} detail="fallback and routing groups" />
        <Metric title="Cache hit rate" value={`${snapshot.cache?.hitRate ?? "0.0"}%`} detail={`${snapshot.cache?.hits ?? 0} hits / ${snapshot.cache?.misses ?? 0} misses`} />
        <Metric title="Tokens saved" value={snapshot.cache?.tokensSaved ?? 0} detail="semantic cache estimate" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-text-main">Routing cockpit</h2>
          <div className="mt-4 grid gap-3 text-sm text-text-muted md:grid-cols-2">
            <StatusRow label="Primary model" value="auto" detail="dynamic provider pool" />
            <StatusRow label="Fallback policy" value="reset-aware" detail="cooldown, quota and health gates" />
            <StatusRow label="Compression" value="enabled" detail="dedupe, log trimming and latest-intent preservation" />
            <StatusRow label="WebSocket" value="/v1/ws" detail="persistent on the local Node gateway host" />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-text-main">Certification</h2>
          <p className="mt-3 text-sm text-text-muted">
            Run live proof from the provider cockpit or POST <code>/api/v1/providers/:provider/certify</code>.
            Passed/failed proofs are stored with TTL and reused by routing health.
          </p>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-text-main">Provider performance</h2>
          <div className="mt-3 space-y-2 text-sm text-text-muted">
            {Object.entries(snapshot.providerMetrics || {}).slice(0, 8).map(([provider, metrics]) => (
              <div key={provider} className="rounded-lg border border-border-subtle p-3">
                <p className="font-medium text-text-main">{provider}</p>
                <p>{metrics.successRate}% success · {metrics.avgLatencyMs}ms avg · {metrics.totalRequests} requests</p>
              </div>
            ))}
            {Object.keys(snapshot.providerMetrics || {}).length === 0 ? <p>No provider telemetry available yet.</p> : null}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-text-main">Combo health</h2>
          <div className="mt-3 space-y-2 text-sm text-text-muted">
            {(snapshot.comboHealth || []).slice(0, 6).map((combo) => (
              <div key={combo.comboName} className="rounded-lg border border-border-subtle p-3">
                <p className="font-medium text-text-main">{combo.comboName}</p>
                <p>{combo.strategy} · {Math.round((combo.performance?.successRate || 0) * 100)}% success · quota floor {combo.quotaHealth?.worstRemainingPct ?? 0}%</p>
              </div>
            ))}
            {(snapshot.comboHealth || []).length === 0 ? <p>No combo health history available yet.</p> : null}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-text-main">Compression benchmark</h2>
          <p className="mt-3 text-sm text-text-muted">
            {snapshot.compression?.passed ? "Passing" : "No benchmark result"} · avg ratio {formatRatio(snapshot.compression?.averageRatio)} · saved {snapshot.compression?.totalSavedBytes ?? 0} bytes
          </p>
          <div className="mt-3 space-y-2 text-xs text-text-muted">
            {(snapshot.compression?.cases || []).slice(0, 4).map((item) => (
              <p key={item.name}>{item.name}: {formatRatio(item.ratio)} · saved {item.savedBytes} · latest {item.latestIntentPreserved ? "kept" : "missing"}</p>
            ))}
          </div>
        </Card>
      </section>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-text-main">Native routing contract</h2>
        <div className="mt-4 grid gap-3 text-sm text-text-muted md:grid-cols-2">
          <p><span className="text-text-main">Default path:</span> agent LLM calls route through the local AI Gateway provider unless direct-provider debug is enabled.</p>
          <p><span className="text-text-main">Auto route:</span> model <code>auto</code> builds a dynamic pool from active providers, pricing and health gates.</p>
          <p><span className="text-text-main">Reset-aware:</span> routing honors cooldown/quota gates and falls through cleanly instead of hammering recovering accounts.</p>
          <p><span className="text-text-main">Cache/compression:</span> deterministic non-tool chat requests can be cached, and long contexts are compacted before provider spend.</p>
        </div>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-text-main">Batch worker</h2>
          <div className="mt-3 space-y-2 text-sm text-text-muted">
            {(snapshot.batches || []).slice(0, 6).map((batch) => (
              <div key={batch.id} className="rounded-lg border border-border-subtle p-3">
                <p className="font-medium text-text-main">{batch.id}</p>
                <p>{batch.status} · {batch.request_counts?.completed ?? 0}/{batch.request_counts?.total ?? 0} completed · output {batch.output_file_id || "none"}</p>
              </div>
            ))}
            {(snapshot.batches || []).length === 0 ? <p>No batches recorded yet.</p> : null}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-text-main">Files</h2>
          <div className="mt-3 space-y-2 text-sm text-text-muted">
            {(snapshot.files || []).slice(0, 6).map((file) => (
              <div key={file.id} className="rounded-lg border border-border-subtle p-3">
                <p className="font-medium text-text-main">{file.filename}</p>
                <p>{file.purpose} · {file.bytes} bytes · {file.id}</p>
              </div>
            ))}
            {(snapshot.files || []).length === 0 ? <p>No gateway files stored yet.</p> : null}
          </div>
        </Card>
      </section>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-text-main">Local gateway runtime</h2>
        <pre className="mt-3 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-text-muted">
{JSON.stringify(snapshot.gateway || {}, null, 2)}
        </pre>
      </Card>
    </main>
  );
}

function Metric({ title, value, detail }: { title: string; value: string | number; detail: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-text-main">{value}</p>
      <p className="mt-1 text-xs text-text-muted">{detail}</p>
    </Card>
  );
}

function formatRatio(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 100)}%` : "n/a";
}

function StatusRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border-subtle p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className="mt-1 font-semibold text-text-main">{value}</p>
      <p className="mt-1 text-xs">{detail}</p>
    </div>
  );
}
