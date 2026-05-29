import { readLegacyDashboardSegments } from "./legacyDashboardSource";
import { TerminalInboxSector } from "./TerminalInboxSector";
import { ZavorthControlBridge } from "./ZavorthControlBridge";
import { ZavorthControlDock } from "./ZavorthControlDock";
import {
  ZavorthControlBootGate,
  ZavorthControlCommandPalette,
  ZavorthControlMobileDrawer,
  ZavorthControlModal,
  ZavorthControlToolSheet,
  ZavorthControlTraceSheet,
} from "./ZavorthControlOverlays";
import {
  MemorySurface,
  LearningSurface,
  CanvasSurface,
  ProvidersSurface,
  SettingsSurface,
  SkillsSurface,
  WorkSurface,
} from "./ZavorthControlSurfaces";

function HtmlFragment({ markup }: { markup: string }) {
  return <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: markup }} />;
}

function ZavorthControlInactiveSectors({
  sectors,
}: {
  sectors: ReturnType<typeof readLegacyDashboardSegments>["inactiveSectors"];
}) {
  return (
    <>
      <WorkSurface />
      <HtmlFragment markup={sectors.channels} />
      <HtmlFragment markup={sectors.salesOs} />
      <HtmlFragment markup={sectors.instances} />
      <HtmlFragment markup={sectors.sessions} />
      <ProvidersSurface />
      <HtmlFragment markup={sectors.agents} />
      <SkillsSurface />
      <MemorySurface />
      <LearningSurface />
      <CanvasSurface />
      <SettingsSurface />
      <HtmlFragment markup={sectors.docs} />
      <HtmlFragment markup={sectors.cron} />
    </>
  );
}

function ZavorthControlOverlays({
  overlays,
}: {
  overlays: ReturnType<typeof readLegacyDashboardSegments>["overlays"];
}) {
  return (
    <>
      <HtmlFragment markup={overlays.overlayShade} />
      <ZavorthControlToolSheet />
      <ZavorthControlTraceSheet />
      <ZavorthControlMobileDrawer />
      <ZavorthControlCommandPalette />
      <ZavorthControlModal />
      <HtmlFragment markup={overlays.signalFeed} />
      <ZavorthControlBootGate />
    </>
  );
}

export function LegacyDashboardShell() {
  const segments = readLegacyDashboardSegments();

  return (
    <>
      <div className="core-frame" id="core-frame">
        <ZavorthControlBridge />
        <main className="viewport" id="viewport">
          <TerminalInboxSector />
          <ZavorthControlInactiveSectors sectors={segments.inactiveSectors} />
        </main>
        <ZavorthControlDock />
      </div>
      <ZavorthControlOverlays overlays={segments.overlays} />
    </>
  );
}
