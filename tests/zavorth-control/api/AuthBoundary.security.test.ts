import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(__dirname, "..", "..", "..");
const apiRoot = join(repoRoot, "src", "zavorth-control", "app", "api");

const sensitiveRoutes = [
  "settings/wizard/route.ts",
  "settings/import-json/route.ts",
  "settings/export-json/route.ts",
  "skills/install/route.ts",
  "skills/marketplace/install/route.ts",
  "mcp/tools/route.ts",
  "mcp/stream/route.ts",
  "mcp/sse/route.ts",
  "developer-workspace/route.ts",
  "gateway-control/route.ts",
  "shutdown/route.ts",
];

describe("Zavorth Control API auth boundary", () => {
  it("keeps sensitive API routes behind management auth", () => {
    const missingAuth = sensitiveRoutes.filter((routeId) => {
      const source = readFileSync(join(apiRoot, ...routeId.split("/")), "utf8");
      return !source.includes("requireManagementAuth")
        && !source.includes("requireStrictManagementAuth");
    });

    expect(missingAuth).toEqual([]);
  });

  it("protects the WebSocket ticket issuer before it returns ticket material", () => {
    const source = readFileSync(join(apiRoot, "auth", "ticket", "route.ts"), "utf8");
    const authIndex = source.indexOf("await requireManagementAuth(request)");
    const responseIndex = source.indexOf("NextResponse.json");

    expect(source).toContain('import { requireManagementAuth } from "@/lib/api/requireManagementAuth"');
    expect(authIndex).toBeGreaterThanOrEqual(0);
    expect(responseIndex).toBeGreaterThan(authIndex);
  });
});
