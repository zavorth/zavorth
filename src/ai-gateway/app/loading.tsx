"use client";

import ZavorthGatewayLogo from "@/shared/components/ZavorthGatewayLogo";
import { Spinner } from "@/shared/components/Loading";

export default function AppLoading() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-bg px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/[0.12] blur-3xl dark:bg-primary/[0.18]" />
        <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-accent/[0.10] blur-3xl dark:bg-accent/[0.14]" />
      </div>

      <div className="relative w-full max-w-md rounded-3xl border border-black/5 bg-surface/90 p-8 text-center shadow-2xl backdrop-blur dark:border-white/10 dark:bg-surface/[0.85]">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-hover text-white shadow-lg">
          <ZavorthGatewayLogo size={28} className="text-white" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.26em] text-primary/80">
          Zavorth Control Plane
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-text-main">
          Rehydrating operator surfaces
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          Restoring provider state, budgets, routing posture, and local tool integrations.
        </p>
        <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-black/5 bg-bg-subtle px-4 py-2 text-sm text-text-muted dark:border-white/10">
          <Spinner size="sm" label="Booting Zavorth" />
          <span>Booting Zavorth runtime</span>
        </div>
      </div>
    </div>
  );
}
