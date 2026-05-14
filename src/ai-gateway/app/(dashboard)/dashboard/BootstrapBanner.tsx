"use client";

import { useState } from "react";

/**
 * Shown when the control plane booted with auto-generated local secrets.
 * The banner is dismissible and lasts only for the current session.
 */
export default function BootstrapBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const dataDir =
    typeof navigator !== "undefined" && navigator.platform?.startsWith("Win")
      ? "%APPDATA%\\Zavorth\\server.env"
      : "~/.zavorth/server.env";

  return (
    <div
      role="alert"
      className="mb-4 overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/12 via-amber-500/8 to-transparent px-4 py-4 text-sm shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
          <span className="material-symbols-outlined text-[18px]">shield_lock</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-200">Local secrets were sealed on first launch</p>
          <p className="mt-1 leading-6 text-amber-100/80">
            Zavorth provisioned the encryption material required for this node and stored it in{" "}
            <code className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-xs text-amber-100">
              {dataDir}
            </code>
            . The current setup is safe to keep running. If you want to harden the installation
            with operator-managed values, set{" "}
            <code className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-xs text-amber-100">
              JWT_SECRET
            </code>{" "}
            and{" "}
            <code className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-xs text-amber-100">
              STORAGE_ENCRYPTION_KEY
            </code>{" "}
            in that file.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-lg p-1 text-amber-200/60 transition-colors hover:bg-amber-500/10 hover:text-amber-100"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>
  );
}
