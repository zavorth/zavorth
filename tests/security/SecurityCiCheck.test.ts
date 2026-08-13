import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(__dirname, "..", "..");

describe("Security CI gate", () => {
  it("exposes a single security:ci command for local and hosted CI", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["security:ci"]).toBe("node scripts/security-ci-check.mjs");
    expect(packageJson.scripts?.["security:audit"]).toBe("node scripts/security-ci-check.mjs");
  });

  it("keeps the CI workflow on locked installs and the security gate", () => {
    const workflow = readFileSync(join(repoRoot, ".github", "workflows", "security.yml"), "utf8");

    expect(workflow).toContain("permissions:");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("--ignore-scripts");
    expect(workflow).toContain("npm run security:ci");
  });

  it("does not let production CI silently pass typecheck, lint, or release failures", () => {
    const ciWorkflow = readFileSync(join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");
    const lintWorkflow = readFileSync(join(repoRoot, ".github", "workflows", "lint.yml"), "utf8");
    const releaseWorkflow = readFileSync(join(repoRoot, ".github", "workflows", "release.yml"), "utf8");

    expect(ciWorkflow).toContain("node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit --pretty false");
    expect(releaseWorkflow).toContain("node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit --pretty false");
    expect(ciWorkflow).not.toContain("npm run release:check --silent");
    expect(releaseWorkflow).toContain("npm run release:check --silent");
    expect(ciWorkflow).not.toContain("continue-on-error: true");
    expect(lintWorkflow).not.toContain("continue-on-error: true");
    expect(releaseWorkflow).not.toContain("continue-on-error: true");
    expect(ciWorkflow).not.toContain("| head");
    expect(releaseWorkflow).not.toContain("| tail");
  });

  it("keeps core security controls in the aggregator", () => {
    const script = readFileSync(join(repoRoot, "scripts", "security-ci-check.mjs"), "utf8");

    expect(script).toContain("security:secrets");
    expect(script).toContain("security:supply-chain");
    expect(script).toContain("npm audit");
    expect(script).toContain("runtime:check");
    expect(script).toContain("continuous security monitor");
    expect(script).toContain("security-continuous.ts");
    expect(script).toContain("SecurityOperationalPreset.test.ts");
    expect(script).toContain("OperationalSecurityDoctor.test.ts");
    expect(script).toContain("ContinuousSecurityMonitor.test.ts");
    expect(script).toContain("ControlWebSocketTicketWiring.test.ts");
    expect(script).toContain("SecureStorageService.test.ts");
    expect(script).toContain("RemoteShellTool.test.ts");
    expect(script).toContain("LocalExecutor.test.ts");
    expect(script).toContain("SandboxPolicyService.test.ts");
    expect(script).toContain("AutomaticBrowserTool.test.ts");
  });

  it("keeps the operational security doctor in the command catalog without growing package scripts", () => {
    const catalog = JSON.parse(readFileSync(join(repoRoot, "scripts", "command-catalog.json"), "utf8")) as {
      commands?: Record<string, { command?: string; status?: string }>;
    };

    expect(catalog.commands?.["security:doctor"]).toEqual(expect.objectContaining({
      command: "npx tsx scripts/security-doctor.ts",
    }));
    expect(catalog.commands?.["security:continuous"]).toEqual(expect.objectContaining({
      command: "npx tsx scripts/security-continuous.ts",
    }));
    expect(catalog.commands?.["security:baseline"]).toEqual(expect.objectContaining({
      command: "npx tsx scripts/security-continuous.ts --update-baseline",
    }));
    expect(catalog.commands?.["security:presets"]).toEqual(expect.objectContaining({
      command: "npx tsx scripts/security-preset.ts list",
    }));
    expect(catalog.commands?.["security:preset:professional"]).toEqual(expect.objectContaining({
      command: "npx tsx scripts/security-preset.ts professional --apply",
    }));
  });

  it("fails the secret guard when real .env files are tracked", () => {
    const script = readFileSync(join(repoRoot, "scripts", "secret-guard-check.mjs"), "utf8");

    expect(script).toContain("findForbiddenEnvFiles()");
    expect(script).toContain("readGitPaths(['ls-files', '-z', '.env', '.env.*'])");
    expect(script).toContain("'--git-dir=.git'");
    expect(script).toContain("'--work-tree=.'");
    expect(script).toContain("tracked-env-file");
    expect(script).toContain(".env.example");
    expect(script).toContain("real .env file cannot be versioned");
  });
});
