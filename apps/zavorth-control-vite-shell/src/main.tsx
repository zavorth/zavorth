/**
 * Optional Vite shell entry that primarily mounts islands from pages.ts.
 * Kept for Next/static tooling that imports main.tsx directly.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { TerminalInboxSector } from "../../../src/ai-gateway/app/(zavorthControl)/control/TerminalInboxSector";
import { mountDashboardReactIslands } from "./react/mountDashboardReactIslands";

function mountTerminalInboxSector() {
  const terminalSector = document.getElementById("sector-terminal");
  if (!terminalSector) return;

  terminalSector.outerHTML = renderToStaticMarkup(<TerminalInboxSector />);
}

mountTerminalInboxSector();
mountDashboardReactIslands();
