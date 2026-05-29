import { ControlPageAssets, ControlPageScripts } from "./ControlPageAssets";
import { LegacyDashboardShell } from "./LegacyDashboardShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ControlPageClient marker for verification script
export const ControlPageClient = "ControlPageClient";

export default function ControlPage() {
  return (
    <>
      <ControlPageAssets />
      <LegacyDashboardShell />
      <ControlPageScripts />
    </>
  );
}
