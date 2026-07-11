import { $ } from "bun"
import semver from "semver"
import path from "path"

// Layout: packages/code/script/src → packages/code (../../) or monorepo root (../../../../)
const rootPkgCandidates = [
  path.resolve(import.meta.dir, "../../package.json"), // packages/code/package.json
  path.resolve(import.meta.dir, "../../../../package.json"), // monorepo package.json
  path.resolve(import.meta.dir, "../../../package.json"), // legacy (packages/)
]
let rootPkgPath = rootPkgCandidates.find((p) => {
  try {
    return Bun.file(p).size > 0
  } catch {
    return false
  }
})
if (!rootPkgPath) {
  // Bun.file(path).size may not throw; use exists via async read attempt
  for (const p of rootPkgCandidates) {
    try {
      await Bun.file(p).json()
      rootPkgPath = p
      break
    } catch {
      // try next
    }
  }
}
if (!rootPkgPath) {
  throw new Error(
    `package.json not found for @zavorth/script (tried: ${rootPkgCandidates.join(", ")})`,
  )
}
const rootPkg = await Bun.file(rootPkgPath).json()
const expectedBunVersion = rootPkg.packageManager?.split("@")[1]

if (!expectedBunVersion) {
  throw new Error(`packageManager field not found in ${rootPkgPath}`)
}

// relax version requirement
const expectedBunVersionRange = `^${expectedBunVersion}`

if (!semver.satisfies(process.versions.bun, expectedBunVersionRange)) {
  throw new Error(`This script requires bun@${expectedBunVersionRange}, but you are using bun@${process.versions.bun}`)
}

const env = {
  ZAVORTH_CHANNEL: process.env["ZAVORTH_CHANNEL"],
  ZAVORTH_BUMP: process.env["ZAVORTH_BUMP"],
  ZAVORTH_VERSION: process.env["ZAVORTH_VERSION"],
  ZAVORTH_RELEASE: process.env["ZAVORTH_RELEASE"],
}
const CHANNEL = await (async () => {
  if (env.ZAVORTH_CHANNEL) return env.ZAVORTH_CHANNEL
  if (env.ZAVORTH_BUMP) return "latest"
  if (env.ZAVORTH_VERSION && !env.ZAVORTH_VERSION.startsWith("0.0.0-")) return "latest"
  return await $`git branch --show-current`.text().then((x) => x.trim()) || "latest"
})()
const IS_PREVIEW = CHANNEL !== "latest"

const VERSION = await (async () => {
  if (env.ZAVORTH_VERSION) return env.ZAVORTH_VERSION
  if (IS_PREVIEW) return `0.0.0-${CHANNEL}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`
  const version = await Bun.file(path.resolve(import.meta.dir, "../../cli/package.json"))
    .json()
    .then((data: any) => data.version)
  const t = env.ZAVORTH_BUMP?.toLowerCase()
  if (!t) return version
  const [major, minor, patch] = version.split(".").map((x: string) => Number(x) || 0)
  if (t === "major") return `${major + 1}.0.0`
  if (t === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
})()

export const Script = {
  get channel() {
    return CHANNEL
  },
  get version() {
    return VERSION
  },
  get preview() {
    return IS_PREVIEW
  },
  get release(): boolean {
    return !!env.ZAVORTH_RELEASE
  },
}
console.log(`zavorth script`, JSON.stringify(Script, null, 2))
