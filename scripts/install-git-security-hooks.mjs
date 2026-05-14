import { spawnSync } from "node:child_process";

const mode = process.argv[2] || "--install";

function git(args) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    shell: false,
    stdio: "pipe",
    encoding: "utf8",
  });

  return result;
}

function fail(message) {
  console.error(`[security-hooks] ${message}`);
  process.exit(1);
}

const repoCheck = git(["rev-parse", "--is-inside-work-tree"]);
if (repoCheck.status !== 0 || repoCheck.stdout.trim() !== "true") {
  fail("este comando deve ser executado dentro de um repositorio git.");
}

if (mode === "--install") {
  const result = git(["config", "core.hooksPath", ".githooks"]);
  if (result.status !== 0) {
    fail(result.stderr.trim() || "falha ao configurar core.hooksPath.");
  }
  console.log("[security-hooks] hooks instalados: core.hooksPath=.githooks");
  process.exit(0);
}

if (mode === "--uninstall") {
  const result = git(["config", "--unset", "core.hooksPath"]);
  if (result.status !== 0 && result.status !== 5) {
    fail(result.stderr.trim() || "falha ao remover core.hooksPath.");
  }
  console.log("[security-hooks] hooks removidos.");
  process.exit(0);
}

fail("modo invalido. Use --install ou --uninstall.");
