import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(__dirname, "..", "..", "..");
const apiRoot = join(repoRoot, "src", "ai-gateway", "app", "api");

// Routes that currently exist under the ai-gateway control surface and must stay authenticated.
const sensitiveRoutes = [
  "settings/import-json/route.ts",
  "settings/export-json/route.ts",
  "gateway-control/route.ts",
  "auth/ticket/route.ts",
  "developer-workspace/route.ts",
];

describe("Zavorth Control API auth boundary", () => {
  it("keeps sensitive API routes behind management auth", () => {
    const existing = sensitiveRoutes.filter((routeId) =>
      existsSync(join(apiRoot, ...routeId.split("/"))),
    );
    expect(existing.length).toBeGreaterThan(0);

    const missingAuth = existing.filter((routeId) => {
      const source = readFileSync(join(apiRoot, ...routeId.split("/")), "utf8");
      return !source.includes("requireManagementAuth")
        && !source.includes("requireStrictManagementAuth");
    });

    expect(missingAuth).toEqual([]);
  });

  it("protects the WebSocket ticket issuer before it returns ticket material", () => {
    const ticketRoute = join(apiRoot, "auth", "ticket", "route.ts");
    expect(existsSync(ticketRoute)).toBe(true);
    const source = readFileSync(ticketRoute, "utf8");
    const authIndex = source.indexOf("requireManagementAuth");
    const responseIndex = source.indexOf("NextResponse.json");
    expect(authIndex).toBeGreaterThanOrEqual(0);
    expect(responseIndex).toBeGreaterThan(authIndex);
  });
});
