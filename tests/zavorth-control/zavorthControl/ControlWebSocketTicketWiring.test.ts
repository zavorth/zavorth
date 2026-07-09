import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(__dirname, "..", "..", "..");
const controlDir = join(repoRoot, "src", "ai-gateway", "app", "(zavorthControl)", "control");
const ticketRoute = join(repoRoot, "src", "ai-gateway", "app", "api", "auth", "ticket", "route.ts");

describe("Control WebSocket ticket wiring", () => {
  it("keeps a ticket issuer route for browser websocket upgrades", () => {
    expect(existsSync(ticketRoute)).toBe(true);
    const source = readFileSync(ticketRoute, "utf8");
    expect(source).toMatch(/requireManagementAuth|requireStrictManagementAuth|requireAuth/);
    expect(source).toMatch(/ticket/);
  });

  it("keeps control client helpers from embedding raw management tokens in websocket URLs", () => {
    const utilsPath = join(controlDir, "zavorthControlPageClient.utils.ts");
    const clientPath = join(controlDir, "useControlPageClient.ts");
    expect(existsSync(utilsPath) || existsSync(clientPath)).toBe(true);
    const source = [
      existsSync(utilsPath) ? readFileSync(utilsPath, "utf8") : "",
      existsSync(clientPath) ? readFileSync(clientPath, "utf8") : "",
    ].join("\n");

    // Opaque ticket or session-based WS construction is acceptable; raw token query params are not.
    expect(source).not.toMatch(/searchParams\.set\(\s*["']token["']/);
    expect(source).not.toMatch(/[?&]token=\$\{/);
  });
});
