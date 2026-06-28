import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(__dirname, "..", "..", "..");
const controlDir = join(repoRoot, "src", "zavorth-control", "app", "(dashboard)", "control");

describe("Control WebSocket ticket wiring", () => {
  it("requests WebSocket tickets through the authenticated fetch helper", () => {
    const clientSource = readFileSync(join(controlDir, "useControlPageClient.ts"), "utf8");
    const utilsSource = readFileSync(join(controlDir, "controlPageClient.utils.ts"), "utf8");

    expect(clientSource).toContain('fetchJson<{ ok: boolean; ticket?: string }>("/api/auth/ticket"');
    expect(clientSource).not.toContain('fetch("/api/auth/ticket"');
    expect(utilsSource).toContain("...buildCommandCenterRuntimeAuthHeaders()");
  });

  it("passes only opaque tickets through the WebSocket URL and never raw management tokens", () => {
    const utilsSource = readFileSync(join(controlDir, "controlPageClient.utils.ts"), "utf8");
    const buildWsUrlSource = utilsSource.slice(
      utilsSource.indexOf("export function buildGatewayWsUrl"),
      utilsSource.indexOf("export function readCommandCenterRuntimeAuthToken"),
    );

    expect(buildWsUrlSource).toContain('url.searchParams.set("sessionId", sessionId)');
    expect(buildWsUrlSource).toContain('url.searchParams.set("ticket", ticket)');
    expect(buildWsUrlSource).not.toContain('url.searchParams.set("token"');
    expect(buildWsUrlSource).not.toContain("readCommandCenterRuntimeAuthToken()");
  });
});
