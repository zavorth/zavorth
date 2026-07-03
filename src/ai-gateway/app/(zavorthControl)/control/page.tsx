import { ControlPageAssets, ControlPageScripts } from "./ControlPageAssets";
import { LegacyZavorthControlShell } from "./LegacyZavorthControlShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ControlPageClient marker for verification script
export const ControlPageClient = "ControlPageClient";

export default function ControlPage() {
  return (
    <>
      <ControlPageAssets />
      <LegacyZavorthControlShell />
      <ControlPageScripts />
    </>
  );
}
