import { describe, expect, test } from "bun:test"
import {
  isProtectedToken,
  protectTokens,
  segmentForWrap,
  stripProtection,
} from "../../../src/cli/cmd/tui/util/copy-safe"
import { osc8 } from "../../../src/cli/cmd/tui/util/osc8"

describe("copy-safe", () => {
  test("isProtectedToken detects urls paths and secrets", () => {
    expect(isProtectedToken("https://example.com/a/b")).toBe(true)
    expect(isProtectedToken("/home/user/project")).toBe(true)
    expect(isProtectedToken("~/src/app")).toBe(true)
    expect(isProtectedToken("C:\\Users\\me\\file.ts")).toBe(true)
    expect(isProtectedToken("sk-abcdefghijklmnopqrstuvwxyz012345")).toBe(true)
    expect(isProtectedToken("hello")).toBe(false)
    expect(isProtectedToken("a b")).toBe(false)
  })

  test("protectTokens soft-breaks at path separators; stripProtection reverses", () => {
    const input = "see /home/user/repo and https://x.ai/path ok"
    const soft = protectTokens(input)
    expect(soft.includes("\u200B")).toBe(true)
    expect(soft).toContain("/\u200Bhome/\u200Buser/\u200Brepo")
    expect(stripProtection(soft)).toBe(input)
    expect(protectTokens("plain words only")).toBe("plain words only")
  })

  test("stripProtection removes ZWSP WORD JOINER and BOM", () => {
    expect(stripProtection("a\u200Bb\u2060c\uFEFFd")).toBe("abcd")
    expect(stripProtection("")).toBe("")
    expect(stripProtection("clean")).toBe("clean")
  })

  test("stripProtection removes OSC-8 wrappers and keeps label", () => {
    const linked = osc8("https://example.com/path", "click me")
    expect(linked).toContain("\x1b]8;;")
    expect(stripProtection(linked)).toBe("click me")
    // Mixed: protectTokens + OSC-8
    const mixed = `${protectTokens("/tmp/a/b")} ${osc8("file:///tmp/a/b", "↗")}`
    expect(stripProtection(mixed)).toBe("/tmp/a/b ↗")
  })

  test("stripProtection is idempotent", () => {
    const once = stripProtection(protectTokens("https://x.ai/a/b"))
    expect(stripProtection(once)).toBe(once)
    expect(once).toBe("https://x.ai/a/b")
  })

  test("segmentForWrap keeps whitespace and tokens", () => {
    const segs = segmentForWrap("a  /path/to  b")
    expect(segs.join("")).toBe("a  /path/to  b")
    expect(segs).toContain("/path/to")
  })
})

describe("osc8", () => {
  test("wraps label with OSC-8 sequence", () => {
    const out = osc8("https://example.com", "click")
    expect(out).toBe("\x1b]8;;https://example.com\x07click\x1b]8;;\x07")
  })

  test("strips control chars from url", () => {
    const out = osc8("https://ex.com/\x1b", "x")
    expect(out).toBe("\x1b]8;;https://ex.com/\x07x\x1b]8;;\x07")
  })
})
