import { readLegacyZavorthControlSegments } from "./legacyZavorthControlSource";
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
  ReviewSurface,
  ProofSurface,
  ChannelsSurface,
  SessionsSurface,
  CronSurface,
  AgentsSurface,
  DocsSurface,
} from "./ZavorthControlSurfaces";

function HtmlFragment({ markup }: { markup: string }) {
  return <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: markup }} />;
}

/**
 * Inactive sectors are React surfaces, not HTML fragments.
 * Overlays still come from the built Vite shell HTML for event-bridge compatibility.
 */
function ZavorthControlInactiveSectors(_props: {
  sectors: ReturnType<typeof readLegacyZavorthControlSegments>["inactiveSectors"];
}) {
  return (
    <>
      <WorkSurface />
      <ChannelsSurface />
      <ReviewSurface />
      <ProofSurface />
      <SessionsSurface />
      <ProvidersSurface />
      <AgentsSurface />
      <SkillsSurface />
      <MemorySurface />
      <LearningSurface />
      <CanvasSurface />
      <SettingsSurface />
      <DocsSurface />
      <CronSurface />
    </>
  );
}

function ZavorthControlOverlays({
  overlays,
}: {
  overlays: ReturnType<typeof readLegacyZavorthControlSegments>["overlays"];
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

export function LegacyZavorthControlShell() {
  const segments = readLegacyZavorthControlSegments();

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
