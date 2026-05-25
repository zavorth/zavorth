"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ExperienceSnapshot = {
  agent?: {
    state?: string;
    headline?: string;
    summary?: string;
    model?: string;
  };
  chat?: {
    messages?: Array<{
      id?: string;
      role?: string;
      content?: string;
      createdAt?: string;
    }>;
  };
  actionCards?: Array<{
    id?: string;
    title?: string;
    summary?: string;
    risk?: string;
    status?: string;
  }>;
  approvals?: Array<{
    id?: string;
    title?: string;
    summary?: string;
    risk?: string;
    status?: string;
  }>;
  receipts?: Array<{
    id?: string;
    title?: string;
    summary?: string;
    createdAt?: string;
  }>;
  health?: {
    status?: string;
    summary?: string;
  };
  memory?: {
    summary?: string;
  };
};

type AskResult = {
  response?: string;
  plan?: {
    summary?: string;
    nextSteps?: string[];
  };
};

type NavItem = {
  id: string;
  label: string;
  group: string;
  count?: number;
};

const navItems: NavItem[] = [
  { id: "inbox", label: "Inbox", group: "Operate" },
  { id: "overview", label: "Overview", group: "Operate" },
  { id: "channels", label: "Channels", group: "Operate" },
  { id: "approvals", label: "Approvals", group: "Operate" },
  { id: "receipts", label: "Receipts", group: "Operate" },
  { id: "agent", label: "Agent", group: "Agent" },
  { id: "skills", label: "Skills", group: "Agent" },
  { id: "mnemos", label: "Mnemos", group: "Agent" },
  { id: "usage", label: "Usage", group: "System" },
  { id: "config", label: "Config", group: "System" },
  { id: "docs", label: "Docs", group: "System" },
];

const groupedNav = navItems.reduce<Record<string, NavItem[]>>((groups, item) => {
  groups[item.group] = [...(groups[item.group] || []), item];
  return groups;
}, {});

function normalizeStatus(value?: string) {
  return String(value || "ready").replace(/_/g, " ");
}

function itemTone(value?: string) {
  const status = String(value || "").toLowerCase();
  if (status.includes("block") || status.includes("error") || status.includes("fail")) return "danger";
  if (status.includes("pending") || status.includes("warn") || status.includes("attention")) return "warn";
  return "ready";
}

function Badge({ children, tone = "ready" }: { children: ReactNode; tone?: "ready" | "warn" | "danger" | "muted" }) {
  const classes = {
    ready: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
    warn: "border-amber-300/25 bg-amber-300/10 text-amber-200",
    danger: "border-rose-300/25 bg-rose-300/10 text-rose-200",
    muted: "border-white/10 bg-white/[0.04] text-zinc-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${classes[tone]}`}>
      {children}
    </span>
  );
}

function Card({
  eyebrow,
  title,
  children,
  className = "",
}: {
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[22px] border border-emerald-300/12 bg-[#07150f]/78 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.18)] ${className}`}>
      {eyebrow ? (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300/70">
          {eyebrow}
        </p>
      ) : null}
      {title ? <h2 className="text-base font-semibold text-zinc-50">{title}</h2> : null}
      <div className={title || eyebrow ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm leading-6 text-zinc-400">
      {children}
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-3 text-xl font-semibold text-zinc-50">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function MessageRow({ role, content }: { role?: string; content?: string }) {
  const assistant = role === "assistant";
  return (
    <article className={`flex gap-3 rounded-2xl border p-4 ${assistant ? "border-emerald-300/12 bg-emerald-300/[0.035]" : "border-white/10 bg-white/[0.025]"}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${assistant ? "bg-emerald-300 text-black" : "bg-white/10 text-zinc-200"}`}>
        {assistant ? "Z" : "U"}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {assistant ? "Zavorth" : "You"}
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-200">{content || "No content."}</p>
      </div>
    </article>
  );
}

export default function HomePageClient({ machineId }: { machineId: string }) {
  const [activeSection, setActiveSection] = useState("inbox");
  const [snapshot, setSnapshot] = useState<ExperienceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [asking, setAsking] = useState(false);
  const [askResult, setAskResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/experience/home?surface=web", { cache: "no-store" });
      if (!response.ok) throw new Error(`Experience API returned ${response.status}`);
      setSnapshot(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const messages = useMemo(() => snapshot?.chat?.messages?.slice(-6) || [], [snapshot]);
  const approvals = useMemo(
    () => [...(snapshot?.actionCards || []), ...(snapshot?.approvals || [])],
    [snapshot],
  );
  const receipts = useMemo(() => snapshot?.receipts || [], [snapshot]);
  const agentState = snapshot?.agent?.state || snapshot?.health?.status || "ready";
  const statusTone = itemTone(agentState);

  async function askZavorth() {
    const text = prompt.trim();
    if (!text || asking) return;
    setAsking(true);
    setAskResult(null);
    setError(null);

    try {
      const response = await fetch("/api/experience/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          version: "ExperienceCommand/v1",
          surface: "web",
          text,
          workspace: machineId,
          trustMode: "governed",
        }),
      });
      if (!response.ok) throw new Error(`Ask failed with ${response.status}`);
      setAskResult(await response.json());
      setPrompt("");
      void loadSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAsking(false);
    }
  }

  const renderMainPanel = () => {
    if (activeSection === "inbox") {
      return (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="min-h-[620px]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300/70">
                  Inbox
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">Hello, operator.</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                  Ask Zavorth in natural language. Sensitive work stays behind preview, approval and evidence.
                </p>
              </div>
              <Badge tone={statusTone === "danger" ? "danger" : statusTone === "warn" ? "warn" : "ready"}>
                {normalizeStatus(agentState)}
              </Badge>
            </div>

            <div className="mt-6 grid gap-3">
              {loading ? (
                <>
                  <div className="h-20 animate-pulse rounded-2xl bg-white/[0.05]" />
                  <div className="h-24 animate-pulse rounded-2xl bg-white/[0.035]" />
                </>
              ) : messages.length ? (
                messages.map((message, index) => (
                  <MessageRow key={message.id || index} role={message.role} content={message.content} />
                ))
              ) : (
                <Empty>No messages yet. Start by asking what you want Zavorth to do.</Empty>
              )}
            </div>

            {askResult ? (
              <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">
                <p className="font-semibold">{askResult.response || askResult.plan?.summary || "Zavorth accepted the request."}</p>
                {askResult.plan?.nextSteps?.length ? (
                  <div className="mt-3 grid gap-2 text-emerald-100/80">
                    {askResult.plan.nextSteps.slice(0, 3).map((step) => (
                      <p key={step}>- {step}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <div className="mt-6 rounded-[24px] border border-emerald-300/14 bg-black/30 p-3">
              <label className="sr-only" htmlFor="zavorth-dashboard-prompt">
                Ask Zavorth
              </label>
              <textarea
                id="zavorth-dashboard-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    void askZavorth();
                  }
                }}
                placeholder="Ask Zavorth..."
                className="min-h-28 w-full resize-none rounded-[18px] border border-white/10 bg-[#020806] px-4 py-3 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-300/45"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-zinc-500">Ctrl+Enter sends. Risky actions request approval first.</span>
                <button
                  type="button"
                  onClick={() => void askZavorth()}
                  disabled={!prompt.trim() || asking}
                  className="rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {asking ? "Thinking..." : "Ask Zavorth"}
                </button>
              </div>
            </div>
          </Card>

          <div className="grid content-start gap-5">
            <Card eyebrow="Mission" title={snapshot?.agent?.headline || "Ready for natural work"}>
              <p className="text-sm leading-6 text-zinc-400">
                {snapshot?.agent?.summary || "Zavorth will plan, use native tools when useful, and explain what is missing."}
              </p>
            </Card>
            <Card eyebrow="Approvals" title={`${approvals.length} pending`}>
              {approvals.length ? (
                <div className="grid gap-3">
                  {approvals.slice(0, 4).map((item, index) => (
                    <div key={item.id || index} className="rounded-2xl border border-amber-300/14 bg-amber-300/[0.045] p-3">
                      <p className="text-sm font-semibold text-zinc-100">{item.title || "Approval required"}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-400">{item.summary || item.status || "Review before continuing."}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>No sensitive action is waiting right now.</Empty>
              )}
            </Card>
          </div>
        </div>
      );
    }

    if (activeSection === "overview") {
      return (
        <div className="grid gap-5">
          <section className="rounded-[30px] border border-emerald-300/14 bg-gradient-to-br from-emerald-300/[0.13] via-[#07150f] to-orange-300/[0.06] p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/70">Today in Zavorth</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-50">Control the agent without losing the thread.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
              The dashboard keeps chat, approvals, receipts, skills and runtime state in one governed surface.
            </p>
          </section>
          <div className="grid gap-4 md:grid-cols-4">
            <Stat label="Missions" value={agentState === "ready" ? "Ready" : normalizeStatus(agentState)} detail="runtime state" />
            <Stat label="Provider" value={snapshot?.agent?.model || "Route"} detail={snapshot?.agent?.model ? "configured" : "configured when available"} />
            <Stat label="Approvals" value={String(approvals.length)} detail={approvals.length ? "needs review" : "clear"} />
            <Stat label="Receipts" value={String(receipts.length)} detail="latest evidence" />
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Card eyebrow="Next best action" title={approvals.length ? "Review pending approvals" : "Start from the inbox"}>
              <div className="grid gap-3">
                {[
                  ["Ask", "Describe the outcome you want in natural language."],
                  ["Preview", "Zavorth shows risk, scope and plan before sensitive work."],
                  ["Approve", "You decide what can continue."],
                  ["Receipt", "Every important action leaves evidence."],
                ].map(([title, copy]) => (
                  <div key={title} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-300" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card eyebrow="Readiness" title={normalizeStatus(snapshot?.health?.status || agentState)}>
              <p className="text-sm leading-6 text-zinc-400">
                {snapshot?.health?.summary || "Runtime health and blockers appear here only when they matter."}
              </p>
            </Card>
          </div>
        </div>
      );
    }

    if (activeSection === "approvals") {
      return (
        <Card eyebrow="Approvals" title="Governed decisions">
          {approvals.length ? (
            <div className="grid gap-3">
              {approvals.map((item, index) => (
                <div key={item.id || index} className="rounded-2xl border border-amber-300/14 bg-amber-300/[0.045] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-zinc-100">{item.title || "Approval required"}</p>
                    <Badge tone="warn">{item.risk || item.status || "review"}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{item.summary || "Review scope, risk and evidence before approving."}</p>
                </div>
              ))}
            </div>
          ) : (
            <Empty>No pending approvals.</Empty>
          )}
        </Card>
      );
    }

    if (activeSection === "receipts") {
      return (
        <Card eyebrow="Receipts" title="Evidence trail">
          {receipts.length ? (
            <div className="grid gap-3">
              {receipts.map((receipt, index) => (
                <div key={receipt.id || index} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <p className="font-semibold text-zinc-100">{receipt.title || "Receipt"}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{receipt.summary || receipt.createdAt || "Evidence is available for inspection."}</p>
                </div>
              ))}
            </div>
          ) : (
            <Empty>Receipts appear after governed work.</Empty>
          )}
        </Card>
      );
    }

    if (activeSection === "skills") {
      return (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card eyebrow="Skills" title="Native capabilities">
            <p className="text-sm leading-6 text-zinc-400">
              Skills are governed abilities Zavorth can use through policy, preview and receipts.
            </p>
          </Card>
          <Card eyebrow="Ready" title="Workspace read">
            <p className="text-sm leading-6 text-zinc-400">Safe context reading for repository understanding.</p>
          </Card>
          <Card eyebrow="Governed" title="Mutation preview">
            <p className="text-sm leading-6 text-zinc-400">Sensitive changes stay behind approval and evidence.</p>
          </Card>
        </div>
      );
    }

    if (activeSection === "mnemos") {
      return (
        <Card eyebrow="Mnemos" title="Memory and learning">
          <p className="text-sm leading-6 text-zinc-400">
            {snapshot?.memory?.summary || "Mnemos keeps approved memory and learning reversible. Nothing changes future behavior silently."}
          </p>
        </Card>
      );
    }

    if (activeSection === "agent") {
      return (
        <Card eyebrow="Agent" title={snapshot?.agent?.headline || "Zavorth agent"}>
          <p className="text-sm leading-6 text-zinc-400">
            {snapshot?.agent?.summary || "The LLM remains central. The harness supplies governed tools, memory, approvals and receipts."}
          </p>
        </Card>
      );
    }

    return (
      <Card eyebrow={activeSection} title={`${navItems.find((item) => item.id === activeSection)?.label || "Section"} is ready`}>
        <p className="text-sm leading-6 text-zinc-400">
          This area is part of the governed dashboard surface and will show live details as soon as the runtime exposes them.
        </p>
      </Card>
    );
  };

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#020806] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(52,211,153,0.13),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(255,111,24,0.10),transparent_32%)]" />
      <div className="relative grid min-h-dvh lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-emerald-300/10 bg-[#06110d]/90 p-4 backdrop-blur sm:p-5 lg:min-h-dvh lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/18 bg-emerald-300/10 text-xl">
              Z
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300/70">Zavorth Control</p>
              <h1 className="text-lg font-semibold text-zinc-50">Dashboard</h1>
            </div>
          </div>

          <nav className="mt-5 flex max-w-full gap-3 overflow-x-auto pb-1 lg:mt-8 lg:grid lg:gap-7 lg:overflow-visible lg:pb-0" aria-label="Dashboard sections">
            {Object.entries(groupedNav).map(([group, items]) => (
              <div key={group} className="shrink-0 lg:shrink">
                <p className="mb-2 hidden px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600 lg:block">{group}</p>
                <div className="flex gap-2 lg:grid lg:gap-1">
                  {items.map((item) => {
                    const active = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={`flex items-center justify-between whitespace-nowrap rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition ${
                          active
                            ? "bg-emerald-300 text-black shadow-[0_18px_42px_rgba(52,211,153,0.18)]"
                            : "text-zinc-400 hover:bg-white/[0.045] hover:text-zinc-100"
                        }`}
                      >
                        <span>{item.label}</span>
                        {item.id === "approvals" && approvals.length ? (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-black/15 text-black" : "bg-amber-300/10 text-amber-200"}`}>
                            {approvals.length}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-orange-300/80">Zavorth</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
                {navItems.find((item) => item.id === activeSection)?.label || "Dashboard"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="muted">{machineId || "local"}</Badge>
              <Badge tone={statusTone === "danger" ? "danger" : statusTone === "warn" ? "warn" : "ready"}>
                {normalizeStatus(agentState)}
              </Badge>
            </div>
          </header>
          {renderMainPanel()}
        </main>
      </div>
    </div>
  );
}
