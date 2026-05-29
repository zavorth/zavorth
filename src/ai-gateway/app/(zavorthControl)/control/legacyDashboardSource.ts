import fs from "node:fs";
import path from "node:path";

const LEGACY_DASHBOARD_CANDIDATES = [
  path.join(process.cwd(), "public", "zavorth-control-vite-shell", "index.html"),
  path.join(process.cwd(), "src", "ai-gateway", "public", "zavorth-control-vite-shell", "index.html"),
  path.join(process.cwd(), "apps", "zavorth-control-vite-shell", "index.html"),
  path.join(process.cwd(), "..", "..", "apps", "zavorth-control-vite-shell", "index.html"),
];

function readLegacyDashboardHtml(): string {
  const filePath = LEGACY_DASHBOARD_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
    throw new Error("Zavorth Control HTML source was not found.");
  }

  return fs.readFileSync(filePath, "utf8");
}

function readLegacyDashboardBody(): string {
  const html = readLegacyDashboardHtml();
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch?.[1]) {
    throw new Error("Zavorth Control HTML source does not contain a body.");
  }

  return bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, "").trim();
}

export type LegacyDashboardSegments = {
  inactiveSectors: Record<string, string>;
  overlays: Record<string, string>;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractElementById(source: string, id: string): string {
  const startPattern = new RegExp(`<([a-zA-Z][\\w:-]*)\\b[^>]*\\bid=["']${escapeRegExp(id)}["'][^>]*>`, "i");
  const startMatch = startPattern.exec(source);
  if (!startMatch) {
    throw new Error(`Zavorth Control HTML source is missing element: #${id}`);
  }

  const tagName = startMatch[1];
  const startIndex = startMatch.index;
  const tagPattern = new RegExp(`<\\/?${escapeRegExp(tagName)}\\b[^>]*>`, "gi");
  tagPattern.lastIndex = startIndex;

  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(source))) {
    const token = match[0];
    if (token.startsWith("</")) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, tagPattern.lastIndex).trim();
      }
      continue;
    }

    if (!token.endsWith("/>")) {
      depth += 1;
    }
  }

  throw new Error(`Zavorth Control HTML source has an unterminated element: #${id}`);
}

export function readLegacyDashboardSegments(): LegacyDashboardSegments {
  const body = readLegacyDashboardBody();
  return {
    inactiveSectors: {
      overview: extractElementById(body, "sector-overview"),
      channels: extractElementById(body, "sector-channels"),
      salesOs: extractElementById(body, "sector-sales-os"),
      instances: extractElementById(body, "sector-instances"),
      sessions: extractElementById(body, "sector-sessions"),
      usage: extractElementById(body, "sector-usage"),
      agents: extractElementById(body, "sector-agents"),
      skills: extractElementById(body, "sector-skills"),
      nodes: extractElementById(body, "sector-nodes"),
      dreams: extractElementById(body, "sector-dreams"),
      config: extractElementById(body, "sector-config"),
      docs: extractElementById(body, "sector-docs"),
      cron: extractElementById(body, "sector-cron"),
    },
    overlays: {
      overlayShade: extractElementById(body, "overlay-shade"),
      signalFeed: extractElementById(body, "signal-feed"),
    },
  };
}
