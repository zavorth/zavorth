import { expect, test } from "bun:test"
import { RGBA } from "@opentui/core"

const { renderOperationalMeshBackground } = await import(
  "../../../src/cli/cmd/tui/component/starry-background-renderer"
)

const theme = {
  background: RGBA.fromInts(26, 26, 26),
  primary: RGBA.fromInts(0, 232, 143),
}

test("renders an organized console emblem around the prompt reserve on a black terminal background", () => {
  const rendered = renderOperationalMeshBackground({ w: 96, h: 30, theme, phase: 4 })
  const nonSpaceGlyphs = rendered.text.replace(/\s/g, "").length
  const foregrounds = new Set(
    rendered.chunks
      .filter((chunk) => chunk.text.trim().length > 0)
      .map((chunk) => `${chunk.fg?.r ?? 0},${chunk.fg?.g ?? 0},${chunk.fg?.b ?? 0}`),
  )
  const hasCyanSignal = rendered.chunks.some((chunk) => (chunk.fg?.g ?? 0) > 0.5 && (chunk.fg?.b ?? 0) > 0.45)
  const hasGoldSignal = rendered.chunks.some((chunk) => (chunk.fg?.r ?? 0) > 0.55 && (chunk.fg?.g ?? 0) > 0.35)
  const rows = rendered.text.split("\n")
  const middleRows = rows.slice(12, 20).join("\n")
  const promptReserveRows = rows.slice(16, 22)

  expect(rows).toHaveLength(30)
  expect(rendered.text).toContain("ZAVORTH")
  expect(rendered.text).toContain("╭")
  expect(rendered.text).toContain("╯")
  expect(rendered.text).toContain("◆")
  expect(rendered.text).toContain("=")
  expect(middleRows).toContain("╋")
  expect(nonSpaceGlyphs).toBeGreaterThan(280)
  expect(nonSpaceGlyphs).toBeLessThan(720)
  expect(foregrounds.size).toBeGreaterThanOrEqual(6)
  expect(hasCyanSignal).toBe(true)
  expect(hasGoldSignal).toBe(true)
  expect(promptReserveRows.every((row) => row.slice(30, 66).trim().length < 8)).toBe(true)
  expect(rendered.text).not.toMatch(/[█▓▒]/)
  expect(rendered.chunks.every((chunk) => chunk.bg?.equals(RGBA.fromInts(0, 0, 0)))).toBe(true)
})
