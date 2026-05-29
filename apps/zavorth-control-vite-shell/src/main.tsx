import { renderToStaticMarkup } from "react-dom/server";
import { TerminalInboxSector } from "../../../src/ai-gateway/app/(zavorthControl)/control/TerminalInboxSector";

function mountTerminalInboxSector() {
  const terminalSector = document.getElementById("sector-terminal");
  if (!terminalSector) return;

  terminalSector.outerHTML = renderToStaticMarkup(<TerminalInboxSector />);
}

mountTerminalInboxSector();
